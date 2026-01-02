import { emit } from "../shared/events.js";
import { clamp, formatUSD0 as money } from "../shared/format.js";
import { safeParseJSON } from "../shared/storage.js";

// ============================================================
// TAB 1: Spending Estimator (module)
// ============================================================

const LOCATIONS = [
  { id:"portland_me", name:"Portland, ME", factor:1.12, region:"Northeast" },
  { id:"portsmouth_nh", name:"Portsmouth, NH", factor:1.22, region:"Northeast" },
  { id:"burlington_vt", name:"Burlington, VT", factor:1.15, region:"Northeast" },
  { id:"concord_nh", name:"Concord, NH", factor:1.10, region:"Northeast" },
  { id:"berkshires_ma", name:"Berkshires (Pittsfield), MA", factor:1.12, region:"Northeast" },
  { id:"worcester_ma", name:"Worcester, MA", factor:1.15, region:"Northeast" },
  { id:"providence_ri", name:"Providence, RI", factor:1.12, region:"Northeast" },
  { id:"mystic_ct", name:"Mystic / SE Connecticut, CT", factor:1.18, region:"Northeast" },

  { id:"albany_ny", name:"Albany / Capital Region, NY", factor:1.06, region:"Mid-Atlantic" },
  { id:"hudson_valley_ny", name:"Hudson Valley, NY", factor:1.18, region:"Mid-Atlantic" },
  { id:"buffalo_ny", name:"Buffalo / Amherst, NY", factor:0.93, region:"Mid-Atlantic" },
  { id:"philadelphia_pa", name:"Philadelphia suburbs, PA", factor:1.08, region:"Mid-Atlantic" },
  { id:"lancaster_pa", name:"Lancaster, PA", factor:0.98, region:"Mid-Atlantic" },
  { id:"virginia_beach_va", name:"Virginia Beach, VA", factor:1.02, region:"Mid-Atlantic" },

  { id:"asheville_nc", name:"Asheville, NC", factor:1.02, region:"Southeast" },
  { id:"wilmington_nc", name:"Wilmington, NC", factor:1.06, region:"Southeast" },
  { id:"charleston_sc", name:"Charleston, SC", factor:1.10, region:"Southeast" },
  { id:"greenville_sc", name:"Greenville, SC", factor:0.98, region:"Southeast" },
  { id:"savannah_ga", name:"Savannah, GA", factor:1.01, region:"Southeast" },
  { id:"atlanta_suburbs_ga", name:"North Atlanta suburbs, GA", factor:1.08, region:"Southeast" },
  { id:"st_petersburg_fl", name:"St. Petersburg, FL", factor:1.10, region:"Southeast" },
  { id:"sarasota_fl", name:"Sarasota, FL", factor:1.12, region:"Southeast" },
  { id:"naples_fl", name:"Naples, FL", factor:1.30, region:"Southeast" },
  { id:"the_villages_fl", name:"The Villages, FL", factor:1.06, region:"Southeast" },

  { id:"madison_wi", name:"Madison, WI", factor:1.03, region:"Midwest" },
  { id:"milwaukee_wi", name:"Milwaukee, WI", factor:0.98, region:"Midwest" },
  { id:"grand_rapids_mi", name:"Grand Rapids, MI", factor:0.96, region:"Midwest" },
  { id:"ann_arbor_mi", name:"Ann Arbor, MI", factor:1.10, region:"Midwest" },
  { id:"columbus_oh", name:"Columbus, OH", factor:0.98, region:"Midwest" },
  { id:"cincinnati_oh", name:"Cincinnati, OH", factor:0.95, region:"Midwest" },
  { id:"indianapolis_in", name:"Indianapolis, IN", factor:0.93, region:"Midwest" },
  { id:"kansas_city_mo", name:"Kansas City, MO", factor:0.92, region:"Midwest" },

  { id:"scottsdale_az", name:"Scottsdale, AZ", factor:1.18, region:"Southwest" },
  { id:"tucson_az", name:"Tucson, AZ", factor:0.92, region:"Southwest" },
  { id:"albuquerque_nm", name:"Albuquerque, NM", factor:0.92, region:"Southwest" },
  { id:"santa_fe_nm", name:"Santa Fe, NM", factor:1.12, region:"Southwest" },
  { id:"el_paso_tx", name:"El Paso, TX", factor:0.90, region:"Southwest" },
  { id:"las_cruces_nm", name:"Las Cruces, NM", factor:0.88, region:"Southwest" },

  { id:"palm_springs_ca", name:"Palm Springs, CA", factor:1.24, region:"West" },
  { id:"san_diego_ca", name:"San Diego, CA", factor:1.42, region:"West" },
  { id:"sacramento_ca", name:"Sacramento, CA", factor:1.18, region:"West" },
  { id:"las_vegas_nv", name:"Las Vegas / Henderson, NV", factor:1.03, region:"West" },
  { id:"reno_nv", name:"Reno, NV", factor:1.10, region:"West" },
  { id:"phoenix_az", name:"Phoenix, AZ", factor:1.05, region:"West" },

  { id:"portland_or", name:"Portland, OR", factor:1.16, region:"Northwest" },
  { id:"eugene_or", name:"Eugene, OR", factor:1.05, region:"Northwest" },
  { id:"spokane_wa", name:"Spokane, WA", factor:1.02, region:"Northwest" },

  { id:"denver_co", name:"Denver / Front Range, CO", factor:1.18, region:"Mountains" },
  { id:"boise_id", name:"Boise, ID", factor:1.05, region:"Mountains" },
  { id:"salt_lake_ut", name:"Salt Lake City, UT", factor:1.08, region:"Mountains" }
];

const CATEGORIES = [
  { key:"housing",      label:"Housing (rent/mortgage/HOA)", color:"#7aa2ff", advanced:false, fixed:true },
  { key:"utilities",    label:"Utilities (electric, water, internet)", color:"#58d1a7", advanced:false, fixed:true },
  { key:"food",         label:"Food (groceries + dining)", color:"#ffcc66", advanced:false, fixed:false },
  { key:"transport",    label:"Transportation (fuel, maintenance, transit)", color:"#c792ea", advanced:false, fixed:false },
  { key:"healthcare",   label:"Healthcare (premiums + out-of-pocket)", color:"#ff6b6b", advanced:false, fixed:true },
  { key:"leisure",      label:"Leisure & Travel", color:"#4fd1c5", advanced:false, fixed:false },
  { key:"insurance",    label:"Insurance (home/auto/umbrella)", color:"#a0aec0", advanced:true, fixed:true },
  { key:"incomeTax",    label:"Income Tax (federal/state/local)", color:"#e2e8f0", advanced:true, fixed:true },
  { key:"gifts",        label:"Gifts & Charity", color:"#f687b3", advanced:false, fixed:false },
  { key:"other",        label:"Other / Cushion", color:"#fbd38d", advanced:true, fixed:false }
];

const FACTOR_WEIGHTS = {
  housing:1.25, utilities:0.70, food:0.85, transport:0.80, healthcare:0.60, leisure:0.85,
  insurance:0.55, incomeTax:0.65, gifts:0.55, other:0.60
};

const ALLOC_BANDS = [
  {
    name: "Under $60k",
    min: 0,
    max: 60000,
    pcts: { housing:0.30, utilities:0.05, food:0.13, transport:0.09, healthcare:0.11, leisure:0.05, insurance:0.03, incomeTax:0.05, gifts:0.01, other:0.15 }
  },
  {
    name: "$60k–$150k",
    min: 60000,
    max: 150000,
    pcts: { housing:0.27, utilities:0.04, food:0.11, transport:0.08, healthcare:0.10, leisure:0.09, insurance:0.03, incomeTax:0.08, gifts:0.02, other:0.14 }
  },
  {
    name: "$150k+",
    min: 150000,
    max: Infinity,
    pcts: { housing:0.23, utilities:0.035, food:0.09, transport:0.07, healthcare:0.09, leisure:0.13, insurance:0.03, incomeTax:0.10, gifts:0.03, other:0.155 }
  }
];

function householdScalar(n){
  n = Math.max(1, Math.min(6, Number(n || 2)));
  const map = {1:0.80,2:1.00,3:1.18,4:1.34,5:1.48,6:1.60};
  return map[n] ?? 1.00;
}

function pickBand(incomeAnnual){
  const inc = Math.max(0, Number(incomeAnnual || 0));
  for (const b of ALLOC_BANDS){
    if (inc >= b.min && inc < b.max) return b;
  }
  return ALLOC_BANDS[1];
}

function estimateTaxesAnnualSimple(targetAnnual, locFactor){
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

function getLocationById(id){ return LOCATIONS.find(l => l.id === id) || LOCATIONS[0]; }

function computeDefaultsMonthly({ incomeAnnual, mode, replacementRatePct, householdSize, housingMode, healthcareMode, taxMode, locationFactor }){
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

// ===========================
// State + Persistence
// ===========================
const state = {
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

const SPENDING_KEY = "retirement_spending_estimator_v1";

function normalizeSpendingState(){
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

function saveSpendingState(){
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
  emit("spending:changed", { annual: getAnnualSpending() });
}

let __saveTimer = null;
function saveSpendingStateDebounced(){
  clearTimeout(__saveTimer);
  __saveTimer = setTimeout(saveSpendingState, 140);
}

function loadSpendingState(){
  const raw = localStorage.getItem(SPENDING_KEY);
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

// ===========================
// UI wiring
// ===========================
const elLocation = document.getElementById("location");
const elRows = document.getElementById("rows");
const elMeta = document.getElementById("locationMeta");
const elLastApplied = document.getElementById("lastApplied");
const elHousehold = document.getElementById("household");
const elIncome = document.getElementById("householdIncome");
const elReplacementRate = document.getElementById("replacementRate");
const elReplacementRateLabel = document.getElementById("replacementRateLabel");
const elHousingMode = document.getElementById("housingMode");
const elShowAdvanced = document.getElementById("showAdvanced");
const elAnnualize = document.getElementById("annualize");
const elModeSummary = document.getElementById("modeSummary");

const elTotalMonthly = document.getElementById("totalMonthly");
const elTotalAnnual = document.getElementById("totalAnnual");
const elPerPerson = document.getElementById("perPerson");
const elAvgDaily = document.getElementById("avgDaily");

const elInflation = document.getElementById("inflation");
const elYears = document.getElementById("years");
const elFutureMonthly = document.getElementById("futureMonthly");
const elFutureAnnual = document.getElementById("futureAnnual");

const elDownloadJson = document.getElementById("downloadJson");
const elAdvancedSubtotalPill = document.getElementById("advancedSubtotalPill");

const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

function initLocations(){
  elLocation.innerHTML = "";
  const regionOrder = ["Northeast","Mid-Atlantic","Southeast","Midwest","Southwest","West","Northwest","Mountains"];
  const orderIndex = Object.fromEntries(regionOrder.map((r,i)=>[r,i]));
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
      elLocation.appendChild(currentOptGroup);
    }
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = loc.name;
    currentOptGroup.appendChild(opt);
  }

  elLocation.value = state.locationId;
  refreshMeta();
}

function refreshMeta(){
  const loc = getLocationById(state.locationId);
  elMeta.textContent = `Location factor: ${loc.factor.toFixed(2)} • Region: ${loc.region}`;
}

function computeTotals(){
  let monthly = 0;
  for (const cat of CATEGORIES){
    if (!state.include[cat.key]) continue;
    monthly += Number(state.values[cat.key] || 0);
  }
  return { monthly, annual: monthly * 12 };
}

function computeAdvancedSubtotal(){
  let monthly = 0;
  for (const cat of CATEGORIES){
    if (!cat.advanced) continue;
    if (!state.include[cat.key]) continue;
    monthly += Number(state.values[cat.key] || 0);
  }
  return { monthly, annual: monthly * 12 };
}

function applyDefaults(useLocationFactor){
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
  elModeSummary.textContent = `${modeText} • Band: ${out.bandName} • Target: ${money(out.targetAnnual)} / yr`;

  elLastApplied.textContent = useLocationFactor
    ? `Defaults: applied (${loc.name})`
    : `Defaults: applied (no location factor)`;

  render();
  saveSpendingStateDebounced();
}

function renderRows(){
  elRows.innerHTML = "";
  const showAdv = state.showAdvanced;

  function addSection(title, hintText){
    const tr = document.createElement("tr");
    tr.className = "sectionRow";
    const td = document.createElement("td");
    td.colSpan = 4;
    td.innerHTML = `${title} <span class="hint">— ${hintText}</span>`;
    tr.appendChild(td);
    elRows.appendChild(tr);
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
      render();
      saveSpendingStateDebounced();
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
      renderTotals();
      drawChart();
      renderFuture();

      saveSpendingStateDebounced();
    });

    tdMon.appendChild(inp);

    tr.appendChild(tdCat);
    tr.appendChild(tdInc);
    tr.appendChild(tdMon);
    tr.appendChild(tdAnn);
    elRows.appendChild(tr);
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

function renderTotals(){
  const { monthly, annual } = computeTotals();
  elTotalMonthly.textContent = money(monthly);
  elTotalAnnual.textContent = money(annual);

  const perPerson = monthly / Math.max(1, Number(state.household || 1));
  elPerPerson.textContent = `~ ${money(perPerson)} per person / month`;

  const daily = annual / 365;
  elAvgDaily.textContent = `~ ${money(daily)} per day`;

  const adv = computeAdvancedSubtotal();
  elAdvancedSubtotalPill.textContent = state.annualize
    ? `Advanced subtotal: ${money(adv.monthly)} / mo • ${money(adv.annual)} / yr`
    : `Advanced subtotal: ${money(adv.monthly)} / mo`;
}

function renderFuture(){
  const { monthly, annual } = computeTotals();
  const r = clamp(elInflation.value, 0, 12) / 100;
  const y = clamp(elYears.value, 0, 50);
  const factor = Math.pow(1 + r, y);
  const futM = Math.round(monthly * factor);
  const futA = Math.round(annual * factor);
  elFutureMonthly.textContent = money(futM);
  elFutureAnnual.textContent = state.annualize ? `${money(futA)} per year` : "—";
}

function drawChart(){
  const { monthly } = computeTotals();
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

function render(){
  refreshMeta();
  normalizeSpendingState();
  renderRows();
  renderTotals();
  drawChart();
  renderFuture();

  elReplacementRateLabel.textContent = `${state.replacementRatePct}% target`;

  const band = pickBand(state.incomeAnnual);
  const targetAnnual = state.incomeAnnual * (state.replacementRatePct/100);
  elModeSummary.textContent = `Replacement-rate mode: ${state.replacementRatePct}% of income • Band: ${band.name} • Target: ${money(targetAnnual)} / yr`;
}

export function getAnnualSpending(){
  const { annual } = computeTotals();
  return annual;
}

// Wiring
function wireEvents(){
  document.getElementById("applyDefaults").addEventListener("click", () => applyDefaults(true));
  document.getElementById("resetNational").addEventListener("click", () => applyDefaults(false));

  elLocation.addEventListener("change", () => {
    state.locationId = elLocation.value;
    refreshMeta();
    saveSpendingStateDebounced();
  });

  elHousehold.addEventListener("input", () => {
    state.household = clamp(elHousehold.value, 1, 6);
    saveSpendingStateDebounced();
  });

  elIncome.addEventListener("input", () => {
    state.incomeAnnual = clamp(elIncome.value, 0, 100_000_000);
    saveSpendingStateDebounced();
  });

  elReplacementRate.addEventListener("input", () => {
    state.replacementRatePct = clamp(elReplacementRate.value, 0, 200);
    elReplacementRateLabel.textContent = `${state.replacementRatePct}% target`;
    saveSpendingStateDebounced();
  });

  elHousingMode.addEventListener("change", () => {
    state.housingMode = elHousingMode.value;
    saveSpendingStateDebounced();
  });

  elShowAdvanced.addEventListener("change", () => {
    state.showAdvanced = elShowAdvanced.checked;
    render();
    saveSpendingStateDebounced();
  });

  elAnnualize.addEventListener("change", () => {
    state.annualize = elAnnualize.checked;
    render();
    saveSpendingStateDebounced();
  });

  elInflation.addEventListener("input", () => {
    renderFuture();
    saveSpendingStateDebounced();
  });

  elYears.addEventListener("input", () => {
    renderFuture();
    saveSpendingStateDebounced();
  });

  elDownloadJson.addEventListener("click", exportJson);
}

// Boot
export function initSpending(){
  initLocations();
  wireEvents();

  const loaded = loadSpendingState();

  if (!loaded){
    state.locationId = LOCATIONS[0].id;
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
    elLastApplied.textContent = "Defaults: applied (no location factor)";
  } else {
    normalizeSpendingState();
  }

  elShowAdvanced.checked = !!state.showAdvanced;
  elAnnualize.checked = !!state.annualize;

  elHousehold.value = state.household;
  elIncome.value = state.incomeAnnual;
  elReplacementRate.value = state.replacementRatePct;
  elReplacementRateLabel.textContent = `${state.replacementRatePct}% target`;
  elHousingMode.value = state.housingMode;

  elLocation.value = state.locationId;
  refreshMeta();

  render();
  if (!loaded) saveSpendingStateDebounced();

  // initial emit for coverage consumers
  emit("spending:changed", { annual: getAnnualSpending() });

  return { getAnnualSpending };
}
