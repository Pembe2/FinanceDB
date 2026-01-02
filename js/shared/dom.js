export function byId(id){ return document.getElementById(id); }

export function initTabs({ tabSpendingId, tabProjectionId, panelSpendingId, panelProjectionId, defaultTab="projection", onAfterTabShown }){
  const tabSpending = byId(tabSpendingId);
  const tabProjection = byId(tabProjectionId);
  const panelSpending = byId(panelSpendingId);
  const panelProjection = byId(panelProjectionId);

  function setTab(which){
    const spendingOn = which === "spending";
    tabSpending.setAttribute("aria-selected", spendingOn ? "true" : "false");
    tabProjection.setAttribute("aria-selected", spendingOn ? "false" : "true");
    panelSpending.classList.toggle("active", spendingOn);
    panelProjection.classList.toggle("active", !spendingOn);

    if (typeof onAfterTabShown === "function") {
      try { onAfterTabShown(which); } catch(e){}
    }
  }

  tabSpending.addEventListener("click", () => setTab("spending"));
  tabProjection.addEventListener("click", () => setTab("projection"));

  function applyHash(){
    if (location.hash === "#spending") { setTab("spending"); return; }
    if (location.hash === "#projection") { setTab("projection"); return; }
    setTab(defaultTab);
  }
  window.addEventListener("hashchange", applyHash);
  applyHash();

  return { setTab };
}
