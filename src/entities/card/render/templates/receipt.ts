import { formatPace } from '@/shared/lib/formatters/formatters';
import type { RenderEnv } from '../env';
import { drawText, measureText, wrapText, type Ctx } from '../kit';
import { drawRoute, projectShape } from '../route';
import { getPhases } from './common';

const PAPER = '#fbfaf6';
const INK = '#161616';
const INK_MUTED = '#6f6f6a';

type Op = { height: number; draw: (ctx: Ctx, x: number, y: number, width: number) => void };

function receiptNumber(id: string) {
  let hash = 0;

  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return String(hash % 10000).padStart(4, '0');
}

function zigzagPaperPath(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number,
  tooth: number,
) {
  const teeth = Math.max(4, Math.round(width / (tooth * 2)));
  const step = width / teeth;

  ctx.beginPath();
  ctx.moveTo(x, y + tooth);

  for (let index = 0; index < teeth; index += 1) {
    ctx.lineTo(x + step * (index + 0.5), y);
    ctx.lineTo(x + step * (index + 1), y + tooth);
  }

  ctx.lineTo(x + width, y + height - tooth);

  for (let index = teeth; index > 0; index -= 1) {
    ctx.lineTo(x + step * (index - 0.5), y + height);
    ctx.lineTo(x + step * (index - 1), y + height - tooth);
  }

  ctx.closePath();
}

export function renderReceipt(env: RenderEnv) {
  const { ctx, W, H, safe, u, data, settings, format } = env;
  const phases = getPhases(env.t);
  const paperWidth = Math.min(W - safe.side * 2 + 40 * u, 800 * u);
  const padding = 56 * u;
  const inner = paperWidth - padding * 2;
  const mono = (size: number, weight = 600) => ({
    size: size * u,
    weight,
    family: 'mono' as const,
    color: INK,
  });
  const dashed: Op = {
    height: 44 * u,
    draw: (c, x, y, width) => {
      c.save();
      c.strokeStyle = INK_MUTED;
      c.lineWidth = 2;
      c.setLineDash([10 * u, 8 * u]);
      c.beginPath();
      c.moveTo(x, y + 22 * u);
      c.lineTo(x + width, y + 22 * u);
      c.stroke();
      c.restore();
    },
  };

  const centered = (text: string, size: number, weight = 600, color = INK): Op => ({
    height: size * u * 1.55,
    draw: (c, x, y, width) =>
      drawText(c, text, x + width / 2, y + size * u * 1.1, {
        ...mono(size, weight),
        color,
        align: 'center',
      }),
  });

  const line = (label: string, value: string): Op => ({
    height: 46 * u,
    draw: (c, x, y, width) => {
      const baseline = y + 34 * u;
      const labelWidth = drawText(c, label, x, baseline, { ...mono(27, 600) });
      const valueWidth = measureText(c, value, mono(27, 800));
      drawText(c, value, x + width, baseline, { ...mono(27, 800), align: 'right' });
      c.save();
      c.strokeStyle = 'rgba(22, 22, 22, 0.35)';
      c.lineWidth = 3;
      c.setLineDash([2, 9 * u]);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x + labelWidth + 14 * u, baseline - 4 * u);
      c.lineTo(x + width - valueWidth - 14 * u, baseline - 4 * u);
      c.stroke();
      c.restore();
    },
  });

  const header: Op[] = [
    centered(settings.showBrand ? 'RUNVISION' : 'ПРОБЕЖКА', 54, 800),
    centered(`ЧЕК ТРЕНИРОВКИ № ${receiptNumber(data.activityId)}`, 24, 500, INK_MUTED),
  ];

  if (settings.showDate) {
    header.push(centered(`${data.date.toUpperCase()} · ${data.time}`, 24, 500, INK_MUTED));
  }

  const titleLines = env.title
    ? wrapText(ctx, env.title.toUpperCase(), inner, 2, mono(32, 800))
    : [];
  const titleOps: Op[] = titleLines.map((text) => centered(text, 32, 800));

  const statOps: Op[] = settings.stats.map((key) => {
    const stat = data.stats[key];
    return line(
      stat.label.toUpperCase(),
      `${stat.value}${stat.unit ? ` ${stat.unit.toUpperCase()}` : ''}`,
    );
  });

  const total: Op = {
    height: 70 * u,
    draw: (c, x, y, width) => {
      drawText(c, 'ИТОГО', x, y + 50 * u, mono(46, 800));
      drawText(c, data.stats.duration.value, x + width, y + 50 * u, {
        ...mono(46, 800),
        align: 'right',
      });
    },
  };

  const barcode: Op = {
    height: 120 * u,
    draw: (c, x, y, width) => {
      c.save();
      c.fillStyle = INK;
      const profile = data.elevationProfile;
      let cursor = x;
      let index = 0;

      while (cursor < x + width - 4) {
        const value = profile[index % profile.length] ?? 0.5;
        const barWidth = (2 + Math.round(value * 6)) * u;
        c.fillRect(cursor, y + 14 * u, Math.min(barWidth, x + width - cursor), 84 * u);
        cursor += barWidth + (3 + ((index * 7) % 4)) * u;
        index += 3;
      }

      c.restore();
    },
  };

  const thanks = centered('СПАСИБО ЗА ПРОБЕЖКУ!', 26, 700);

  const available = H - safe.top - safe.bottom;
  let routeHeight = (format === 'story' ? 300 : format === 'post' ? 190 : 140) * u;
  let splitRows = Math.min(data.splits.length, format === 'story' ? 10 : format === 'post' ? 4 : 0);
  let showBarcode = true;

  const build = () => {
    const splitOps: Op[] = [];

    if (splitRows > 0) {
      splitOps.push(dashed);
      data.splits.slice(0, splitRows).forEach((split) => {
        const label = split.isPartial
          ? `КМ ${(split.distanceMeters / 1000).toFixed(2)}`
          : `КМ ${split.index + 1}`;
        splitOps.push(line(label, formatPace(split.paceSecondsPerKm)));
      });
    }

    const route: Op = {
      height: routeHeight + 24 * u,
      draw: (c, x, y, width) => {
        const points = projectShape(data.shape, {
          x: x + 20 * u,
          y: y + 12 * u,
          w: width - 40 * u,
          h: routeHeight,
        });
        drawRoute(c, data.shape, points, {
          color: INK,
          mode: settings.routeColorMode,
          width: 7 * u * settings.routeWidth,
          glow: false,
          progress: phases.route,
          markers: true,
          markerFill: PAPER,
        });
      },
    };

    return [
      ...header,
      dashed,
      ...titleOps,
      route,
      dashed,
      ...statOps,
      ...splitOps,
      dashed,
      total,
      ...(showBarcode ? [barcode] : []),
      thanks,
    ];
  };

  let ops = build();
  const contentHeight = () => ops.reduce((sum, op) => sum + op.height, 0) + padding * 2;

  // Trade some route height for splits first, then drop splits, then shrink the route further.
  const comfortableRoute = (format === 'story' ? 230 : 160) * u;

  while (contentHeight() > available && routeHeight > comfortableRoute) {
    routeHeight -= 10 * u;
    ops = build();
  }

  while (contentHeight() > available && splitRows > 0) {
    splitRows -= 1;
    ops = build();
  }

  while (contentHeight() > available && routeHeight > 100 * u) {
    routeHeight -= 20 * u;
    ops = build();
  }

  if (contentHeight() > available) {
    showBarcode = false;
    ops = build();
  }

  const paperHeight = contentHeight();
  const paperX = (W - paperWidth) / 2;
  const paperY = safe.top + Math.max(0, (available - paperHeight) / 2);
  const slide = (1 - phases.intro) * H * 0.25;

  ctx.save();
  ctx.translate(W / 2, paperY + paperHeight / 2 + slide);
  ctx.rotate((-1.6 * Math.PI) / 180);
  ctx.translate(-W / 2, -(paperY + paperHeight / 2));
  ctx.globalAlpha = phases.intro;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 50 * u;
  ctx.shadowOffsetY = 20 * u;
  zigzagPaperPath(ctx, paperX, paperY, paperWidth, paperHeight, 14 * u);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.restore();

  let cursor = paperY + padding;

  for (const op of ops) {
    op.draw(ctx, paperX + padding, cursor, inner);
    cursor += op.height;
  }

  ctx.restore();
}
