export function clamp(n, min, max){
  n = Number(n);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function formatUSD0(n){
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style:"currency", currency:"USD", maximumFractionDigits:0 });
}

const dollarsFmt = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" });
export function formatDollars(n){
  return dollarsFmt.format(Number(n || 0));
}
