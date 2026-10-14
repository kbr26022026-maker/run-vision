export type PickFileOptions = {
  accept: string;
  /** Opens the camera directly on phones. */
  capture?: 'user' | 'environment';
};

/** Opens the native file picker. Must be called from a user gesture. */
export function pickFile({ accept, capture }: PickFileOptions): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    if (capture) {
      input.setAttribute('capture', capture);
    }

    input.style.display = 'none';
    document.body.appendChild(input);

    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.click();
  });
}
