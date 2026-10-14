import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_VERY_HIGH,
  WebMOutputFormat,
  type VideoCodec,
} from 'mediabunny';
import { getCardSize, renderCard, type RenderCardInput } from '../render/render-card';

export const VIDEO_FPS = 30;
const LEAD_IN_SECONDS = 0.3;
/** The finished card stays on screen this long at the end. */
const HOLD_SECONDS = 2.5;

export type VideoResult = {
  blob: Blob;
  extension: 'mp4' | 'webm';
};

export type VideoExportOptions = {
  input: Omit<RenderCardInput, 't'>;
  durationSeconds: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

/** Maps video time to the card's animation timeline (draw, then hold the final frame). */
export function getVideoTimeline(timeSeconds: number, durationSeconds: number) {
  const animation = Math.max(1, durationSeconds - HOLD_SECONDS - LEAD_IN_SECONDS);
  return Math.min(1, Math.max(0, (timeSeconds - LEAD_IN_SECONDS) / animation));
}

/** Video has no alpha channel: a transparent card gets its palette background instead. */
function videoInput(input: Omit<RenderCardInput, 't'>): Omit<RenderCardInput, 't'> {
  if (input.settings.backgroundMode !== 'transparent') {
    return input;
  }

  return { ...input, settings: { ...input.settings, backgroundMode: 'palette' } };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Отменено', 'AbortError');
  }
}

async function encodeWithWebCodecs(
  options: VideoExportOptions,
  canvas: HTMLCanvasElement,
  codec: VideoCodec,
  container: 'mp4' | 'webm',
): Promise<VideoResult> {
  const ctx = canvas.getContext('2d')!;
  const input = videoInput(options.input);
  const target = new BufferTarget();
  const output = new Output({
    format:
      container === 'mp4'
        ? new Mp4OutputFormat({ fastStart: 'in-memory' })
        : new WebMOutputFormat(),
    target,
  });
  const source = new CanvasSource(canvas, {
    codec,
    quality: QUALITY_VERY_HIGH,
    keyFrameInterval: 1,
  });

  output.addVideoTrack(source, { frameRate: VIDEO_FPS });
  await output.start();

  const totalFrames = Math.round(options.durationSeconds * VIDEO_FPS);

  try {
    for (let frame = 0; frame < totalFrames; frame += 1) {
      throwIfAborted(options.signal);
      const time = frame / VIDEO_FPS;
      renderCard(ctx, { ...input, t: getVideoTimeline(time, options.durationSeconds) });
      await source.add(time, 1 / VIDEO_FPS);
      options.onProgress?.((frame + 1) / totalFrames);
    }

    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  }

  const mimeType = container === 'mp4' ? 'video/mp4' : 'video/webm';
  return { blob: new Blob([target.buffer!], { type: mimeType }), extension: container };
}

/** Fallback for browsers without WebCodecs: records the canvas in real time. */
async function recordWithMediaRecorder(
  options: VideoExportOptions,
  canvas: HTMLCanvasElement,
): Promise<VideoResult> {
  const ctx = canvas.getContext('2d')!;
  const input = videoInput(options.input);
  const mimeType = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type));

  if (!mimeType) {
    throw new Error('Этот браузер не умеет записывать видео. Попробуйте Chrome или Safari 17+');
  }

  const stream = canvas.captureStream(VIDEO_FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  renderCard(ctx, { ...input, t: 0 });
  recorder.start();

  await new Promise<void>((resolve, reject) => {
    const start = performance.now();

    const draw = () => {
      if (options.signal?.aborted) {
        recorder.stop();
        reject(new DOMException('Отменено', 'AbortError'));
        return;
      }

      const time = (performance.now() - start) / 1000;
      renderCard(ctx, { ...input, t: getVideoTimeline(time, options.durationSeconds) });
      options.onProgress?.(Math.min(1, time / options.durationSeconds));

      if (time >= options.durationSeconds) {
        resolve();
      } else {
        requestAnimationFrame(draw);
      }
    };

    requestAnimationFrame(draw);
  });

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());

  const isMp4 = mimeType.startsWith('video/mp4');
  return {
    blob: new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' }),
    extension: isMp4 ? 'mp4' : 'webm',
  };
}

export async function exportVideo(options: VideoExportOptions): Promise<VideoResult> {
  const { width, height } = getCardSize(options.input.settings);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  if (typeof VideoEncoder !== 'undefined') {
    // Instagram wants H.264 in MP4; WebM is a last resort for browsers without an AVC encoder.
    const avc = await getFirstEncodableVideoCodec(['avc'], { width, height });

    if (avc) {
      return encodeWithWebCodecs(options, canvas, avc, 'mp4');
    }

    const webm = await getFirstEncodableVideoCodec(['vp9', 'vp8'], { width, height });

    if (webm) {
      return encodeWithWebCodecs(options, canvas, webm, 'webm');
    }
  }

  return recordWithMediaRecorder(options, canvas);
}
