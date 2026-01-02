// js/spending/constants.js

export const LOCATIONS = [
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

export const CATEGORIES = [
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

export const FACTOR_WEIGHTS = {
  housing:1.25, utilities:0.70, food:0.85, transport:0.80, healthcare:0.60, leisure:0.85,
  insurance:0.55, incomeTax:0.65, gifts:0.55, other:0.60
};

export const ALLOC_BANDS = [
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

export const SPENDING_KEY = "retirement_spending_estimator_v1";

export const REGION_ORDER = ["Northeast","Mid-Atlantic","Southeast","Midwest","Southwest","West","Northwest","Mountains"];
