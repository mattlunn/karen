const SAMPLE_RATE = 22050;

const NOTES = [
  { frequency: 659.25, startSeconds: 0, lengthSeconds: 1.2 },
  { frequency: 523.25, startSeconds: 0.55, lengthSeconds: 1.8 }
];

let chimeUrl: string | null = null;

function renderChimeWav(): Blob {
  const totalSeconds = Math.max(...NOTES.map((note) => note.startSeconds + note.lengthSeconds));
  const sampleCount = Math.ceil(totalSeconds * SAMPLE_RATE);
  const samples = new Float32Array(sampleCount);

  for (const note of NOTES) {
    const start = Math.floor(note.startSeconds * SAMPLE_RATE);
    const length = Math.floor(note.lengthSeconds * SAMPLE_RATE);

    for (let i = 0; i < length && start + i < sampleCount; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.min(1, t / 0.005) * Math.exp(-3.2 * t);
      const tone = Math.sin(2 * Math.PI * note.frequency * t) + 0.35 * Math.sin(4 * Math.PI * note.frequency * t);

      samples[start + i] += 0.45 * envelope * tone;
    }
  }

  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, sampleCount * 2, true);
  samples.forEach((sample, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));

  return new Blob([buffer], { type: 'audio/wav' });
}

export function playChime() {
  chimeUrl ??= URL.createObjectURL(renderChimeWav());

  // Fully Kiosk's "autoplay audio" setting lets this play without a tap; a normal browser may refuse it.
  new Audio(chimeUrl).play().catch(() => {});
}
