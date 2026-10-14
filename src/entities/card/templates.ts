import type { RouteColorMode } from '@/shared/lib/color/color-scales';
import type { BackgroundMode, TemplateId } from './card.types';

export type TemplateMeta = {
  id: TemplateId;
  name: string;
  description: string;
  defaultPaletteId: string;
  defaultBackground: Exclude<BackgroundMode, 'photo'>;
  defaultRouteColorMode: RouteColorMode;
  /** The template paints a real map instead of a colour or photo background. */
  usesMap?: boolean;
  supportsPhoto: boolean;
  /** Exported as a trimmed PNG sticker for pasting over a Story. */
  isSticker?: boolean;
};

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'minimal',
    name: 'Минимал',
    description: 'Маршрут и главные цифры',
    defaultPaletteId: 'night',
    defaultBackground: 'palette',
    defaultRouteColorMode: 'solid',
    supportsPhoto: true,
  },
  {
    id: 'hero',
    name: 'Большая цифра',
    description: 'Дистанция на весь экран',
    defaultPaletteId: 'volt',
    defaultBackground: 'palette',
    defaultRouteColorMode: 'solid',
    supportsPhoto: true,
  },
  {
    id: 'neon',
    name: 'Неон',
    description: 'Светящийся трек по темпу',
    defaultPaletteId: 'neon',
    defaultBackground: 'palette',
    defaultRouteColorMode: 'pace',
    supportsPhoto: true,
  },
  {
    id: 'map',
    name: 'Карта',
    description: 'Настоящая карта района',
    defaultPaletteId: 'night',
    defaultBackground: 'palette',
    defaultRouteColorMode: 'solid',
    usesMap: true,
    supportsPhoto: false,
  },
  {
    id: 'splits',
    name: 'Сплиты',
    description: 'Темп по километрам',
    defaultPaletteId: 'graphite',
    defaultBackground: 'palette',
    defaultRouteColorMode: 'solid',
    supportsPhoto: true,
  },
  {
    id: 'receipt',
    name: 'Чек',
    description: 'Пробежка в виде чека',
    defaultPaletteId: 'sunset',
    defaultBackground: 'palette',
    defaultRouteColorMode: 'solid',
    supportsPhoto: true,
  },
  {
    id: 'sticker',
    name: 'Стикер',
    description: 'Прозрачный PNG поверх фото',
    defaultPaletteId: 'mono',
    defaultBackground: 'transparent',
    defaultRouteColorMode: 'solid',
    supportsPhoto: true,
    isSticker: true,
  },
];

export function getTemplate(id: TemplateId): TemplateMeta {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]!;
}
