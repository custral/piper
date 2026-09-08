/**
 * Fake "middle-out" compression.
 *
 * The demo never touches the bytes — we only compute a Weissman-score-flavored
 * ratio that's deterministic per file size so the same file always reports the
 * same numbers across reloads.
 */

const MIN_RATIO = 2.5;
const MAX_RATIO = 4.5;

function pseudoRandom(seed: number): number {
  // Mulberry32 — a small, deterministic PRNG.
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface CompressionResult {
  originalBytes: number;
  compressedBytes: number;
  ratio: number;
  weissmanScore: number;
}

export function simulateCompression(originalBytes: number, fileName: string): CompressionResult {
  if (originalBytes <= 0) {
    return {originalBytes: 0, compressedBytes: 0, ratio: 1, weissmanScore: 0};
  }
  // Seed by filename + size so the same file deterministically yields the same ratio.
  const seed = [...fileName].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), originalBytes) | 0;
  const span = MAX_RATIO - MIN_RATIO;
  const ratio = MIN_RATIO + pseudoRandom(seed) * span;
  const compressedBytes = Math.max(1, Math.round(originalBytes / ratio));
  // Pied Piper's Weissman lookalike — an arbitrary positive number that scales
  // with ratio. The show used 2.89 as Pied Piper's headline score; we lean the
  // simulation toward that range.
  const weissmanScore = Math.round((ratio * 0.95 + Math.log10(originalBytes + 1) * 0.18) * 100) / 100;
  return {originalBytes, compressedBytes, ratio: Math.round(ratio * 100) / 100, weissmanScore};
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
