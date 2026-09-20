import { SKRSContext2D } from '@napi-rs/canvas';
import dayjs from '../../../../dayjs';
import { PriceSlot } from '../../../../helpers/prices';
import { createPanelCanvas, ditherFill, hairline } from '../../render/canvas';
import { ApplianceProfile, RowPlan, BaselineComparison } from './plan';
import { scaleSparkline, SparklineData } from './sparkline';

export const WIDTH = 792;
export const HEIGHT = 272;

const MARGIN = 24;
const LABEL_END_X = 214;
const NOW_END_X = 334;
const OPTIONS_END_X = WIDTH - MARGIN;
const BUCKET_COUNT = 3;
const BUCKET_WIDTH = (OPTIONS_END_X - NOW_END_X) / BUCKET_COUNT;
const ROW_HEIGHT = 68;
const HEADER_HEIGHT = 64;

// Matches the delay buckets, so the sparkline always covers what they plan against.
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
  sparklineWindowHours: number;
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

function nowColumnX(): number {
  return (LABEL_END_X + NOW_END_X) / 2;
}

function bucketColumnX(index: number): number {
  return NOW_END_X + index * BUCKET_WIDTH + BUCKET_WIDTH / 2;
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

// A manual chevron - safer to render on an eInk font than relying on a
// Unicode arrow glyph being present in DejaVu Sans at small sizes.
function drawArrowDown(ctx: SKRSContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(cx - size, cy - size * 0.55);
  ctx.lineTo(cx + size, cy - size * 0.55);
  ctx.lineTo(cx, cy + size * 0.7);
  ctx.closePath();
  ctx.fill();
}

// Renders one cell of the grid - shared by the Now column (no dialHours) and
// each bucket column. £££ covers both "pricier than normal" and "nothing
// feasible in this window" (bucket.option === null), same as running now
// being a bad idea either way - no separate treatment needed.
const VALUE_FONT = '22px "DejaVu Sans Bold"';

// A bucket cell stacks a delay line above the value; a Now/uncostable cell is
// just the value alone. Each case is centered as its own block within the
// row, rather than the value sitting at a fixed offset regardless of what's
// above it.
function centeredValueY(top: number, hasDialLine: boolean): number {
  const rowCenterY = top + ROW_HEIGHT / 2;

  return hasDialLine ? rowCenterY + 16 : rowCenterY + 8;
}

function drawCell(ctx: SKRSContext2D, cx: number, top: number, cell: BaselineComparison, dialHours?: number) {
  const prefix = cell.isEstimated ? '~' : '';
  const valueY = centeredValueY(top, dialHours !== undefined);

  if (dialHours !== undefined) {
    drawCentered(ctx, `+${dialHours}h`, cx, top + ROW_HEIGHT / 2 - 8, '14px "DejaVu Sans"');
  }

  if (cell.isWithinNormalBand) {
    drawCentered(ctx, `${prefix}Normal`, cx, valueY, VALUE_FONT);

    return;
  }

  if (cell.pctVsBaseline > 0) {
    drawCentered(ctx, `${prefix}£££`, cx, valueY, VALUE_FONT);

    return;
  }

  ctx.font = VALUE_FONT;

  const numText = `${prefix}${Math.abs(cell.pctVsBaseline)}%`;
  const numWidth = ctx.measureText(numText).width;
  const arrowGap = 6;
  const arrowSize = 6;
  const totalWidth = numWidth + arrowGap + arrowSize * 2;
  const startX = cx - totalWidth / 2;

  drawArrowDown(ctx, startX + arrowSize, valueY - 8, arrowSize);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(numText, startX + arrowSize * 2 + arrowGap, valueY);
}

// bucket.option is null when a composed profile's downstream leg pushes
// every candidate dial's finish time out of this window (index.ts already
// backfills slots far enough that a short forecast isn't the cause) - shown
// as £££, same as a genuinely pricier option.
function drawUncostableBucketCell(ctx: SKRSContext2D, cx: number, top: number) {
  drawCentered(ctx, '£££', cx, centeredValueY(top, false), VALUE_FONT);
}

function drawRow(ctx: SKRSContext2D, top: number, row: AppliancePanelRow) {
  const totalKwh = row.profile.powerProfileKwh.reduce((sum, v) => sum + v, 0);

  drawLeft(ctx, row.profile.label, MARGIN, top + 28, '18px "DejaVu Sans Bold"');
  drawLeft(ctx, `${formatDuration(row.profile.fullElapsedDuration)} · ${formatKwh(totalKwh)}`, MARGIN, top + 52, '18px "DejaVu Sans"');

  if (row.plan === null) {
    drawCentered(ctx, 'No price data for this cycle', (LABEL_END_X + OPTIONS_END_X) / 2, top + 40, '20px "DejaVu Sans"');

    return;
  }

  const { plan } = row;
  const bestIsNow = plan.best !== null && plan.best === plan.now;
  const bestBucketIndex = plan.best === null ? -1 : plan.buckets.findIndex(b => b.option === plan.best);

  if (bestIsNow) {
    ditherFill(ctx, LABEL_END_X, top, NOW_END_X - LABEL_END_X, ROW_HEIGHT);
  } else if (bestBucketIndex !== -1) {
    ditherFill(ctx, NOW_END_X + bestBucketIndex * BUCKET_WIDTH, top, BUCKET_WIDTH, ROW_HEIGHT);
  }

  drawCell(ctx, nowColumnX(), top, plan.now);

  plan.buckets.forEach((bucket, i) => {
    const cx = bucketColumnX(i);

    if (bucket.option === null) {
      drawUncostableBucketCell(ctx, cx, top);
    } else {
      drawCell(ctx, cx, top, bucket.option, bucket.option.dialHours);
    }
  });
}

export function renderAppliancePanel(data: AppliancePanelData): Buffer {
  const { ctx, toPng } = createPanelCanvas(WIDTH, HEIGHT);

  drawLeft(ctx, 'Cheapest times to run', MARGIN, 34, '30px "DejaVu Sans Bold"');
  drawLeft(ctx, 'Finishing at', MARGIN, 56, '18px "DejaVu Sans"');

  const sparkline = scaleSparkline(data.priceSlots, data.now, data.sparklineWindowHours, SPARKLINE_WIDTH, SPARKLINE_HEIGHT);

  drawSparkline(ctx, SPARKLINE_X, SPARKLINE_Y, SPARKLINE_WIDTH, SPARKLINE_HEIGHT, sparkline);
  hairline(ctx, MARGIN, HEADER_HEIGHT, WIDTH - MARGIN);

  drawCentered(ctx, 'Now', nowColumnX(), 54, '16px "DejaVu Sans"');

  // Bucket ranges are identical across rows in practice, so label once.
  const headerBuckets = data.rows.find(r => r.plan !== null)?.plan?.buckets;

  headerBuckets?.forEach((bucket, i) => {
    const from = dayjs(data.now).add(bucket.from, 'hour').format('HH:mm');
    const to = dayjs(data.now).add(bucket.to, 'hour').format('HH:mm');

    drawCentered(ctx, `${from}-${to}`, bucketColumnX(i), 54, '16px "DejaVu Sans"');
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
