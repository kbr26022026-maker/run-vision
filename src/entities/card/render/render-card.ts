import type { CardData } from '../card-data';
import { CARD_FORMATS, type CardSettings, type TemplateId } from '../card.types';
import { resolvePalette } from '../palettes';
import { getTemplate } from '../templates';
import { drawCardBackground, drawMapImage, drawPaletteBackground, drawPhoto } from './background';
import { SAFE_AREAS, TYPE_SCALE, type RenderAssets, type RenderEnv } from './env';
import type { Ctx } from './kit';
import { renderHero } from './templates/hero';
import { renderMap } from './templates/map';
import { renderMinimal } from './templates/minimal';
import { renderNeon } from './templates/neon';
import { renderReceipt } from './templates/receipt';
import { renderSplits } from './templates/splits';
import { renderSticker } from './templates/sticker';

const RENDERERS: Record<TemplateId, (env: RenderEnv) => void> = {
  minimal: renderMinimal,
  hero: renderHero,
  neon: renderNeon,
  map: renderMap,
  splits: renderSplits,
  receipt: renderReceipt,
  sticker: renderSticker,
};

export type RenderCardInput = {
  data: CardData;
  settings: CardSettings;
  assets: RenderAssets;
  backdrop: CanvasImageSource | null;
  /** Animation timeline 0–1 (1 = final still). */
  t?: number;
};

export function getCardSize(settings: Pick<CardSettings, 'format'>) {
  const { width, height } = CARD_FORMATS[settings.format];
  return { width, height };
}

/**
 * Renders a card at its logical size (1080 px wide) multiplied by `scale`.
 * The same function drives the live preview, thumbnails, PNG export and every video frame.
 */
export function renderCard(ctx: Ctx, input: RenderCardInput, scale = 1) {
  const { settings, data, assets } = input;
  const { width: W, height: H } = getCardSize(settings);
  const template = getTemplate(settings.templateId);
  const palette = resolvePalette(settings);

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const env: RenderEnv = {
    ctx,
    W,
    H,
    format: settings.format,
    data,
    settings,
    palette,
    template,
    assets,
    t: input.t ?? 1,
    safe: SAFE_AREAS[settings.format],
    u: TYPE_SCALE[settings.format],
    backdrop: input.backdrop,
    isBusyBackground: false,
    title: settings.title.trim() || data.activityName,
  };

  if (template.usesMap) {
    if (assets.map) {
      drawMapImage(ctx, assets.map, W, H);
    } else {
      drawPaletteBackground(ctx, W, H, {
        ...palette,
        background: '#101012',
        background2: '#1c1c20',
      });
    }
    env.isBusyBackground = true;
  } else {
    env.isBusyBackground = drawCardBackground(env);
  }

  RENDERERS[template.id](env);
  ctx.restore();
}

/** Paints only the background (for the low-res frosted-glass backdrop). */
export function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: CardSettings,
  assets: RenderAssets,
) {
  const template = getTemplate(settings.templateId);

  if (template.usesMap && assets.map) {
    ctx.drawImage(assets.map.image, 0, 0, w, h);
    return;
  }

  if (settings.backgroundMode === 'photo' && assets.photo) {
    drawPhoto(ctx, assets.photo, w, h, assets.photoTransform);
    return;
  }

  drawPaletteBackground(ctx, w, h, resolvePalette(settings), false);
}
