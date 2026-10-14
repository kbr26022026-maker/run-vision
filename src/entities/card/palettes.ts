import type { CardSettings, Palette } from './card.types';

export const PALETTES: Palette[] = [
  { id: 'night', name: 'Ночь', background: '#0b0b0f', accent: '#d4ff3f', text: '#ffffff' },
  {
    id: 'graphite',
    name: 'Графит',
    background: '#1c1c1f',
    background2: '#2e2e33',
    accent: '#ff6b2c',
    text: '#ffffff',
  },
  { id: 'paper', name: 'Бумага', background: '#f3efe6', accent: '#ff4f1f', text: '#141414' },
  {
    id: 'forest',
    name: 'Лес',
    background: '#0e2a1c',
    background2: '#1d4a33',
    accent: '#b7f171',
    text: '#f1f7ee',
  },
  {
    id: 'ocean',
    name: 'Океан',
    background: '#071a33',
    background2: '#123a6b',
    accent: '#5eead4',
    text: '#eef6ff',
  },
  {
    id: 'sunset',
    name: 'Закат',
    background: '#ff5f6d',
    background2: '#ffc371',
    accent: '#ffffff',
    text: '#ffffff',
  },
  {
    id: 'neon',
    name: 'Неон',
    background: '#0d0721',
    background2: '#2a0f4f',
    accent: '#00f5d4',
    text: '#ffffff',
  },
  {
    id: 'lava',
    name: 'Лава',
    background: '#170704',
    background2: '#3d0c02',
    accent: '#ff7a1a',
    text: '#fff4ec',
  },
  { id: 'sakura', name: 'Сакура', background: '#fde7f1', accent: '#e11d74', text: '#4a0a26' },
  { id: 'ice', name: 'Лёд', background: '#e9f1ff', accent: '#2563eb', text: '#0b1b3a' },
  { id: 'mono', name: 'Монохром', background: '#000000', accent: '#ffffff', text: '#ffffff' },
  { id: 'volt', name: 'Вольт', background: '#d4ff3f', accent: '#0a0a0b', text: '#0a0a0b' },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0]!;
}

export function resolvePalette(
  settings: Pick<CardSettings, 'paletteId' | 'customColors'>,
): Palette {
  const base = getPalette(settings.paletteId);

  if (!settings.customColors) {
    return base;
  }

  return {
    ...base,
    ...settings.customColors,
    id: 'custom',
    name: 'Свои цвета',
    background2: undefined,
  };
}
