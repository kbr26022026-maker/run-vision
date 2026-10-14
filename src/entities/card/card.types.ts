import type { RouteColorMode } from '@/shared/lib/color/color-scales';
import type { MapStyleId } from '@/shared/lib/map/map-styles';

export type CardFormat = 'story' | 'post' | 'square';

export const CARD_FORMATS: Record<
  CardFormat,
  { width: number; height: number; label: string; hint: string }
> = {
  story: { width: 1080, height: 1920, label: 'Stories', hint: '9:16' },
  post: { width: 1080, height: 1350, label: 'Пост', hint: '4:5' },
  square: { width: 1080, height: 1080, label: 'Квадрат', hint: '1:1' },
};

export type TemplateId = 'minimal' | 'hero' | 'neon' | 'map' | 'splits' | 'receipt' | 'sticker';

export type StatKey =
  | 'distance'
  | 'duration'
  | 'pace'
  | 'heartRate'
  | 'maxHeartRate'
  | 'cadence'
  | 'elevationGain'
  | 'bestPace'
  | 'startTime';

export type BackgroundMode = 'palette' | 'photo' | 'transparent';

export type Palette = {
  id: string;
  name: string;
  background: string;
  /** Optional second colour: the background becomes a diagonal gradient. */
  background2?: string;
  accent: string;
  text: string;
};

export type PhotoTransform = {
  /** Offset of the photo centre, in fractions of the card width / height. */
  x: number;
  y: number;
  /** Zoom on top of "cover" fit; 1 = the photo just covers the card. */
  scale: number;
};

export type CardSettings = {
  format: CardFormat;
  templateId: TemplateId;
  paletteId: string;
  /** Set when the user picked colours by hand; overrides the palette. */
  customColors: Pick<Palette, 'background' | 'accent' | 'text'> | null;
  backgroundMode: BackgroundMode;
  /** Darkening gradient over a photo, 0–1. */
  photoScrim: number;
  /** Soft focus over a photo, 0–1. */
  photoBlur: number;
  routeColorMode: RouteColorMode;
  /** Multiplier for the route stroke width. */
  routeWidth: number;
  routeGlow: boolean;
  stats: StatKey[];
  /** Custom title; empty means the activity name. */
  title: string;
  showDate: boolean;
  showBrand: boolean;
  mapStyle: MapStyleId;
};

export type StatDisplay = {
  label: string;
  value: string;
  unit: string;
};

export type StudioMode = 'photo' | 'video';
