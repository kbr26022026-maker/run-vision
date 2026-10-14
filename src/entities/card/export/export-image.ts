import { getCardSize, renderCard, type RenderCardInput } from '../render/render-card';

export function renderToCanvas(input: RenderCardInput, scale = 1): HTMLCanvasElement {
  const { width, height } = getCardSize(input.settings);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  renderCard(canvas.getContext('2d')!, input, scale);
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось создать изображение'))),
      type,
      quality,
    );
  });
}

/** Crops fully transparent margins (keeps `padding` px), so a sticker is only as big as its content. */
export function trimTransparent(canvas: HTMLCanvasElement, padding = 24): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;

    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x * 4 + 3]! > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (bottom < 0) {
    return canvas;
  }

  const x = Math.max(0, left - padding);
  const y = Math.max(0, top - padding);
  const w = Math.min(width, right + padding + 1) - x;
  const h = Math.min(height, bottom + padding + 1) - y;
  const result = document.createElement('canvas');
  result.width = w;
  result.height = h;
  result.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  return result;
}

export function buildFileName(title: string, suffix: string, extension: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return `runvision-${slug || 'run'}-${suffix}.${extension}`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export function canShareFiles(): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }

  try {
    return navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/**
 * Opens the system share sheet (Instagram, Telegram, Photos…). Must run in the same task as the
 * user's click on iOS, so callers should have the blob ready beforehand.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type });

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled';
      }

      if (!(error instanceof Error && error.name === 'NotAllowedError')) {
        throw error;
      }
    }
  }

  downloadBlob(blob, fileName);
  return 'downloaded';
}

export function canCopyImages(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';
}

/** Accepts a promise so Safari keeps the user gesture while the PNG is still being encoded. */
export async function copyImage(blob: Blob | Promise<Blob>) {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
