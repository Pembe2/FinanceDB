// js/spending/ui.js
import { clamp, formatUSD0 as money } from "../shared/format.js";
import { CATEGORIES, LOCATIONS, REGION_ORDER } from "./constants.js";
import { computeDefaultsMonthly, getLocationById, pickBand } from "./defaults.js";
import { computeTotals, computeAdvancedSubtotal, normalizeSpendingState, state, getAnnualSpending, saveSpendingStateDebounced } from "./state.js";

/**
 * Bind DOM elements used by spending module.
 */
export function bindSpendingElements(){
  const el = {
    elLocation: document.getElementById("location"),
    elRows: document.getElementById("rows"),
    elMeta: document.getElementById("locationMeta"),
    elLastApplied: document.getElementById("lastApplied"),
    elHousehold: document.getElementById("household"),
    elIncome: document.getElementById("householdIncome"),
    elReplacementRate: document.getElementById("replacementRate"),
    elReplacementRateLabel: document.getElementById("replacementRateLabel"),
    elHousingMode: document.getElementById("housingMode"),
    elShowAdvanced: document.getElementById("showAdvanced"),
    elAnnualize: document.getElementById("annualize"),
    elModeSummary: document.getElementById("modeSummary"),

    elTotalMonthly: document.getElementById("totalMonthly"),
    elTotalAnnual: document.getElementById("totalAnnual"),
    elPerPerson: document.getElementById("perPerson"),
    elAvgDaily: document.getElementById("avgDaily"),

    elInflation: document.getElementById("inflation"),
    elYears: document.getElementById("years"),
    elFutureMonthly: document.getElementById("futureMonthly"),
    elFutureAnnual: document.getElementById("futureAnnual"),

    elDownloadJson: document.getElementById("downloadJson"),
    elAdvancedSubtotalPill: document.getElementById("advancedSubtotalPill"),

    btnApplyDefaults: document.getElementById("applyDefaults"),
    btnResetNational: document.getElementById("resetNational")
  };

  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  el.canvas = canvas;
  el.ctx = ctx;

  return el;
}

export function initLocations(el){
  el.elLocation.innerHTML = "";
  const orderIndex = Object.fromEntries(REGION_ORDER.map((r,i)=>[r,i]));
  const sorted = [...LOCATIONS].sort((a,b)=>{
    const ra = orderIndex[a.region] ?? 999;
    const rb = orderIndex[b.region] ?? 999;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  let currentRegion = null;
  let currentOptGroup = null;

  for (const loc of sorted){
    if (loc.region !== currentRegion){
      currentRegion = loc.region;
      currentOptGroup = document.createElement("optgroup");
      currentOptGroup.label = currentRegion;
      el.elLocation.appendChild(currentOptGroup);
    }
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = loc.name;
    currentOptGroup.appendChild(opt);
  }

  el.elLocation.value = state.locationId;
  refreshMeta(el);
}

export function refreshMeta(el){
  const loc = getLocationById(state.locationId);
  el.elMeta.textContent = `Location factor: ${loc.factor.toFixed(2)} • Region: ${loc.region}`;
}

function renderRows(el){
  el.elRows.innerHTML = "";
  const showAdv = state.showAdvanced;

  function addSection(title, hintText){
    const tr = document.createElement("tr");
    tr.className = "sectionRow";
    const td = document.createElement("td");
    td.colSpan = 4;
    td.innerHTML = `${title} <span class="hint">— ${hintText}</span>`;
    tr.appendChild(td);
    el.elRows.appendChild(tr);
  }

  function addCategoryRow(cat){
    const tr = document.createElement("tr");

    const tdCat = document.createElement("td");
    tdCat.style.display = "flex";
    tdCat.style.gap = "10px";
    tdCat.style.alignItems = "center";

    const dot = document.createElement("span");
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "999px";
    dot.style.boxShadow = "0 0 0 3px rgba(255,255,255,.10)";
    dot.style.flex = "none";
    dot.style.background = cat.color;

    const label = document.createElement("div");
    const fixedTag = cat.fixed ? "fixed" : "variable";
    label.innerHTML = `<div>${cat.label}</div><div class="small muted">${cat.key} • ${fixedTag}</div>`;
    tdCat.appendChild(dot);
    tdCat.appendChild(label);

    const tdInc = document.createElement("td");
    const incWrap = document.createElement("div");
    incWrap.className = "toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!state.include[cat.key];
    cb.addEventListener("change", () => {
      state.include[cat.key] = cb.checked;
      render(el);
      saveSpendingStateDebounced(el.__saveArgs);
    });

    const cbl = document.createElement("label");
    cbl.textContent = "Include";
    incWrap.appendChild(cb);
    incWrap.appendChild(cbl);
    tdInc.appendChild(incWrap);

    const tdMon = document.createElement("td");
    tdMon.className = "right";
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.step = "10";
    inp.value = Math.round(state.values[cat.key] || 0);
    inp.style.width = "130px";

    const tdAnn = document.createElement("td");
    tdAnn.className = "right";
    tdAnn.textContent = state.annualize ? money((Number(state.values[cat.key] || 0) * 12)) : "—";

    inp.addEventListener("input", () => {
      const val = clamp(inp.value, 0, 1_000_000);
      state.values[cat.key] = val;

      tdAnn.textContent = state.annualize ? money(val * 12) : "—";
      renderTotals(el);
      drawChart(el);
      renderFuture(el);

      saveSpendingStateDebounced(el.__saveArgs);
    });

    tdMon.appendChild(inp);

    tr.appendChild(tdCat);
    tr.appendChild(tdInc);
    tr.appendChild(tdMon);
    tr.appendChild(tdAnn);
    el.elRows.appendChild(tr);
  }

  const fixedCats = CATEGORIES.filter(c => c.fixed);
  const varCats = CATEGORIES.filter(c => !c.fixed);

  addSection("Fixed-ish costs", "Generally less sensitive to household size; validate housing/healthcare/taxes");
  for (const cat of fixedCats){
    if (!cat.advanced || showAdv) addCategoryRow(cat);
  }

  addSection("Variable costs", "More sensitive to household size and lifestyle choices");
  for (const cat of varCats){
    if (!cat.advanced || showAdv) addCategoryRow(cat);
  }

  if (!showAdv){
    addSection("Advanced categories", "Hidden — totals still include them. Enable “Show advanced categories” to edit.");
  }
}

function renderTotals(el){
  const { monthly, annual } = computeTotals();
  el.elTotalMonthly.textContent = money(monthly);
  el.elTotalAnnual.textContent = money(annual);

  const perPerson = monthly / Math.max(1, Number(state.household || 1));
  el.elPerPerson.textContent = `~ ${money(perPerson)} per person / month`;

  const daily = annual / 365;
  el.elAvgDaily.textContent = `~ ${money(daily)} per day`;

  const adv = computeAdvancedSubtotal();
  el.elAdvancedSubtotalPill.textContent = state.annualize
    ? `Advanced subtotal: ${money(adv.monthly)} / mo • ${money(adv.annual)} / yr`
    : `Advanced subtotal: ${money(adv.monthly)} / mo`;
}

function renderFuture(el){
  const { monthly, annual } = computeTotals();
  const r = clamp(el.elInflation.value, 0, 12) / 100;
  const y = clamp(el.elYears.value, 0, 50);
  const factor = Math.pow(1 + r, y);
  const futM = Math.round(monthly * factor);
  const futA = Math.round(annual * factor);
  el.elFutureMonthly.textContent = money(futM);
  el.elFutureAnnual.textContent = state.annualize ? `${money(futA)} per year` : "—";
}

function drawChart(el){
  const { monthly } = computeTotals();
  const { ctx, canvas } = el;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(234,240,255,.92)";
  ctx.fillText("Monthly Spending Breakdown", 12, 22);

  if (monthly <= 0){
    ctx.fillStyle = "rgba(138,160,198,.9)";
    ctx.fillText("No categories included.", 12, 48);
    return;
  }

  const segments = [];
  for (const cat of CATEGORIES){
    if (!state.include[cat.key]) continue;
    const v = Number(state.values[cat.key] || 0);
    if (v <= 0) continue;
    segments.push({ label: cat.label, value: v, color: cat.color });
  }
  segments.sort((a,b)=>b.value-a.value);

  const cx = 165, cy = 185, radius = 110;
  let start = -Math.PI / 2;
  for (const seg of segments){
    const angle = (seg.value / monthly) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    start += angle;
  }

  const lx = 320, ly = 60;
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  let y = ly;
  for (const seg of segments.slice(0, 8)){
    const pct = (seg.value / monthly) * 100;
    ctx.fillStyle = seg.color;
    ctx.fillRect(lx, y - 9, 10, 10);
    ctx.fillStyle = "rgba(234,240,255,.92)";
    ctx.fillText(`${seg.label.split(" (")[0]}: ${money(seg.value)} (${pct.toFixed(0)}%)`, lx + 16, y);
    y += 18;
  }
  if (segments.length > 8){
    ctx.fillStyle = "rgba(138,160,198,.9)";
    ctx.fillText(`+ ${segments.length - 8} more`, lx + 16, y);
  }
}

function exportJson(){
  const loc = getLocationById(state.locationId);
  const payload = {
    version: "site-modular-1",
    timestamp: new Date().toISOString(),
    location: loc,
    assumptions: {
      household: state.household,
      householdIncomeAnnual: state.incomeAnnual,
      spendMode: state.spendMode,
      replacementRatePct: state.replacementRatePct,
      housingMode: state.housingMode,
      healthcareMode: state.healthcareMode,
      taxMode: state.taxMode
    },
    include: state.include,
    valuesMonthly: state.values
  };

  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "retirement-spending-estimate.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function applyDefaults(el, useLocationFactor){
  normalizeSpendingState();
  const loc = getLocationById(state.locationId);
  const locFactor = useLocationFactor ? loc.factor : 1;

  const out = computeDefaultsMonthly({
    incomeAnnual: state.incomeAnnual,
    mode: state.spendMode,
    replacementRatePct: state.replacementRatePct,
    householdSize: state.household,
    housingMode: state.housingMode,
    healthcareMode: state.healthcareMode,
    taxMode: state.taxMode,
    locationFactor: locFactor
  });

  state.values = out.valuesMonthly;
  normalizeSpendingState();

  const modeText = `Replacement-rate mode: ${state.replacementRatePct}% of income`;
  el.elModeSummary.textContent = `${modeText} • Band: ${out.bandName} • Target: ${money(out.targetAnnual)} / yr`;

  el.elLastApplied.textContent = useLocationFactor
    ? `Defaults: applied (${loc.name})`
    : `Defaults: applied (no location factor)`;

  render(el);
  saveSpendingStateDebounced(el.__saveArgs);
}

export function render(el){
  refreshMeta(el);
  normalizeSpendingState();
  renderRows(el);
  renderTotals(el);
  drawChart(el);
  renderFuture(el);

  el.elReplacementRateLabel.textContent = `${state.replacementRatePct}% target`;

  const band = pickBand(state.incomeAnnual);
  const targetAnnual = state.incomeAnnual * (state.replacementRatePct/100);
  el.elModeSummary.textContent = `Replacement-rate mode: ${state.replacementRatePct}% of income • Band: ${band.name} • Target: ${money(targetAnnual)} / yr`;
}

export function wireEvents(el){
  el.btnApplyDefaults.addEventListener("click", () => applyDefaults(el, true));
  el.btnResetNational.addEventListener("click", () => applyDefaults(el, false));

  el.elLocation.addEventListener("change", () => {
    state.locationId = el.elLocation.value;
    refreshMeta(el);
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elHousehold.addEventListener("input", () => {
    state.household = clamp(el.elHousehold.value, 1, 6);
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elIncome.addEventListener("input", () => {
    state.incomeAnnual = clamp(el.elIncome.value, 0, 100_000_000);
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elReplacementRate.addEventListener("input", () => {
    state.replacementRatePct = clamp(el.elReplacementRate.value, 0, 200);
    el.elReplacementRateLabel.textContent = `${state.replacementRatePct}% target`;
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elHousingMode.addEventListener("change", () => {
    state.housingMode = el.elHousingMode.value;
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elShowAdvanced.addEventListener("change", () => {
    state.showAdvanced = el.elShowAdvanced.checked;
    render(el);
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elAnnualize.addEventListener("change", () => {
    state.annualize = el.elAnnualize.checked;
    render(el);
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elInflation.addEventListener("input", () => {
    renderFuture(el);
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elYears.addEventListener("input", () => {
    renderFuture(el);
    saveSpendingStateDebounced(el.__saveArgs);
  });

  el.elDownloadJson.addEventListener("click", exportJson);
}

// expose for other modules if desired
export function renderTotalsAndChart(el){
  renderTotals(el);
  drawChart(el);
}
export function renderFuturePreview(el){
  renderFuture(el);
}
