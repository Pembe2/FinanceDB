// js/spending/main.js
import { emit } from "../shared/events.js";
import { computeDefaultsMonthly } from "./defaults.js";
import { state, normalizeSpendingState, loadSpendingState, saveSpendingStateDebounced } from "./state.js";
import { bindSpendingElements, initLocations, refreshMeta, render, wireEvents } from "./ui.js";

// ============================================================
// TAB 1: Spending Estimator (module)
// ============================================================

export function initSpending(){
  const el = bindSpendingElements();

  // Provide debounced save args (shared across handlers)
  el.__saveArgs = {
    elInflation: el.elInflation,
    elYears: el.elYears,
    elLastApplied: el.elLastApplied,
    emitChanged: (payload) => emit("spending:changed", payload)
  };

  initLocations(el);
  wireEvents(el);

  const loaded = loadSpendingState({
    elInflation: el.elInflation,
    elYears: el.elYears,
    elLastApplied: el.elLastApplied
  });

  if (!loaded){
    state.locationId = state.locationId;
    state.household = 2;
    state.incomeAnnual = 80000;
    state.spendMode = "replacement";
    state.healthcareMode = "medicareStandard";
    state.taxMode = "manual";
    state.replacementRatePct = 75;
    state.housingMode = "ownMortgage";
    state.showAdvanced = false;
    state.annualize = true;

    const out = computeDefaultsMonthly({
      incomeAnnual: state.incomeAnnual,
      mode: state.spendMode,
      replacementRatePct: state.replacementRatePct,
      householdSize: state.household,
      housingMode: state.housingMode,
      healthcareMode: state.healthcareMode,
      taxMode: state.taxMode,
      locationFactor: 1
    });
    state.values = out.valuesMonthly;
    normalizeSpendingState();
    el.elLastApplied.textContent = "Defaults: applied (no location factor)";
  } else {
    normalizeSpendingState();
  }

  el.elShowAdvanced.checked = !!state.showAdvanced;
  el.elAnnualize.checked = !!state.annualize;

  el.elHousehold.value = state.household;
  el.elIncome.value = state.incomeAnnual;
  el.elReplacementRate.value = state.replacementRatePct;
  el.elReplacementRateLabel.textContent = `${state.replacementRatePct}% target`;
  el.elHousingMode.value = state.housingMode;

  el.elLocation.value = state.locationId;
  refreshMeta(el);

  render(el);
  if (!loaded) saveSpendingStateDebounced(el.__saveArgs);

  // initial emit for coverage consumers
  emit("spending:changed", { annual: getAnnualSpending() });

  return { getAnnualSpending };
}

import { getAnnualSpending } from "./state.js";
