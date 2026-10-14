import type { RouteShape } from '@/entities/activity/model/route-geometry';
import {
  getScaleStops,
  sampleScale,
  withAlpha,
  type RouteColorMode,
} from '@/shared/lib/color/color-scales';
import type { Ctx, Rect } from './kit';

export type RouteStyle = {
  color: string;
  mode: RouteColorMode;
  width: number;
  glow: boolean;
  /** 0–1: how much of the route is drawn (video animation). */
  progress: number;
  /** Dark halo under the line so it reads on busy photos and maps. */
  shadow?: boolean;
  /** Outline colour drawn under the line. */
  casing?: string;
  markers?: boolean;
  /** Background colour used to punch the start marker. */
  markerFill?: string;
};

/** Fits the normalised route shape into a rectangle, keeping its proportions. */
export function projectShape(shape: RouteShape, rect: Rect): Float32Array {
  const scale = Math.min(rect.w / shape.width, rect.h / shape.height);
  const offsetX = rect.x + (rect.w - shape.width * scale) / 2;
  const offsetY = rect.y + (rect.h - shape.height * scale) / 2;
  const result = new Float32Array(shape.points.length);

  for (let index = 0; index < shape.points.length; index += 2) {
    result[index] = offsetX + shape.points[index]! * scale;
    result[index + 1] = offsetY + shape.points[index + 1]! * scale;
  }

  return result;
}

/** Bounding box of projected points. */
export function getPointsBounds(points: Float32Array): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index < points.length; index += 2) {
    minX = Math.min(minX, points[index]!);
    maxX = Math.max(maxX, points[index]!);
    minY = Math.min(minY, points[index + 1]!);
    maxY = Math.max(maxY, points[index + 1]!);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

type VisiblePath = { count: number; head: [number, number] | null };

function visibleCount(shape: RouteShape, progress: number): VisiblePath {
  if (progress >= 1) {
    return { count: shape.progress.length, head: null };
  }

  let count = 0;

  while (count < shape.progress.length && shape.progress[count]! <= progress) {
    count += 1;
  }

  return { count, head: null };
}

function tracePath(ctx: Ctx, points: Float32Array, count: number, head: [number, number] | null) {
  ctx.beginPath();

  for (let index = 0; index < count; index += 1) {
    const x = points[index * 2]!;
    const y = points[index * 2 + 1]!;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  if (head) {
    ctx.lineTo(head[0], head[1]);
  }
}

function headPoint(
  shape: RouteShape,
  points: Float32Array,
  count: number,
  progress: number,
): [number, number] | null {
  if (count === 0 || count >= shape.progress.length) {
    return null;
  }

  const fromProgress = shape.progress[count - 1]!;
  const toProgress = shape.progress[count]!;
  const ratio =
    toProgress > fromProgress ? (progress - fromProgress) / (toProgress - fromProgress) : 0;
  const x0 = points[(count - 1) * 2]!;
  const y0 = points[(count - 1) * 2 + 1]!;
  const x1 = points[count * 2]!;
  const y1 = points[count * 2 + 1]!;

  return [x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio];
}

export function getRouteColorAt(
  shape: RouteShape,
  style: Pick<RouteStyle, 'mode' | 'color'>,
  index: number,
) {
  if (style.mode === 'solid') {
    return style.color;
  }

  return sampleScale(getScaleStops(style.mode), shape.metrics[style.mode][index] ?? 0.5);
}

/**
 * Draws the route from pre-projected pixel points. Colour modes stroke short batches of
 * segments with their own colour; round caps hide the joins between batches.
 */
export function drawRoute(ctx: Ctx, shape: RouteShape, points: Float32Array, style: RouteStyle) {
  const { count } = visibleCount(shape, style.progress);
  const head = headPoint(shape, points, count, style.progress);

  if (count === 0) {
    return;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (style.shadow) {
    tracePath(ctx, points, count, head);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = style.width * 1.7;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = style.width * 3.5;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  if (style.casing) {
    tracePath(ctx, points, count, head);
    ctx.strokeStyle = style.casing;
    ctx.lineWidth = style.width * 1.9;
    ctx.stroke();
  }

  const glowColor =
    style.mode === 'solid' ? style.color : sampleScale(getScaleStops(style.mode), 0.6);

  if (style.glow) {
    tracePath(ctx, points, count, head);
    ctx.strokeStyle = withAlpha(glowColor, 0.55);
    ctx.lineWidth = style.width * 1.4;
    ctx.shadowColor = withAlpha(glowColor, 0.95);
    ctx.shadowBlur = style.width * 4.5;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  ctx.lineWidth = style.width;

  if (style.mode === 'solid') {
    tracePath(ctx, points, count, head);
    ctx.strokeStyle = style.color;
    ctx.stroke();
  } else {
    const batch = 3;

    for (let start = 0; start < count - 1; start += batch) {
      const end = Math.min(start + batch, count - 1);
      ctx.beginPath();
      ctx.moveTo(points[start * 2]!, points[start * 2 + 1]!);

      for (let index = start + 1; index <= end; index += 1) {
        ctx.lineTo(points[index * 2]!, points[index * 2 + 1]!);
      }

      if (end === count - 1 && head) {
        ctx.lineTo(head[0], head[1]);
      }

      ctx.strokeStyle = getRouteColorAt(shape, style, start);
      ctx.stroke();
    }
  }

  if (style.markers) {
    const startX = points[0]!;
    const startY = points[1]!;
    const markerRadius = style.width * 1.25;

    ctx.beginPath();
    ctx.arc(startX, startY, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.markerFill ?? '#000000';
    ctx.fill();
    ctx.lineWidth = style.width * 0.6;
    ctx.strokeStyle = getRouteColorAt(shape, style, 0);
    ctx.stroke();

    const endIndex = count - 1;
    const end: [number, number] = head ?? [points[endIndex * 2]!, points[endIndex * 2 + 1]!];
    const endColor = getRouteColorAt(shape, style, endIndex);

    if (head) {
      // Moving head while the route animates.
      ctx.beginPath();
      ctx.arc(end[0], end[1], markerRadius * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(endColor, 0.25);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(end[0], end[1], markerRadius * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = endColor;
    ctx.fill();
  }

  ctx.restore();
}
