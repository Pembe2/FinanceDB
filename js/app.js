import { initTabs } from "./shared/dom.js";
import { on } from "./shared/events.js";
import { initSpending } from "./spending/main.js";
import { initProjection } from "./projection/main.js";

// Tabs first (projection default)
const tabs = initTabs({
  tabSpendingId: "tabSpending",
  tabProjectionId: "tabProjection",
  panelSpendingId: "panelSpending",
  panelProjectionId: "panelProjection",
  defaultTab: "projection",
  onAfterTabShown: (which) => {
    if (which === "projection") {
      try { window.dispatchEvent(new Event("rtk:projection-tab-shown")); } catch(e){}
    }
  }
});

// Init modules
const spendingApi = initSpending();
const projectionApi = initProjection({ spendingApi });

// When spending changes, refresh coverage (and anything else we later add)
on("spending:changed", () => {
  try { projectionApi.refreshCoverage(); } catch(e){}
});

// Keep for debugging in console (optional)
window.__rtk = { tabs, spendingApi, projectionApi };
