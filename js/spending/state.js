// js/spending/state.js
import { safeParseJSON } from "../shared/storage.js";
import { CATEGORIES, LOCATIONS, SPENDING_KEY } from "./constants.js";

export const state = {
  locationId: LOCATIONS[0].id,
  incomeAnnual: 80000,

  // Streamlined UI defaults (fixed; no longer user-selectable in the UI)
  spendMode: "replacement",
  healthcareMode: "medicareStandard",
  taxMode: "manual",

  replacementRatePct: 75,
  values: {},
  include: Object.fromEntries(CATEGORIES.map(c => [c.key, true])),
  household: 2,
  housingMode: "ownMortgage",
  showAdvanced: false,
  annualize: true
};

export function normalizeSpendingState(){
  if (!state.include || typeof state.include !== "object") state.include = {};
  for (const cat of CATEGORIES){
    if (state.include[cat.key] === undefined) state.include[cat.key] = true;
    else state.include[cat.key] = !!state.include[cat.key];
  }

  if (!state.values || typeof state.values !== "object") state.values = {};
  for (const cat of CATEGORIES){
    const n = Number(state.values[cat.key] ?? 0);
    state.values[cat.key] = (isFinite(n) && n >= 0) ? n : 0;
  }

  const allowed = new Set(CATEGORIES.map(c => c.key));
  for (const k of Object.keys(state.values)) if (!allowed.has(k)) delete state.values[k];
  for (const k of Object.keys(state.include)) if (!allowed.has(k)) delete state.include[k];

  // Enforce streamlined defaults regardless of saved state
  state.spendMode = "replacement";
  state.healthcareMode = "medicareStandard";
  state.taxMode = "manual";
}

export function computeTotals(){
  let monthly = 0;
  for (const cat of CATEGORIES){
    if (!state.include[cat.key]) continue;
    monthly += Number(state.values[cat.key] || 0);
  }
  return { monthly, annual: monthly * 12 };
}

export function computeAdvancedSubtotal(){
  let monthly = 0;
  for (const cat of CATEGORIES){
    if (!cat.advanced) continue;
    if (!state.include[cat.key]) continue;
    monthly += Number(state.values[cat.key] || 0);
  }
  return { monthly, annual: monthly * 12 };
}

export function getAnnualSpending(){
  return computeTotals().annual;
}

export function loadSpendingState({ elInflation, elYears, elLastApplied }){
  let raw = null;
  try { raw = localStorage.getItem(SPENDING_KEY); } catch(e){ raw = null; }
  if (!raw) return false;

  const payload = safeParseJSON(raw);
  if (!payload || !payload.state) return false;

  const s = payload.state;
  state.locationId = s.locationId || state.locationId;
  state.incomeAnnual = Number(s.incomeAnnual ?? state.incomeAnnual);
  state.replacementRatePct = Number(s.replacementRatePct ?? state.replacementRatePct);
  state.values = (s.values && typeof s.values === "object") ? s.values : state.values;
  state.include = (s.include && typeof s.include === "object") ? s.include : state.include;
  state.household = Number(s.household ?? state.household);
  state.housingMode = s.housingMode || state.housingMode;
  state.showAdvanced = !!s.showAdvanced;
  state.annualize = !!s.annualize;

  normalizeSpendingState();

  if (payload.ui){
    if (elInflation) elInflation.value = String(payload.ui.inflationPreview ?? elInflation.value);
    if (elYears) elYears.value = String(payload.ui.yearsToRetire ?? elYears.value);
    if (elLastApplied && payload.ui.lastAppliedText) elLastApplied.textContent = payload.ui.lastAppliedText;
  }
  return true;
}

export function saveSpendingState({ elInflation, elYears, elLastApplied, emitChanged }){
  const payload = {
    version: 1,
    state: {
      locationId: state.locationId,
      incomeAnnual: state.incomeAnnual,
      spendMode: state.spendMode,
      replacementRatePct: state.replacementRatePct,
      values: state.values,
      include: state.include,
      household: state.household,
      housingMode: state.housingMode,
      healthcareMode: state.healthcareMode,
      taxMode: state.taxMode,
      showAdvanced: state.showAdvanced,
      annualize: state.annualize
    },
    ui: {
      inflationPreview: Number(elInflation?.value || 2.5),
      yearsToRetire: Number(elYears?.value || 0),
      lastAppliedText: elLastApplied?.textContent || ""
    },
    savedAt: new Date().toISOString()
  };

  try { localStorage.setItem(SPENDING_KEY, JSON.stringify(payload)); } catch(e){}
  if (typeof emitChanged === "function"){
    emitChanged({ annual: getAnnualSpending() });
  }
}

let __saveTimer = null;
export function saveSpendingStateDebounced(args){
  clearTimeout(__saveTimer);
  __saveTimer = setTimeout(() => saveSpendingState(args), 140);
}
