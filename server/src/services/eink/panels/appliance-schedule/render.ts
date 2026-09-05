import { SKRSContext2D } from '@napi-rs/canvas';
import dayjs from '../../../../dayjs';
import { createPanelCanvas, ditherFill, hairline } from '../../render/canvas';
import { ApplianceProfile, RowPlan, DelayOption } from './plan';

export const WIDTH = 792;
export const HEIGHT = 272;

const MARGIN = 24;
const OPTIONS_START_X = 248;
const OPTIONS_END_X = WIDTH - MARGIN;
const OPTION_COUNT = 4;
const OPTION_WIDTH = (OPTIONS_END_X - OPTIONS_START_X) / OPTION_COUNT;
const ROW_HEIGHT = 68;
const HEADER_HEIGHT = 64;

export interface AppliancePanelRow {
  profile: ApplianceProfile;
  plan: RowPlan | null;
}

export interface AppliancePanelData {
  now: Date;
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

function drawOption(ctx: SKRSContext2D, index: number, top: number, option: DelayOption) {
  const centerX = optionColumnX(index) + OPTION_WIDTH / 2;

  drawCentered(ctx, `${option.hours}h`, centerX, top + 20, '16px "DejaVu Sans Bold"');
  drawCentered(ctx, `${Math.abs(option.savingPercent)}%`, centerX, top + 46, '28px "DejaVu Sans Bold"');
  drawCentered(ctx, option.savingPercent >= 0 ? 'saved' : 'extra', centerX, top + 62, '14px "DejaVu Sans"');
}

function drawRow(ctx: SKRSContext2D, top: number, row: AppliancePanelRow) {
  const totalKwh = row.profile.powerProfileKwh.reduce((sum, v) => sum + v, 0);

  drawLeft(ctx, row.profile.label, MARGIN, top + 28, '20px "DejaVu Sans Bold"');
  drawLeft(ctx, `${formatDuration(row.profile.cycleMinutes)} · ${formatKwh(totalKwh)}`, MARGIN, top + 52, '18px "DejaVu Sans"');

  if (row.plan === null) {
    drawCentered(ctx, 'No price data for this cycle', (OPTIONS_START_X + OPTIONS_END_X) / 2, top + 40, '20px "DejaVu Sans"');
    return;
  }

  const bestIndex = row.plan.options.findIndex(o => o.hours === row.plan!.best.hours);

  if (bestIndex !== -1) {
    ditherFill(ctx, optionColumnX(bestIndex), top, OPTION_WIDTH, ROW_HEIGHT);
  }

  row.plan.options.forEach((option, i) => drawOption(ctx, i, top, option));
}

export function renderAppliancePanel(data: AppliancePanelData): Buffer {
  const { ctx, toPng } = createPanelCanvas(WIDTH, HEIGHT);

  drawLeft(ctx, 'Cheapest times to run', MARGIN, 34, '30px "DejaVu Sans Bold"');
  drawLeft(ctx, `Updated ${dayjs(data.now).format('HH:mm')}`, MARGIN, 56, '18px "DejaVu Sans"');
  hairline(ctx, MARGIN, HEADER_HEIGHT, WIDTH - MARGIN);

  data.rows.forEach((row, i) => {
    const top = HEADER_HEIGHT + i * ROW_HEIGHT;

    drawRow(ctx, top, row);

    if (i < data.rows.length - 1) {
      hairline(ctx, MARGIN, top + ROW_HEIGHT, WIDTH - MARGIN);
    }
  });

  return toPng();
}
