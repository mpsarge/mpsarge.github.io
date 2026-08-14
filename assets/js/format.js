export function fmtNum(n, decimals = 0) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtLb(n) {
  return `${fmtNum(n)} lb`;
}

export function fmtVol(n) {
  return `${fmtNum(n, 1)} cu ft`;
}

export function fmtW(n) {
  return `${fmtNum(n)} W`;
}

export function fmtBtu(n) {
  return `${fmtNum(n)} BTU/hr`;
}

export function fmtKw(n, decimals = 1) {
  return `${fmtNum(n, decimals)} kW`;
}

export function fmtPct(n, decimals = 0) {
  return `${fmtNum(n * 100, decimals)}%`;
}

export function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/** Numeric value of a possibly-in-progress raw input string, falling back when it's empty/invalid. */
export function numOr(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function toInt(raw, fallback = 0) {
  return Math.max(0, Math.floor(numOr(raw, fallback)));
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
