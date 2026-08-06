/** Which text tone an image wants behind it. */
export type Tone = 'light' | 'dark';

/**
 * Relative luminance of an sRGB triplet, 0..1 (WCAG).
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Dark backgrounds want light text and vice versa. The threshold is 0.35 rather
 * than 0.5: white text survives a mid-tone background better than black text
 * does, so the tipping point sits below the midpoint.
 */
export function toneForLuminance(luminance: number): Tone {
  return luminance < 0.35 ? 'light' : 'dark';
}

/**
 * Average luminance of the region a card title actually occupies — the left
 * 60%, bottom two thirds — rather than the whole image. A header can be dark
 * where the text sits and bright somewhere the text never reaches, and it is
 * the former that decides legibility.
 */
export function sampleImageTone(src: string): Promise<Tone> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve('light');
      return;
    }
    const img = new Image();
    // Same-origin only (the CSP allows nothing else), so the canvas stays clean.
    img.onload = () => {
      try {
        const W = 32;
        const H = 16;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const g = canvas.getContext('2d');
        if (!g) {
          resolve('light');
          return;
        }
        g.drawImage(img, 0, 0, W, H);
        // Left 60%, bottom two thirds: where the title and its label sit.
        const x0 = 0;
        const x1 = Math.round(W * 0.6);
        const y0 = Math.round(H / 3);
        const { data } = g.getImageData(x0, y0, x1 - x0, H - y0);
        let total = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += relativeLuminance(data[i], data[i + 1], data[i + 2]);
          n++;
        }
        resolve(toneForLuminance(n === 0 ? 0 : total / n));
      } catch {
        // A tainted canvas should not stop the page rendering.
        resolve('light');
      }
    };
    img.onerror = () => resolve('light');
    img.src = src;
  });
}
