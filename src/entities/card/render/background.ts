import { getLuminance, withAlpha } from '@/shared/lib/color/color-scales';
import type { Palette, PhotoTransform } from '../card.types';
import type { MapSnapshot, PhotoAsset, RenderEnv } from './env';
import { drawGrain, roundRectPath, type Ctx, type Rect } from './kit';

export type CoverPlacement = { x: number; y: number; w: number; h: number };

/** Where a photo lands for a given pan/zoom, always covering the whole card. */
export function getPhotoPlacement(
  photo: Pick<PhotoAsset, 'width' | 'height'>,
  W: number,
  H: number,
  transform: PhotoTransform,
): CoverPlacement {
  const base = Math.max(W / photo.width, H / photo.height);
  const scale = base * Math.max(1, transform.scale);
  const w = photo.width * scale;
  const h = photo.height * scale;
  const maxX = (w - W) / 2;
  const maxY = (h - H) / 2;
  const offsetX = Math.min(maxX, Math.max(-maxX, transform.x * W));
  const offsetY = Math.min(maxY, Math.max(-maxY, transform.y * H));

  return { x: (W - w) / 2 + offsetX, y: (H - h) / 2 + offsetY, w, h };
}

/** Clamp a transform so the photo never reveals the card edges. */
export function clampPhotoTransform(
  photo: Pick<PhotoAsset, 'width' | 'height'>,
  W: number,
  H: number,
  transform: PhotoTransform,
): PhotoTransform {
  const scale = Math.min(4, Math.max(1, transform.scale));
  const base = Math.max(W / photo.width, H / photo.height) * scale;
  const maxX = (photo.width * base - W) / 2 / W;
  const maxY = (photo.height * base - H) / 2 / H;

  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, transform.x)),
    y: Math.min(maxY, Math.max(-maxY, transform.y)),
  };
}

export function drawPaletteBackground(
  ctx: Ctx,
  W: number,
  H: number,
  palette: Palette,
  grain = true,
) {
  if (palette.background2) {
    const gradient = ctx.createLinearGradient(0, 0, W * 0.6, H);
    gradient.addColorStop(0, palette.background);
    gradient.addColorStop(1, palette.background2);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = palette.background;
  }

  ctx.fillRect(0, 0, W, H);

  if (grain) {
    drawGrain(ctx, W, H, getLuminance(palette.background) > 0.5 ? 0.06 : 0.08);
  }
}

export function drawPhoto(
  ctx: Ctx,
  photo: PhotoAsset,
  W: number,
  H: number,
  transform: PhotoTransform,
) {
  const placement = getPhotoPlacement(photo, W, H, transform);
  ctx.drawImage(photo.image, placement.x, placement.y, placement.w, placement.h);
}

export function drawMapImage(ctx: Ctx, map: MapSnapshot, W: number, H: number) {
  ctx.drawImage(map.image, 0, 0, W, H);
}

/** Top and bottom darkening so white text stays readable on any photo. */
export function drawScrim(
  ctx: Ctx,
  W: number,
  H: number,
  strength: number,
  topShare = 0.38,
  bottomShare = 0.5,
) {
  if (strength <= 0) {
    return;
  }

  const top = ctx.createLinearGradient(0, 0, 0, H * topShare);
  top.addColorStop(0, `rgba(0, 0, 0, ${0.75 * strength})`);
  top.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * topShare);

  const bottom = ctx.createLinearGradient(0, H * (1 - bottomShare), 0, H);
  bottom.addColorStop(0, 'rgba(0, 0, 0, 0)');
  bottom.addColorStop(1, `rgba(0, 0, 0, ${0.85 * strength})`);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * (1 - bottomShare), W, H * bottomShare);

  ctx.fillStyle = `rgba(0, 0, 0, ${0.12 * strength})`;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Paints the card background according to the settings. Returns whether the result is a
 * "busy" image (photo/map), in which case text should get shadows.
 */
export function drawCardBackground(env: RenderEnv): boolean {
  const { ctx, W, H, settings, palette, assets } = env;

  if (settings.backgroundMode === 'transparent') {
    return false;
  }

  if (settings.backgroundMode === 'photo' && assets.photo) {
    drawPhoto(ctx, assets.photo, W, H, assets.photoTransform);

    if (settings.photoBlur > 0 && env.backdrop) {
      ctx.save();
      ctx.globalAlpha = settings.photoBlur;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(env.backdrop, 0, 0, W, H);
      ctx.restore();
    }

    drawScrim(ctx, W, H, settings.photoScrim);
    return true;
  }

  drawPaletteBackground(ctx, W, H, palette);
  return false;
}

/**
 * Frosted glass: the blurred backdrop clipped to a rounded rect, tinted, with a hairline border.
 * Without a busy backdrop it becomes a subtle translucent card.
 */
export function drawGlassPanel(env: RenderEnv, rect: Rect, radius: number, tint?: string) {
  const { ctx, W, H, palette } = env;
  const lightBackground = getLuminance(palette.background) > 0.5 && !env.isBusyBackground;

  ctx.save();
  roundRectPath(ctx, rect, radius);
  ctx.clip();

  if (env.backdrop && env.isBusyBackground) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(env.backdrop, 0, 0, W, H);
  }

  ctx.fillStyle =
    tint ??
    (env.isBusyBackground
      ? 'rgba(12, 12, 14, 0.42)'
      : lightBackground
        ? withAlpha(palette.text, 0.06)
        : 'rgba(255, 255, 255, 0.06)');
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, rect, radius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = lightBackground ? withAlpha(palette.text, 0.1) : 'rgba(255, 255, 255, 0.14)';
  ctx.stroke();
  ctx.restore();
}

/** Renders a tiny copy of the background; scaled up it reads as a strong blur (works without ctx.filter). */
export function createBackdrop(
  W: number,
  H: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = Math.max(8, Math.round(W / 24));
  small.height = Math.max(8, Math.round(H / 24));
  const smallCtx = small.getContext('2d')!;
  paint(smallCtx, small.width, small.height);

  // A second, slightly larger pass smooths the blocky upscale.
  const medium = document.createElement('canvas');
  medium.width = small.width * 3;
  medium.height = small.height * 3;
  const mediumCtx = medium.getContext('2d')!;
  mediumCtx.imageSmoothingQuality = 'high';
  mediumCtx.drawImage(small, 0, 0, medium.width, medium.height);

  return medium;
}
