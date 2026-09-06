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

// Rolling window both the delay buckets and the sparkline describe - kept in
// sync so the line above the table always matches what the columns are
// planning against.
const SPARKLINE_WINDOW_HOURS = 12;
const SPARKLINE_X = 560;
const SPARKLINE_Y = 8;
const SPARKLINE_WIDTH = OPTIONS_END_X - SPARKLINE_X;
// Clock-time header labels ("08:47-11:47") sit right below this and need
// clear vertical space above them, so the sparkline stays shorter than the
// full available header height.
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

  // Close enough to running now that a percentage would just be noise - near
  // a near-zero costNowPence, a few pence either way is a huge percent, in
  // either direction. Checked ahead of the "more expensive" case below, so a
  // tiny loss reads as "Same" rather than the same £££ as a real one.
  if (option.negligible) {
    drawCentered(ctx, 'Same', centerX, top + 46, '28px "DejaVu Sans Bold"');

    return;
  }

  // The cheapest option available still costs more than running right now.
  if (option.savingPercent < 0) {
    drawCentered(ctx, '£££', centerX, top + 46, '28px "DejaVu Sans Bold"');

    return;
  }

  drawCentered(ctx, `${option.hours}h`, centerX, top + 20, '16px "DejaVu Sans Bold"');
  drawCentered(ctx, `${option.savingPercent}%`, centerX, top + 46, '28px "DejaVu Sans Bold"');
  drawCentered(ctx, 'saved', centerX, top + 62, '14px "DejaVu Sans"');
}

function drawRow(ctx: SKRSContext2D, top: number, row: AppliancePanelRow) {
  const totalKwh = row.profile.powerProfileKwh.reduce((sum, v) => sum + v, 0);

  drawLeft(ctx, row.profile.label, MARGIN, top + 28, '20px "DejaVu Sans Bold"');
  drawLeft(ctx, `${formatDuration(row.profile.cycleMinutes)} · ${formatKwh(totalKwh)}`, MARGIN, top + 52, '18px "DejaVu Sans"');

  if (row.plan === null) {
    drawCentered(ctx, 'No price data for this cycle', (OPTIONS_START_X + OPTIONS_END_X) / 2, top + 40, '20px "DejaVu Sans"');

    return;
  }

  // best is just the lowest-cost bucket, regardless of whether that cost
  // actually beats running now by a meaningful amount - only highlight it
  // when it does, otherwise every bucket is showing £££ or "Same" and
  // there's nothing genuinely "cheapest" to point to.
  const bestIndex = row.plan.best === null || row.plan.best.negligible || row.plan.best.savingPercent < 0
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

  // Bucket ranges are identical across rows in practice (every appliance
  // shares the same [delayMinHours, delayMaxHours]), so the header labels
  // the columns once from whichever row has a plan, rather than per row.
  // Shown as clock times ("02:30-05:30") rather than hours-from-now, since
  // "when will the whole run finish" is the question the columns answer.
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
