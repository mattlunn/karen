import { SKRSContext2D } from '@napi-rs/canvas';
import dayjs from '../../../../dayjs';
import { PriceSlot } from '../../../../helpers/prices';
import { createPanelCanvas, ditherFill, hairline } from '../../render/canvas';
import { ApplianceProfile, RowPlan, DelayBucket } from './plan';
import { scaleSparkline, SparklineData } from './sparkline';

export const WIDTH = 792;
export const HEIGHT = 272;

const MARGIN = 24;
const OPTIONS_START_X = 248;
const OPTIONS_END_X = WIDTH - MARGIN;
const OPTION_COUNT = 3;
const OPTION_WIDTH = (OPTIONS_END_X - OPTIONS_START_X) / OPTION_COUNT;
const ROW_HEIGHT = 68;
const HEADER_HEIGHT = 64;

// Matches the delay buckets, so the sparkline always covers what they plan against.
const SPARKLINE_WINDOW_HOURS = 12;
const SPARKLINE_X = 560;
const SPARKLINE_Y = 8;
const SPARKLINE_WIDTH = OPTIONS_END_X - SPARKLINE_X;
// Leaves clearance above the clock-time header labels below it.
const SPARKLINE_HEIGHT = 28;

export interface AppliancePanelRow {
  profile: ApplianceProfile;
  plan: RowPlan | null;
}

export interface AppliancePanelData {
  now: Date;
  priceSlots: PriceSlot[];
  rows: AppliancePanelRow[];
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function formatKwh(kwh: number): string {
  return `${kwh.toFixed(1)} kWh`;
}

function drawCentered(ctx: SKRSContext2D, text: string, x: number, baselineY: number, font: string) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, baselineY);
}

function drawLeft(ctx: SKRSContext2D, text: string, x: number, baselineY: number, font: string) {
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, baselineY);
}

function optionColumnX(index: number): number {
  return OPTIONS_START_X + index * OPTION_WIDTH;
}

function drawSparkline(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, data: SparklineData) {
  if (data.points.length === 0) {
    return;
  }

  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  data.points.forEach((p, i) => {
    if (i === 0) {
      ctx.moveTo(x + p.x, y + p.y);
    } else {
      ctx.lineTo(x + p.x, y + p.y);
    }
  });
  ctx.stroke();

  if (data.zeroY !== null) {
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(x, y + data.zeroY);
    ctx.lineTo(x + w, y + data.zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const nowPoint = data.points[0];

  ctx.beginPath();
  ctx.arc(x + nowPoint.x, y + nowPoint.y, 2.5, 0, 2 * Math.PI);
  ctx.fill();
}

function drawBucket(ctx: SKRSContext2D, index: number, top: number, bucket: DelayBucket) {
  const centerX = optionColumnX(index) + OPTION_WIDTH / 2;

  // No feasible option at all - nothing worth showing a number for.
  if (bucket.option === null) {
    drawCentered(ctx, '£££', centerX, top + 46, '28px "DejaVu Sans Bold"');

    return;
  }

  const { option } = bucket;

  // Checked ahead of "more expensive" below, so a tiny loss reads as "Same".
  if (option.isBelowNegligibleSavingsPence) {
    drawCentered(ctx, 'Same', centerX, top + 46, '28px "DejaVu Sans Bold"');

    return;
  }

  if (option.savingPercent < 0) {
    drawCentered(ctx, '£££', centerX, top + 46, '28px "DejaVu Sans Bold"');

    return;
  }

  drawCentered(ctx, `${option.dialHours}h`, centerX, top + 20, '16px "DejaVu Sans Bold"');
  drawCentered(ctx, `${option.savingPercent}%`, centerX, top + 46, '28px "DejaVu Sans Bold"');
  drawCentered(ctx, 'saved', centerX, top + 62, '14px "DejaVu Sans"');
}

function drawRow(ctx: SKRSContext2D, top: number, row: AppliancePanelRow) {
  const totalKwh = row.profile.powerProfileKwh.reduce((sum, v) => sum + v, 0);

  drawLeft(ctx, row.profile.label, MARGIN, top + 28, '20px "DejaVu Sans Bold"');
  drawLeft(ctx, `${formatDuration(row.profile.fullElapsedDuration)} · ${formatKwh(totalKwh)}`, MARGIN, top + 52, '18px "DejaVu Sans"');

  if (row.plan === null) {
    drawCentered(ctx, 'No price data for this cycle', (OPTIONS_START_X + OPTIONS_END_X) / 2, top + 40, '20px "DejaVu Sans"');

    return;
  }

  // Only highlight best when it meaningfully beats running now.
  const bestIndex = row.plan.best === null || row.plan.best.isBelowNegligibleSavingsPence || row.plan.best.savingPercent < 0
    ? -1
    : row.plan.buckets.findIndex(b => b.option === row.plan!.best);

  if (bestIndex !== -1) {
    ditherFill(ctx, optionColumnX(bestIndex), top, OPTION_WIDTH, ROW_HEIGHT);
  }

  row.plan.buckets.forEach((bucket, i) => drawBucket(ctx, i, top, bucket));
}

export function renderAppliancePanel(data: AppliancePanelData): Buffer {
  const { ctx, toPng } = createPanelCanvas(WIDTH, HEIGHT);

  drawLeft(ctx, 'Cheapest times to run', MARGIN, 34, '30px "DejaVu Sans Bold"');
  drawLeft(ctx, 'Finishing at', MARGIN, 56, '18px "DejaVu Sans"');

  const sparkline = scaleSparkline(data.priceSlots, data.now, SPARKLINE_WINDOW_HOURS, SPARKLINE_WIDTH, SPARKLINE_HEIGHT);

  drawSparkline(ctx, SPARKLINE_X, SPARKLINE_Y, SPARKLINE_WIDTH, SPARKLINE_HEIGHT, sparkline);
  hairline(ctx, MARGIN, HEADER_HEIGHT, WIDTH - MARGIN);

  // Bucket ranges are identical across rows in practice, so label once.
  const headerBuckets = data.rows.find(r => r.plan !== null)?.plan?.buckets;

  headerBuckets?.forEach((bucket, i) => {
    const from = dayjs(data.now).add(bucket.from, 'hour').format('HH:mm');
    const to = dayjs(data.now).add(bucket.to, 'hour').format('HH:mm');

    drawCentered(ctx, `${from}-${to}`, optionColumnX(i) + OPTION_WIDTH / 2, 54, '16px "DejaVu Sans"');
  });

  data.rows.forEach((row, i) => {
    const top = HEADER_HEIGHT + i * ROW_HEIGHT;

    drawRow(ctx, top, row);

    if (i < data.rows.length - 1) {
      hairline(ctx, MARGIN, top + ROW_HEIGHT, WIDTH - MARGIN);
    }
  });

  return toPng();
}
