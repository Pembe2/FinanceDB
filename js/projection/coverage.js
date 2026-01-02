// js/projection/coverage.js
import { SPENDING_KEY } from "./constants.js";

/**
 * Return annual spending from the spending module if available; otherwise fallback
 * to parsing saved spending state from localStorage.
 */
export function getSpendingEstimatorAnnual({ spendingApi, safeParseJSON }){
  // Prefer in-memory API if provided
  try {
    if (spendingApi && typeof spendingApi.getAnnualSpending === "function") {
      const a = spendingApi.getAnnualSpending();
      if (isFinite(a)) return a;
    }
  } catch(e){}

  // Fallback to localStorage read
  let raw = null;
  try { raw = localStorage.getItem(SPENDING_KEY); } catch(e){ raw = null; }
  if (!raw) return null;

  const payload = safeParseJSON(raw);
  if (!payload || !payload.state) return null;

  const st = payload.state;
  const values = (st.values && typeof st.values === "object") ? st.values : null;
  const include = (st.include && typeof st.include === "object") ? st.include : null;
  if (!values || !include) return null;

  let monthly = 0;
  for (const k in values){
    if (!Object.prototype.hasOwnProperty.call(values,k)) continue;
    if (!include[k]) continue;
    const v = Number(values[k] || 0);
    if (isFinite(v) && v > 0) monthly += v;
  }
  return monthly * 12;
}
