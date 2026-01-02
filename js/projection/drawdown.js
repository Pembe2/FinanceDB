// js/projection/drawdown.js
import { drawdownTitles } from "./constants.js";

export function computePortfolioPath(
  currentFunds, annualContrib, preRetGrowth, retirementGrowth,
  annualWithdrawalNeed, otherIncomeAnnual,
  currentAge, retirementAge, deathAge
){
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

export function getDrawdownTitle(index){
  return drawdownTitles[index] || "Drawdown Chart";
}

export function buildDrawdownState({
  ages,
  result,
  currentFunds,
  annualContribution,
  retirementGrowth,
  otherIncomeAnnual,
  customWithdrawAnnual
}){
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
      const customW = customWithdrawAnnual;

      dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, distRMD, otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
      dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, dist4,   otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
      dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, distMax, otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
      dd.push(computePortfolioPath(currentFundsForPath, contrib, rPre, rRet, customW, otherIncomeAnnual, ages.currentAge, ages.retirementAge, ages.deathAge));
    }
  }

  function lastVal(arr){ return (arr && arr.length) ? arr[arr.length - 1] : null; }

  const remainingMap = {
    0:lastVal(dd[0]),  1:lastVal(dd[1]),  2:null,          3:lastVal(dd[3]),
    4:lastVal(dd[4]),  5:lastVal(dd[5]),  6:null,          7:lastVal(dd[7]),
    8:lastVal(dd[8]),  9:lastVal(dd[9]), 10:null,         11:lastVal(dd[11])
  };

  const map = {
    0:dd[0], 1:dd[1], 2:dd[2], 3:dd[3],
    4:dd[4], 5:dd[5], 6:dd[6], 7:dd[7],
    8:dd[8], 9:dd[9], 10:dd[10], 11:dd[11]
  };

  return { years, map, remainingMap };
}
