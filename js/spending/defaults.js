// js/spending/defaults.js
import { clamp } from "../shared/format.js";
import { ALLOC_BANDS, CATEGORIES, FACTOR_WEIGHTS, LOCATIONS } from "./constants.js";

export function householdScalar(n){
  n = Math.max(1, Math.min(6, Number(n || 2)));
  const map = {1:0.80,2:1.00,3:1.18,4:1.34,5:1.48,6:1.60};
  return map[n] ?? 1.00;
}

export function pickBand(incomeAnnual){
  const inc = Math.max(0, Number(incomeAnnual || 0));
  for (const b of ALLOC_BANDS){
    if (inc >= b.min && inc < b.max) return b;
  }
  return ALLOC_BANDS[1];
}

export function estimateTaxesAnnualSimple(targetAnnual, locFactor){
  const x = Math.max(0, Number(targetAnnual || 0));
  let rate = 0.10;
  if (x < 50000) rate = 0.08;
  else if (x < 100000) rate = 0.10;
  else if (x < 200000) rate = 0.12;
  else rate = 0.14;

  const lf = Number(locFactor || 1);
  const adj = clamp((lf - 1) * 0.02, -0.03, 0.03);
  rate = clamp(rate + adj, 0.05, 0.20);

  return x * rate;
}

export function getLocationById(id){
  return LOCATIONS.find(l => l.id === id) || LOCATIONS[0];
}

export function computeDefaultsMonthly({ incomeAnnual, mode, replacementRatePct, householdSize, housingMode, healthcareMode, taxMode, locationFactor }){
  const inc = clamp(incomeAnnual, 0, 100_000_000);
  const rr = clamp(replacementRatePct, 0, 200) / 100;
  const loc = Number(locationFactor || 1);

  const targetAnnual = (mode === "replacement") ? (inc * rr) : inc;
  const targetMonthly = targetAnnual / 12;

  const band = pickBand(inc);
  const p = band.pcts;

  const v = {};
  for (const cat of CATEGORIES){
    const pct = p[cat.key] ?? 0;
    v[cat.key] = targetMonthly * pct;
  }

  for (const cat of CATEGORIES){
    const w = FACTOR_WEIGHTS[cat.key] ?? 0.7;
    const factor = 1 + (loc - 1) * w;
    v[cat.key] = v[cat.key] * factor;
  }

  if (housingMode === "ownNoMortgage") v.housing *= 0.62;
  if (housingMode === "rent") v.housing *= 1.05;

  if (healthcareMode === "medicareLean") v.healthcare *= 0.82;
  if (healthcareMode === "medicareRich") v.healthcare *= 1.20;

  const h = householdScalar(householdSize);
  for (const cat of CATEGORIES){
    if (cat.fixed) continue;
    if (cat.key === "food") v[cat.key] *= h;
    else if (cat.key === "transport") v[cat.key] *= (1 + (h - 1) * 0.55);
    else if (cat.key === "leisure") v[cat.key] *= (1 + (h - 1) * 0.45);
    else if (cat.key === "gifts") v[cat.key] *= (1 + (h - 1) * 0.40);
    else if (cat.key === "other") v[cat.key] *= (1 + (h - 1) * 0.35);
    else v[cat.key] *= (1 + (h - 1) * 0.30);
  }

  if (taxMode === "estimate"){
    const totalTaxA = estimateTaxesAnnualSimple(targetAnnual, loc);
    v.incomeTax = totalTaxA/12;
  }

  for (const k of Object.keys(v)) v[k] = Math.round(v[k]);
  return { valuesMonthly: v, bandName: band.name, targetAnnual };
}
