import { formatDollars, clamp } from "../shared/format.js";
import { loadJson, saveJson, safeParseJSON } from "../shared/storage.js";

export function initProjection({ spendingApi } = {}){
  // ============================================================
  // TAB 2: Projection Dashboard (module)
  // ============================================================

  const RMD_LIFE_EXPECTANCY = {
    70:27.4,71:26.5,72:25.6,73:24.7,74:23.8,75:22.9,76:22.0,77:21.2,78:20.3,79:19.5,
    80:18.7,81:17.9,82:17.1,83:16.3,84:15.5,85:14.8,86:14.1,87:13.4,88:12.7,89:12.0,
    90:11.4,91:10.8,92:10.2,93:9.6,94:9.1,95:8.6,96:8.1,97:7.6,98:7.1,99:6.7,
    100:6.3,101:5.9,102:5.5,103:5.2,104:4.9,105:4.5,106:4.2,107:3.9,108:3.7,109:3.4,
    110:3.1,111:2.9,112:2.6,113:2.4,114:2.1,115:1.9
  };

  const scenarioNames = ["Minimum", "Medium", "Maximum"];
  const withdrawalNames = ["Required Minimum Distribution (RMD)", "4% Withdrawal Rule", "Maximum Distribution", "Custom Distribution"];

  const SETTINGS_KEY = "retirement_dashboard_settings_v9";
  const ACCOUNTS_KEY = "retirement_dashboard_accounts_v1";
  const SPENDING_KEY = "retirement_spending_estimator_v1";

  function byId(id){ return document.getElementById(id); }
  function num(id){ return Number(byId(id).value || 0); }

  function clearAllSaved(){
    try{ localStorage.removeItem(SETTINGS_KEY); } catch(e){}
    try{ localStorage.removeItem(ACCOUNTS_KEY); } catch(e){}
  }

  let accounts = [];
  let selectedIds = {};
  let editId = null;

  function newId(){ return String(Date.now()) + "_" + String(Math.floor(Math.random()*1000000)); }

  function loadAccounts(){
    const a = loadJson(ACCOUNTS_KEY);
    accounts = Array.isArray(a) ? a : [];
    selectedIds = {};
    for (let i=0;i<accounts.length;i++){
      if (accounts[i].included === undefined) accounts[i].included = true;
      accounts[i].included = !!accounts[i].included;
    }
    saveAccounts();
  }
  function saveAccounts(){ saveJson(ACCOUNTS_KEY, accounts); }

  function totalAccounts(){
    let sum = 0;
    for (let i=0;i<accounts.length;i++){
      if (!accounts[i].included) continue;
      sum += Number(accounts[i].amount||0);
    }
    return sum;
  }

  function setAccountsTotalPill(){ byId("accountsTotalPill").textContent = formatDollars(totalAccounts()); }

  function setDeleteSelectedEnabled(){
    let hasAny = false;
    for (const k in selectedIds){ if (Object.prototype.hasOwnProperty.call(selectedIds,k) && selectedIds[k]) { hasAny = true; break; } }
    byId("deleteSelectedBtn").disabled = !hasAny;
    byId("deleteSelectedBtn").style.opacity = hasAny ? "1" : "0.6";
  }

  function renderAccountsTable(){
    const tbody = byId("accountsTbody");
    tbody.innerHTML = "";

    if (accounts.length === 0){
      const tr0=document.createElement("tr");
      const td0=document.createElement("td");
      td0.colSpan=5;
      td0.className="small muted";
      td0.textContent="No accounts yet. Add one above.";
      tr0.appendChild(td0);
      tbody.appendChild(tr0);
      setAccountsTotalPill();
      setDeleteSelectedEnabled();
      return;
    }

    for (let i=0;i<accounts.length;i++){
      (function(acct){
        const tr=document.createElement("tr");
        if (selectedIds[acct.id]) tr.className="selected";

        const tdUse = document.createElement("td");
        const useCb = document.createElement("input");
        useCb.type = "checkbox";
        useCb.checked = (acct.included === undefined) ? true : !!acct.included;
        useCb.addEventListener("change", function(){
          acct.included = !!useCb.checked;
          saveAccounts();
          setAccountsTotalPill();
          renderProjection();
        });
        tdUse.appendChild(useCb);

        const tdSel = document.createElement("td");
        const cb = document.createElement("input");
        cb.type="checkbox";
        cb.checked=!!selectedIds[acct.id];
        cb.addEventListener("change", function(){
          selectedIds[acct.id] = !!cb.checked;
          tr.classList.toggle("selected", !!cb.checked);
          setDeleteSelectedEnabled();
        });
        tdSel.appendChild(cb);

        const tdName=document.createElement("td");
        tdName.textContent=acct.name;
        tdName.addEventListener("dblclick", function(){ openEditModal(acct.id); });

        const tdAmt=document.createElement("td");
        tdAmt.textContent=formatDollars(acct.amount);
        tdAmt.addEventListener("dblclick", function(){ openEditModal(acct.id); });

        const tdActions=document.createElement("td");
        tdActions.style.textAlign="right";

        const editBtn=document.createElement("button");
        editBtn.className="btn secondary";
        editBtn.type="button";
        editBtn.textContent="Edit";
        editBtn.addEventListener("click", function(){ openEditModal(acct.id); });

        const delBtn=document.createElement("button");
        delBtn.className="btn danger";
        delBtn.type="button";
        delBtn.textContent="Delete";
        delBtn.style.marginLeft="8px";
        delBtn.addEventListener("click", function(){
          const ok=window.confirm("Delete this account?");
          if(!ok) return;
          deleteAccount(acct.id);
        });

        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);

        tr.appendChild(tdUse);
        tr.appendChild(tdSel);
        tr.appendChild(tdName);
        tr.appendChild(tdAmt);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      })(accounts[i]);
    }
    setAccountsTotalPill();
    setDeleteSelectedEnabled();
  }

  function addAccount(){
    const name=String(byId("acctName").value||"").trim();
    const amount=Number(byId("acctAmount").value||0);
    if(!name) return;
    if(!isFinite(amount) || amount < 0) return;

    accounts.push({ id:newId(), name:name, amount:amount, included:true });

    saveAccounts();
    byId("acctName").value="";
    byId("acctAmount").value="";
    renderAccountsTable();
    renderProjection();
  }

  function deleteAccount(id){
    const out=[];
    for(let i=0;i<accounts.length;i++) if(accounts[i].id!==id) out.push(accounts[i]);
    accounts=out;
    delete selectedIds[id];
    saveAccounts();
    renderAccountsTable();
    renderProjection();
  }

  function deleteSelectedAccounts(){
    const ids=[];
    for(const k in selectedIds) if(Object.prototype.hasOwnProperty.call(selectedIds,k) && selectedIds[k]) ids.push(k);
    if(ids.length===0) return;

    const ok=window.confirm("Delete " + ids.length + " selected account(s)?");
    if(!ok) return;

    const toDelete={};
    for(let i=0;i<ids.length;i++) toDelete[ids[i]]=true;

    const keep=[];
    for(let j=0;j<accounts.length;j++) if(!toDelete[accounts[j].id]) keep.push(accounts[j]);

    accounts=keep;
    selectedIds={};
    saveAccounts();
    renderAccountsTable();
    renderProjection();
  }

  function openEditModal(id){
    editId=id;
    let acct=null;
    for(let i=0;i<accounts.length;i++){ if(accounts[i].id===id){ acct=accounts[i]; break; } }
    if(!acct) return;

    byId("editAcctName").value=acct.name;
    byId("editAcctAmount").value=acct.amount;
    byId("editModalOverlay").classList.add("show");
  }
  function closeEditModal(){
    editId=null;
    byId("editModalOverlay").classList.remove("show");
  }
  function saveEditModal(){
    if(!editId) return;

    const name=String(byId("editAcctName").value||"").trim();
    const amount=Number(byId("editAcctAmount").value||0);
    if(!name) return;
    if(!isFinite(amount) || amount < 0) return;

    for(let i=0;i<accounts.length;i++){
      if(accounts[i].id===editId){
        accounts[i].name=name;
        accounts[i].amount=amount;
        break;
      }
    }
    saveAccounts();
    closeEditModal();
    renderAccountsTable();
    renderProjection();
  }

  function setCollapsed(el, collapsed){
    if(!el) return;
    if(collapsed) el.classList.add("is-collapsed");
    else el.classList.remove("is-collapsed");
  }

  function estimateSocialSecurityAnnual(workIncome, yearsWorked){
    let income=Math.max(0, Number(workIncome||0));
    let yw=Math.max(0, Number(yearsWorked||0));
    let factor=Math.min(1, yw/35);
    let est=0.40*income*factor;
    if(est>50000) est=50000;
    if(!isFinite(est)) est=0;
    return est;
  }

  function getCustomWithdrawAnnual(){
    let v = Number(byId("customWithdraw").value || 0);
    if (!isFinite(v) || v < 0) v = 0;
    return v;
  }

  function getScenarioIndex(){ return Math.max(0, Math.min(2, Number(byId("scenarioSlider").value || 0))); }
  function getWithdrawalIndex(){ return Math.max(0, Math.min(3, Number(byId("withdrawalSlider").value || 0))); }

  function updateCustomWithdrawUI(){
    const wIdx = getWithdrawalIndex();
    const show = (wIdx === 3);
    setCollapsed(byId("customWithdrawCollapse"), !show);
    const amt = getCustomWithdrawAnnual();
    byId("customWithdrawPill").textContent = formatDollars(amt) + " / yr";
  }

  function updateToggleUI(){
    setCollapsed(byId("pensionCollapse"), !byId("enablePension").checked);
    const ssEnabled=!!byId("enableSS").checked;
    setCollapsed(byId("ssCollapse"), !ssEnabled);
    byId("ssDisabledPill").style.display = ssEnabled ? "none" : "inline-block";
    updateCustomWithdrawUI();
  }

  function updateSocialSecurityPill(){
    const ssEnabled=!!byId("enableSS").checked;
    const ss = (function(){
      if (!ssEnabled) return 0;
      const useOverride=!!byId("useSSOverride").checked;
      const overrideVal=Number(byId("ssOverride").value||0);
      if(useOverride && isFinite(overrideVal) && overrideVal>0) return overrideVal;
      return estimateSocialSecurityAnnual(num("workIncome"), num("yearsWorked"));
    })();

    byId("ssEstimatedPill").textContent = formatDollars(ssEnabled ? ss : 0) + " / year (est.)";
    byId("ssDisabledPill").textContent = formatDollars(0) + " / year (disabled)";
  }

  function sanitizeAges(currentAge, retirementAge, deathAge){
    const warnings = [];
    let ca = Number(currentAge||0), ra = Number(retirementAge||0), da = Number(deathAge||0);

    if(!isFinite(ca) || ca <= 0) { ca = 30; warnings.push("Current age was invalid; using 30."); }
    if(!isFinite(ra) || ra <= 0) { ra = 62; warnings.push("Retirement age was invalid; using 62."); }
    if(!isFinite(da) || da <= 0) { da = 85; warnings.push("Death age was invalid; using 85."); }

    if(ra < ca){
      warnings.push("Retirement age is below current age; treating years-to-retirement as 0.");
      ra = ca;
    }
    if(da <= ra){
      warnings.push("Death age must be greater than retirement age to model drawdown; drawdown will be unavailable.");
    }

    return { currentAge: ca, retirementAge: ra, deathAge: da, warnings: warnings };
  }

  function safeAnnuitizeMaxWithdrawal(fv, retGrowth, yearsInRetirement){
    const n = Math.max(0, Number(yearsInRetirement||0));
    if(n <= 0) return 0;

    let g = Number(retGrowth||0);
    if(!isFinite(g)) g = 0;

    if(Math.abs(g) < 1e-9){
      return fv / n;
    }

    const denom = (1 - Math.pow(1+g, -(n+1)));
    if(!isFinite(denom) || Math.abs(denom) < 1e-9){
      return fv / n;
    }

    return fv*g/denom;
  }

  function runProjection(currentFunds, currentAge, retirementAge, deathAge,
                         otherIncomeAnnual, annualContrib, inflation,
                         nominalBaseRate, retirementGrowthRate){

    const ages = sanitizeAges(currentAge, retirementAge, deathAge);
    currentAge = ages.currentAge;
    retirementAge = ages.retirementAge;
    deathAge = ages.deathAge;

    const yearsToRetire = Math.max(0, retirementAge-currentAge);
    const yearsInRetirement = Math.max(0, deathAge-retirementAge);

    const nominalRates=[nominalBaseRate-0.03, nominalBaseRate, nominalBaseRate+0.03];
    const realRates=[];
    for(let i=0;i<nominalRates.length;i++){
      const r=nominalRates[i];
      realRates.push((1+r)/(1+inflation)-1);
    }

    const nominalRetGrowth=retirementGrowthRate;

    function projectForRates(rates, retGrowth){
      const results=[];
      for(let i=0;i<rates.length;i++){
        const r=rates[i];
        let fv;

        if (yearsToRetire === 0){
          fv = currentFunds;
        } else if (r!==0){
          fv = currentFunds*Math.pow(1+r, yearsToRetire) +
               annualContrib*((Math.pow(1+r, yearsToRetire)-1)/r);
        } else {
          fv = currentFunds + annualContrib*yearsToRetire;
        }

        const rmdAge=Math.max(retirementAge, 72);
        const factor=(RMD_LIFE_EXPECTANCY[rmdAge]!==undefined) ? RMD_LIFE_EXPECTANCY[rmdAge] : 25;

        const minDisb = (factor > 0) ? (fv/factor) : 0;
        const midDisb = fv*0.04;
        const maxDisb = safeAnnuitizeMaxWithdrawal(fv, retGrowth, yearsInRetirement);

        let remainingMin = null;
        let remainingMid = null;
        if (yearsInRetirement > 0){
          let g = Number(nominalRetGrowth||0);
          if(!isFinite(g)) g = 0;

          if (Math.abs(g) < 1e-9){
            remainingMin = fv - (minDisb * yearsInRetirement);
            remainingMid = fv - (midDisb * yearsInRetirement);
          } else {
            remainingMin = fv*Math.pow(1+g, yearsInRetirement) -
                          minDisb*((Math.pow(1+g, yearsInRetirement)-1)/g);
            remainingMid = fv*Math.pow(1+g, yearsInRetirement) -
                          midDisb*((Math.pow(1+g, yearsInRetirement)-1)/g);
          }
        }

        results.push({
          fv:fv,
          growth_rate:r,
          min_disb:minDisb,
          mid_disb:midDisb,
          max_disb:maxDisb,
          remaining_min:remainingMin,
          remaining_mid:remainingMid,
          other_income:otherIncomeAnnual
        });
      }
      return results;
    }

    return {
      nominalProj: projectForRates(nominalRates, nominalRetGrowth),
      realProj: projectForRates(realRates, nominalRetGrowth),
      retirementAge: retirementAge,
      deathAge: deathAge,
      nominalRetGrowth: nominalRetGrowth,
      inflation: inflation,
      warnings: ages.warnings
    };
  }

  function computePortfolioPath(currentFunds, annualContrib, preRetGrowth, retirementGrowth,
                                annualWithdrawalNeed, otherIncomeAnnual,
                                currentAge, retirementAge, deathAge){

    const balances = [];
    let balance = Number(currentFunds || 0);
    if (!isFinite(balance) || balance < 0) balance = 0;

    let contrib = Number(annualContrib || 0);
    if (!isFinite(contrib) || contrib < 0) contrib = 0;

    let rPre = Number(preRetGrowth || 0);
    if (!isFinite(rPre)) rPre = 0;

    let rRet = Number(retirementGrowth || 0);
    if (!isFinite(rRet)) rRet = 0;

    let need = Number(annualWithdrawalNeed || 0);
    if (!isFinite(need) || need < 0) need = 0;

    let other = Number(otherIncomeAnnual || 0);
    if (!isFinite(other) || other < 0) other = 0;

    const effectiveWithdrawal = Math.max(0, need - other);

    for (let age = currentAge; age <= deathAge; age++){
      if (age < retirementAge){
        balance = balance * (1 + rPre) + contrib;
      } else {
        balance = balance * (1 + rRet) - effectiveWithdrawal;
      }
      balances.push(balance);
    }
    return balances;
  }

  const drawdownState = { years:[], map:{}, remainingMap:{} };
  let chartInstance = null;

  function getDrawdownTitle(index){
    const titles=[
      "Minimum Projection - Required Minimum Distribution (RMD)",
      "Minimum Projection - 4% Withdrawal Rule",
      "Minimum Projection - Maximum Distribution",
      "Minimum Projection - Custom Distribution",

      "Medium Projection - Required Minimum Distribution (RMD)",
      "Medium Projection - 4% Withdrawal Rule",
      "Medium Projection - Maximum Distribution",
      "Medium Projection - Custom Distribution",

      "Maximum Projection - Required Minimum Distribution (RMD)",
      "Maximum Projection - 4% Withdrawal Rule",
      "Maximum Projection - Maximum Distribution",
      "Maximum Projection - Custom Distribution"
    ];
    return titles[index] || "Drawdown Chart";
  }

  function renderDrawdownChart(){
    const sel=Number(byId("drawdownSelector").value||0);
    const years=drawdownState.years||[];
    const balances=(drawdownState.map && drawdownState.map[sel]) ? drawdownState.map[sel] : [];

    byId("chartTitle").textContent=getDrawdownTitle(sel);

    if (typeof Chart === "undefined") {
      byId("chartWrap").style.display = "block";
      byId("chartTitle").textContent = getDrawdownTitle(sel) + " — Chart unavailable (Chart.js blocked).";
      return;
    }

    const ctx=byId("drawdownCanvas").getContext("2d");
    if(chartInstance){ chartInstance.destroy(); chartInstance=null; }

    chartInstance=new Chart(ctx,{
      type:"line",
      data:{
        labels: years,
        datasets:[{ label:"Portfolio Balance", data:balances, pointRadius:2, tension:0.2 }]
      },
      options:{
        responsive:true,
        plugins:{ legend:{ display:true, labels:{ color:"rgba(234,240,255,.85)" } } },
        scales:{
          y:{
            title:{ display:true, text:"USD (Millions)", color:"rgba(234,240,255,.75)" },
            ticks:{ color:"rgba(234,240,255,.75)", callback:function(v){ return (Number(v)/1000000).toFixed(1); } },
            grid:{ color:"rgba(255,255,255,.08)" }
          },
          x:{
            title:{ display:true, text:"Age", color:"rgba(234,240,255,.75)" },
            ticks:{ color:"rgba(234,240,255,.75)" },
            grid:{ color:"rgba(255,255,255,.08)" }
          }
        }
      }
    });
  }

  const last = { result:null, currentFunds:0, otherIncomeAnnual:0, inflation:0, yearsToRetire:0 };

  function distributionFor(obj, idx){
    if (idx === 0) return obj.min_disb;
    if (idx === 1) return obj.mid_disb;
    if (idx === 2) return obj.max_disb;
    return getCustomWithdrawAnnual();
  }

  function remainingForScenarioAndMethod(sIdx, wIdx){
    const drawdownIndex = (sIdx * 4) + wIdx;
    if (!drawdownState.remainingMap) return null;
    const rem = drawdownState.remainingMap[drawdownIndex];
    return (rem === undefined) ? null : rem;
  }

  function toTodaysDollars(nominalAnnual){
    let infl = Number(last.inflation || 0);
    let y = Number(last.yearsToRetire || 0);
    if (!isFinite(infl) || infl < 0) infl = 0;
    if (!isFinite(y) || y < 0) y = 0;
    const denom = Math.pow(1 + infl, y);
    if (!isFinite(denom) || denom <= 0) return Number(nominalAnnual || 0);
    return Number(nominalAnnual || 0) / denom;
  }

  function updateWarnings(warnings){
    const el = byId("projWarnings");
    if (!warnings || !warnings.length){
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "inline-block";
    el.textContent = warnings.join(" ");
  }

  function getSpendingEstimatorAnnual(){
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

  function updateSpendingCoverageUI(totalIncomeTodayAnnual){
    let spendAnnual = getSpendingEstimatorAnnual();

    const elStatus = byId("spendCoverageStatus");
    const elSpend  = byId("spendAnnual");
    const elIncome = byId("incomeAnnualToday");
    const elDelta  = byId("surplusShortfall");
    const elPct    = byId("coveragePct");

    if (!elStatus || !elSpend || !elIncome || !elDelta || !elPct) return;

    let income = Number(totalIncomeTodayAnnual || 0);
    if (!isFinite(income) || income < 0) income = 0;

    if (spendAnnual === null){
      elStatus.textContent = "No spending estimate found (use the Spending Estimator tab first).";
      elSpend.textContent  = "$—";
      elIncome.textContent = formatDollars(income) + " / yr";
      elDelta.textContent  = "$—";
      elPct.textContent    = "—";
      return;
    }

    spendAnnual = Math.max(0, Number(spendAnnual || 0));

    elSpend.textContent  = formatDollars(spendAnnual) + " / yr";
    elIncome.textContent = formatDollars(income) + " / yr";

    const delta = income - spendAnnual;
    const covered = (income >= spendAnnual);

    elDelta.textContent = formatDollars(Math.abs(delta)) + (covered ? " surplus" : " shortfall");

    const pct = (spendAnnual > 0) ? (income / spendAnnual) * 100 : 0;
    elPct.textContent = (spendAnnual > 0)
      ? ("Coverage: " + pct.toFixed(0) + "% of estimated spending")
      : "Coverage: —";

    if (covered){
      elStatus.textContent = "Covered. Income exceeds spending by: " + formatDollars(delta) + " / yr";
    } else {
      elStatus.textContent = "Shortfall. Income is below spending by: " + formatDollars(Math.abs(delta)) + " / yr";
    }
  }

  function updateProjectionOutputUI(){
    if (!last.result) return;

    const sIdx = getScenarioIndex();
    const wIdx = getWithdrawalIndex();
    const nominal = last.result.nominalProj[sIdx];

    const distNom = distributionFor(nominal, wIdx);
    const totalNom = distNom + last.otherIncomeAnnual;

    const distToday = toTodaysDollars(distNom);
    const totalToday = toTodaysDollars(totalNom);

    byId("scenarioLabel").textContent = scenarioNames[sIdx];
    byId("scenarioPill").textContent = "Scenario: " + scenarioNames[sIdx];
    byId("withdrawalLabel").textContent = withdrawalNames[wIdx];

    byId("scenarioRatesPill").textContent = "Growth: " + (nominal.growth_rate * 100).toFixed(1) + "%";

    byId("outCurrentPortfolio").textContent = formatDollars(last.currentFunds);
    byId("outFVNominal").textContent = formatDollars(nominal.fv);

    byId("otherIncomePill").textContent = "Other income: " + formatDollars(last.otherIncomeAnnual) + "/yr";

    byId("outDistributionNominal").textContent = formatDollars(distNom) + " / yr";
    byId("outDistributionToday").textContent = formatDollars(distToday) + " / yr";

    byId("outTotalIncomeNominal").textContent = formatDollars(totalNom) + " / yr";
    byId("outTotalIncomeToday").textContent = formatDollars(totalToday) + " / yr";

    updateSpendingCoverageUI(totalToday);

    const rem = remainingForScenarioAndMethod(sIdx, wIdx);
    byId("outRemaining").textContent = (rem === null) ? "—" : formatDollars(rem);

    // Keep drawdown selector aligned
    const drawdownIndex = (sIdx * 4) + wIdx;
    byId("drawdownSelector").value = String(drawdownIndex);

    if (byId("chartWrap").style.display !== "none") renderDrawdownChart();

    // Persist slider UI positions
    const s = loadJson(SETTINGS_KEY) || {};
    s.uiScenarioIndex = sIdx;
    s.uiWithdrawalIndex = wIdx;
    saveJson(SETTINGS_KEY, s);
  }

  function renderProjection(){
    updateToggleUI();

    const currentFunds=totalAccounts();

    const currentAge=num("currentAge");
    const retirementAge=num("retirementAge");
    const deathAge=num("deathAge");

    const pensionAnnual = (!!byId("enablePension").checked) ? num("pension") : 0;

    const ssAnnual = (function(){
      if (!byId("enableSS").checked) return 0;
      const useOverride = !!byId("useSSOverride").checked;
      const overrideVal = Number(byId("ssOverride").value || 0);
      if (useOverride && isFinite(overrideVal) && overrideVal > 0) return overrideVal;
      return estimateSocialSecurityAnnual(num("workIncome"), num("yearsWorked"));
    })();

    const otherIncomeAnnual = pensionAnnual + ssAnnual;

    const annualContribution=num("annualContribution");
    const inflation=num("inflationProj")/100;
    const growthRate=num("growthRate")/100;
    const retirementGrowth=num("retirementGrowth")/100;

    updateSocialSecurityPill();

    const result=runProjection(
      currentFunds, currentAge, retirementAge, deathAge,
      otherIncomeAnnual, annualContribution, inflation, growthRate, retirementGrowth
    );

    last.result = result;
    last.currentFunds = currentFunds;
    last.otherIncomeAnnual = otherIncomeAnnual;
    last.inflation = inflation;

    const ages = sanitizeAges(currentAge, retirementAge, deathAge);
    last.yearsToRetire = Math.max(0, ages.retirementAge - ages.currentAge);

    updateWarnings(result.warnings);

    saveJson(SETTINGS_KEY, {
      currentAge: ages.currentAge,
      retirementAge: ages.retirementAge,
      deathAge: ages.deathAge,
      enablePension: !!byId("enablePension").checked,
      pension: num("pension"),
      enableSS: !!byId("enableSS").checked,
      workIncome: num("workIncome"),
      yearsWorked: num("yearsWorked"),
      useSSOverride: !!byId("useSSOverride").checked,
      ssOverride: num("ssOverride"),
      annualContribution: annualContribution,
      inflation: num("inflationProj"),
      growthRate: num("growthRate"),
      retirementGrowth: num("retirementGrowth"),
      uiScenarioIndex: getScenarioIndex(),
      uiWithdrawalIndex: getWithdrawalIndex(),
      customWithdraw: getCustomWithdrawAnnual(),
    });

    // Build full portfolio path from currentAge through deathAge (inclusive)
    const years = [];
    if (ages.deathAge >= ages.currentAge){
      for (let age = ages.currentAge; age <= ages.deathAge; age++) years.push(age);
    }

    const dd = [];
    if (years.length){
      const currentFundsForPath = currentFunds;
      const contrib = annualContribution;
      const rRet = retirementGrowth;

      for (let s = 0; s < 3; s++){
        const rPre = result.nominalProj[s].growth_rate;

        const distRMD = result.nominalProj[s].min_disb;
        const dist4   = result.nominalProj[s].mid_disb;
        const distMax = result.nominalProj[s].max_disb;
        const customW = getCustomWithdrawAnnual();

        dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, distRMD, otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
        dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, dist4,   otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
        dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, distMax, otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
        dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, customW, otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
      }
    }

    function lastVal(arr){ return (arr && arr.length) ? arr[arr.length - 1] : null; }

    drawdownState.remainingMap = {
      0:lastVal(dd[0]),  1:lastVal(dd[1]),  2:null,          3:lastVal(dd[3]),
      4:lastVal(dd[4]),  5:lastVal(dd[5]),  6:null,          7:lastVal(dd[7]),
      8:lastVal(dd[8]),  9:lastVal(dd[9]), 10:null,         11:lastVal(dd[11])
    };

    drawdownState.map = {
      0:dd[0], 1:dd[1], 2:dd[2], 3:dd[3],
      4:dd[4], 5:dd[5], 6:dd[6], 7:dd[7],
      8:dd[8], 9:dd[9], 10:dd[10], 11:dd[11]
    };

    drawdownState.years = years;

    setAccountsTotalPill();
    updateProjectionOutputUI();
  }

  function setDefaultsIfEmpty(){
    const defaults = {
      currentAge:30, retirementAge:62, deathAge:85,
      enablePension:false, pension:0,
      enableSS:false, workIncome:0, yearsWorked:0, useSSOverride:false, ssOverride:0,
      growthRate:8, annualContribution:0, retirementGrowth:3, inflation:2.5,
      uiScenarioIndex: 1,
      uiWithdrawalIndex: 0,
      customWithdraw: 0
    };

    const s = loadJson(SETTINGS_KEY);
    const v = s || defaults;

    byId("currentAge").value = (v.currentAge!==undefined) ? v.currentAge : defaults.currentAge;
    byId("retirementAge").value = (v.retirementAge!==undefined) ? v.retirementAge : defaults.retirementAge;
    byId("deathAge").value = (v.deathAge!==undefined) ? v.deathAge : defaults.deathAge;

    byId("enablePension").checked = (v.enablePension!==undefined) ? !!v.enablePension : defaults.enablePension;
    byId("pension").value = (v.pension!==undefined) ? v.pension : defaults.pension;

    byId("growthRate").value = (v.growthRate!==undefined) ? v.growthRate : defaults.growthRate;
    byId("annualContribution").value = (v.annualContribution!==undefined) ? v.annualContribution : defaults.annualContribution;
    byId("retirementGrowth").value = (v.retirementGrowth!==undefined) ? v.retirementGrowth : defaults.retirementGrowth;
    byId("inflationProj").value = (v.inflation!==undefined) ? v.inflation : defaults.inflation;

    byId("enableSS").checked = (v.enableSS!==undefined) ? !!v.enableSS : defaults.enableSS;
    byId("workIncome").value = (v.workIncome!==undefined) ? v.workIncome : defaults.workIncome;
    byId("yearsWorked").value = (v.yearsWorked!==undefined) ? v.yearsWorked : defaults.yearsWorked;
    byId("useSSOverride").checked = (v.useSSOverride!==undefined) ? !!v.useSSOverride : defaults.useSSOverride;
    byId("ssOverride").value = (v.ssOverride!==undefined) ? v.ssOverride : defaults.ssOverride;

    byId("scenarioSlider").value = (v.uiScenarioIndex !== undefined) ? String(v.uiScenarioIndex) : String(defaults.uiScenarioIndex);
    byId("withdrawalSlider").value = (v.uiWithdrawalIndex !== undefined) ? String(v.uiWithdrawalIndex) : String(defaults.uiWithdrawalIndex);
    byId("customWithdraw").value = (v.customWithdraw!==undefined) ? v.customWithdraw : defaults.customWithdraw;

    loadAccounts();
    renderAccountsTable();
    setAccountsTotalPill();

    updateToggleUI();
    if(!byId("enablePension").checked) byId("pensionCollapse").classList.add("is-collapsed");
    if(!byId("enableSS").checked) byId("ssCollapse").classList.add("is-collapsed");

    updateSocialSecurityPill();
  }

  function wireEvents(){
    const ids=["currentAge","retirementAge","deathAge","pension","growthRate","annualContribution","retirementGrowth","inflationProj","workIncome","yearsWorked","ssOverride","customWithdraw"];
    for(let i=0;i<ids.length;i++) byId(ids[i]).addEventListener("input", renderProjection);

    byId("enablePension").addEventListener("change", renderProjection);
    byId("enableSS").addEventListener("change", renderProjection);
    byId("useSSOverride").addEventListener("change", renderProjection);

    byId("addAcctBtn").addEventListener("click", addAccount);
    byId("acctAmount").addEventListener("keydown", function(e){ if(e.key==="Enter") addAccount(); });
    byId("acctName").addEventListener("keydown", function(e){ if(e.key==="Enter") addAccount(); });

    byId("deleteSelectedBtn").addEventListener("click", deleteSelectedAccounts);

    byId("scenarioSlider").addEventListener("input", updateProjectionOutputUI);
    byId("withdrawalSlider").addEventListener("input", function(){
      updateCustomWithdrawUI();
      updateProjectionOutputUI();
    });

    byId("viewDrawdownBtn").addEventListener("click", function(){
      byId("chartWrap").style.display="block";
      renderDrawdownChart();
    });

    byId("drawdownSelector").addEventListener("change", function(){
      const idx = Number(byId("drawdownSelector").value || 0);
      const sIdx = Math.floor(idx / 4);
      const wIdx = idx % 4;

      byId("scenarioSlider").value = String(sIdx);
      byId("withdrawalSlider").value = String(wIdx);
      updateProjectionOutputUI();
      if(byId("chartWrap").style.display!=="none") renderDrawdownChart();
    });

    byId("resetBtn").addEventListener("click", function(){
      const ok=window.confirm("Reset ALL saved accounts and settings?");
      if(!ok) return;

      clearAllSaved();
      accounts=[]; selectedIds={};
      byId("chartWrap").style.display="none";
      if(chartInstance){ chartInstance.destroy(); chartInstance=null; }

      setDefaultsIfEmpty();
      renderProjection();
      updateCustomWithdrawUI();
    });

    byId("editModalCloseBtn").addEventListener("click", closeEditModal);
    byId("editCancelBtn").addEventListener("click", closeEditModal);
    byId("editSaveBtn").addEventListener("click", saveEditModal);

    byId("editModalOverlay").addEventListener("mousedown", function(e){
      if(e.target && e.target.id==="editModalOverlay") closeEditModal();
    });

    // Spending coverage details toggle (default collapsed)
    (function(){
      const btn = byId("toggleCoverageDetails");
      const panel = byId("coverageDetails");
      if (!btn || !panel) return;

      function setExpanded(expanded){
        panel.classList.toggle("is-collapsed", !expanded);
        btn.textContent = expanded ? "Collapse" : "Expand";
      }

      setExpanded(false);
      btn.addEventListener("click", function(){
        const isCollapsed = panel.classList.contains("is-collapsed");
        setExpanded(isCollapsed);
      });
    })();

    // When projection tab becomes visible, resize chart if needed
    window.addEventListener("rtk:projection-tab-shown", function(){
      try { if (chartInstance) chartInstance.resize(); } catch(e){}
    });

    // If spending changed in another tab
    window.addEventListener("storage", function(e){
      if (e && e.key === SPENDING_KEY){
        refreshCoverage();
      }
    });
  }

  function refreshCoverage(){
    // Refresh coverage from current selection
    if (!last.result) { renderProjection(); return; }
    updateProjectionOutputUI();
  }

  setDefaultsIfEmpty();
  wireEvents();
  renderProjection();

  return { refreshCoverage };
}
