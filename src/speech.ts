/**
 * Where people talk in a stretch of audio, for Wyzie Synced ({@link syncSubtitle}).
 * The same detector sub.wyzie.io runs: band-limited loudness, a threshold that
 * follows the mix (quiet dialogue vs loud action), and only sound that rises
 * and falls with syllables.
 */

const FRAME_MS = 20;
const BLOCK = 250; // frames per threshold block (5 s)
const SPAN = 3; // blocks either side that set a block's threshold
const GAP_FRAMES = 15; // pauses up to 300 ms stay inside one segment
const MIN_FRAMES = 10; // blips under 200 ms are dropped
const MOD_FRAMES = 10; // ±200 ms around a frame for its loudness swing
const MIN_SWING_DB = 3;

function pct(sorted: Float32Array, p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/**
 * Detects speech in mono audio.
 *
 * @example
 * const ctx = new OfflineAudioContext(1, 8000, 8000);
 * const audio = await ctx.decodeAudioData(await file.arrayBuffer());
 * const speech = detectSpeech(audio.getChannelData(0), audio.sampleRate);
 *
 * @param {Float32Array | Int16Array} samples - Mono samples: floats in [-1, 1], or 16-bit PCM.
 * @param {number} sampleRate - Samples per second (8000 is plenty).
 * @returns {[number, number][]} Speech segments as [start, end] in seconds.
 */
export function detectSpeech(samples: Float32Array | Int16Array, sampleRate: number): [number, number][] {
  if (!(sampleRate > 0)) throw new Error("sampleRate must be a positive number");
  const frameLen = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const scale = samples instanceof Int16Array ? 1 / 32768 : 1;

  // 2nd-order high-pass at 250 Hz: drops hum, rumble and most music bass.
  const w0 = (2 * Math.PI * 250) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  const n = Math.floor(samples.length / frameLen) + (samples.length % frameLen >= frameLen / 2 ? 1 : 0);
  if (n === 0) return [];
  const e = new Float32Array(n);
  let acc = 0;
  let count = 0;
  let frame = 0;
  for (let i = 0; i < samples.length && frame < n; i++) {
    const x = samples[i] * scale;
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    acc += y * y;
    if (++count === frameLen || i === samples.length - 1) {
      e[frame++] = 10 * Math.log10(acc / count + 1e-12);
      acc = 0;
      count = 0;
    }
  }

  const gate = Math.max(pct(Float32Array.from(e).sort(), 0.1) + 6, -55);
  const blocks = Math.ceil(n / BLOCK);
  const thr = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    const win = e.slice(Math.max(0, (b - SPAN) * BLOCK), Math.min(n, (b + SPAN + 1) * BLOCK)).sort();
    const floor = pct(win, 0.15);
    const range = pct(win, 0.95) - floor;
    thr[b] = range < 9 ? Infinity : Math.max(gate, floor + Math.max(8, 0.4 * range));
  }

  const sum = new Float64Array(n + 1);
  const sq = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) {
    sum[k + 1] = sum[k] + e[k];
    sq[k + 1] = sq[k] + e[k] * e[k];
  }

  const out: [number, number][] = [];
  const push = (a: number, b: number) => {
    if (b - a >= MIN_FRAMES) out.push([(a * FRAME_MS) / 1000, (b * FRAME_MS) / 1000]);
  };
  let start = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (!(e[i] > thr[Math.floor(i / BLOCK)])) continue;
    const lo = Math.max(0, i - MOD_FRAMES);
    const hi = Math.min(n, i + MOD_FRAMES + 1);
    const mean = (sum[hi] - sum[lo]) / (hi - lo);
    if ((sq[hi] - sq[lo]) / (hi - lo) - mean * mean < MIN_SWING_DB * MIN_SWING_DB) continue;
    if (start >= 0 && i - last - 1 <= GAP_FRAMES) {
      last = i;
      continue;
    }
    if (start >= 0) push(start, last + 1);
    start = i;
    last = i;
  }
  if (start >= 0) push(start, last + 1);
  return out;
}
