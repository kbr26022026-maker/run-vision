import type { CardData } from '../card-data';
import type { CardFormat, CardSettings, Palette, PhotoTransform } from '../card.types';
import type { TemplateMeta } from '../templates';
import type { Ctx } from './kit';

export type PhotoAsset = {
  image: CanvasImageSource;
  width: number;
  height: number;
};

export type MapSnapshot = {
  key: string;
  image: CanvasImageSource;
  width: number;
  height: number;
  /** Route points projected into the snapshot's pixel space (x,y pairs, same order as the shape). */
  points: Float32Array;
  /** Data provider credit, printed small on the card. */
  attribution: string;
};

export type RenderAssets = {
  photo: PhotoAsset | null;
  photoTransform: PhotoTransform;
  map: MapSnapshot | null;
};

export type SafeArea = { top: number; bottom: number; side: number };

export type RenderEnv = {
  ctx: Ctx;
  W: number;
  H: number;
  format: CardFormat;
  data: CardData;
  settings: CardSettings;
  palette: Palette;
  template: TemplateMeta;
  assets: RenderAssets;
  /** Animation timeline 0–1; 1 renders the final still. */
  t: number;
  /** Margins that keep content clear of Instagram's own UI. */
  safe: SafeArea;
  /** Typography scale for the format (1 for Stories). */
  u: number;
  /** Low-resolution copy of the background for frosted-glass panels. */
  backdrop: CanvasImageSource | null;
  /** Whether the background is a photo or map (text needs shadows). */
  isBusyBackground: boolean;
  title: string;
};

export const SAFE_AREAS: Record<CardFormat, SafeArea> = {
  // Instagram covers ~250px at the top (progress bar, profile) and ~330px at the bottom (reply bar).
  story: { top: 250, bottom: 330, side: 84 },
  post: { top: 96, bottom: 96, side: 84 },
  square: { top: 80, bottom: 80, side: 80 },
};

export const TYPE_SCALE: Record<CardFormat, number> = {
  story: 1,
  post: 0.9,
  square: 0.82,
};
