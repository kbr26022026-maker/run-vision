import { hexToRgb, rgbToHex } from '@/shared/lib/color/color-scales';
import type { PhotoAsset } from './render/env';

const MAX_PHOTO_SIDE = 3200;

export class PhotoImportError extends Error {}

/** Decodes a photo (respecting EXIF rotation) and downsizes huge camera originals. */
export async function decodePhoto(file: File): Promise<PhotoAsset> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name)) {
    throw new PhotoImportError('Это не изображение. Выберите JPG, PNG или WebP');
  }

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoImportError(
      /\.hei[cf]$/i.test(file.name)
        ? 'Браузер не открывает HEIC. Выберите фото через галерею или сохраните его как JPG'
        : 'Не удалось открыть фото',
    );
  }

  const longest = Math.max(bitmap.width, bitmap.height);

  if (longest > MAX_PHOTO_SIDE) {
    const ratio = MAX_PHOTO_SIDE / longest;
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: Math.round(bitmap.width * ratio),
      resizeHeight: Math.round(bitmap.height * ratio),
      resizeQuality: 'high',
    });
    bitmap.close();
    bitmap = resized;
  }

  return { image: bitmap, width: bitmap.width, height: bitmap.height };
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;

  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;

  return { h: hue * 60, s: saturation, l: lightness };
}

function hslToHex(h: number, s: number, l: number) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const [r, g, b] =
    h < 60
      ? [chroma, x, 0]
      : h < 120
        ? [x, chroma, 0]
        : h < 180
          ? [0, chroma, x]
          : h < 240
            ? [0, x, chroma]
            : h < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/**
 * Picks colours that belong to the photo: the most vivid hue becomes the accent (lifted so it
 * reads on a darkened photo), and a deep shade of the average colour becomes the background.
 */
export function extractPhotoColors(photo: PhotoAsset): {
  background: string;
  accent: string;
  text: string;
} {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(photo.image, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;

  const buckets = Array.from({ length: 12 }, () => ({ weight: 0, h: 0, s: 0, l: 0 }));
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index]!;
    const g = pixels[index + 1]!;
    const b = pixels[index + 2]!;
    sumR += r;
    sumG += g;
    sumB += b;

    const { h, s, l } = rgbToHsl(r, g, b);

    if (s < 0.25 || l < 0.15 || l > 0.9) {
      continue;
    }

    const weight = s * (1 - Math.abs(l - 0.55));
    const bucket = buckets[Math.floor(h / 30) % 12]!;
    bucket.weight += weight;
    bucket.h += h * weight;
    bucket.s += s * weight;
    bucket.l += l * weight;
  }

  const count = pixels.length / 4;
  const average = rgbToHex({ r: sumR / count, g: sumG / count, b: sumB / count });
  const best = buckets.reduce((winner, bucket) =>
    bucket.weight > winner.weight ? bucket : winner,
  );

  const accent =
    best.weight > 0
      ? hslToHex(
          best.h / best.weight,
          Math.max(0.65, best.s / best.weight),
          Math.max(0.62, Math.min(0.72, best.l / best.weight)),
        )
      : '#d4ff3f';

  const { r, g, b } = hexToRgb(average);
  const { h, s } = rgbToHsl(r, g, b);

  return {
    background: hslToHex(h, Math.min(0.5, s), 0.12),
    accent,
    text: '#ffffff',
  };
}
