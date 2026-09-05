import path from 'path';
import { createCanvas, GlobalFonts, SKRSContext2D } from '@napi-rs/canvas';

let fontsRegistered = false;

// Registered once per process rather than per render - GlobalFonts is a
// process-wide table and re-registering the same family is a no-op cost every
// panel would otherwise pay on every tick.
function ensureFontsRegistered() {
  if (fontsRegistered) {
    return;
  }

  const fontsDir = path.join(__dirname, '../assets/fonts');

  GlobalFonts.registerFromPath(path.join(fontsDir, 'DejaVuSans.ttf'), 'DejaVu Sans');
  GlobalFonts.registerFromPath(path.join(fontsDir, 'DejaVuSans-Bold.ttf'), 'DejaVu Sans Bold');
  fontsRegistered = true;
}

export function createPanelCanvas(width: number, height: number): { ctx: SKRSContext2D; toPng: () => Buffer } {
  ensureFontsRegistered();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'black';

  return { ctx, toPng: () => canvas.toBuffer('image/png') };
}

/**
 * Fills a rect with a sparse dot pattern (1px dot every `spacing`px) rather
 * than a grey fill - the panel is 1-bit at the driver, so a genuine grey
 * would just get thresholded away.
 */
export function ditherFill(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, spacing = 4) {
  for (let py = y; py < y + h; py += spacing) {
    for (let px = x; px < x + w; px += spacing) {
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

export function hairline(ctx: SKRSContext2D, x1: number, y: number, x2: number) {
  ctx.fillRect(x1, y, x2 - x1, 1);
}
