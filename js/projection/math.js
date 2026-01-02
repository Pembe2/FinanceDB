// js/projection/math.js
import { RMD_LIFE_EXPECTANCY } from "./constants.js";

export function sanitizeAges(currentAge, retirementAge, deathAge){
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

  return { currentAge: ca, retirementAge: ra, deathAge: da, warnings };
}

export function estimateSocialSecurityAnnual(workIncome, yearsWorked){
  let income = Math.max(0, Number(workIncome||0));
  let yw = Math.max(0, Number(yearsWorked||0));
  let factor = Math.min(1, yw/35);
  let est = 0.40 * income * factor;
  if(est > 50000) est = 50000;
  if(!isFinite(est)) est = 0;
  return est;
}

export function safeAnnuitizeMaxWithdrawal(fv, retGrowth, yearsInRetirement){
  const n = Math.max(0, Number(yearsInRetirement||0));
  if(n <= 0) return 0;

  let g = Number(retGrowth||0);
  if(!isFinite(g)) g = 0;

  if(Math.abs(g) < 1e-9){
    return fv / n;
  }

  // Preserved from current implementation for compatibility.
  const denom = (1 - Math.pow(1+g, -(n+1)));
  if(!isFinite(denom) || Math.abs(denom) < 1e-9){
    return fv / n;
  }

  return fv * g / denom;
}

export function runProjection(
  currentFunds, currentAge, retirementAge, deathAge,
  otherIncomeAnnual, annualContrib, inflation,
  nominalBaseRate, retirementGrowthRate
){
  const ages = sanitizeAges(currentAge, retirementAge, deathAge);
  currentAge = ages.currentAge;
  retirementAge = ages.retirementAge;
  deathAge = ages.deathAge;

  const yearsToRetire = Math.max(0, retirementAge - currentAge);
  const yearsInRetirement = Math.max(0, deathAge - retirementAge);

  const nominalRates = [nominalBaseRate - 0.03, nominalBaseRate, nominalBaseRate + 0.03];
  const realRates = nominalRates.map(r => ((1+r)/(1+inflation)) - 1);

  const nominalRetGrowth = retirementGrowthRate;

  function projectForRates(rates, retGrowth){
    const results = [];
    for(let i=0;i<rates.length;i++){
      const r = rates[i];
      let fv;

      if (yearsToRetire === 0){
        fv = currentFunds;
      } else if (r !== 0){
        fv = currentFunds * Math.pow(1+r, yearsToRetire) +
             annualContrib * ((Math.pow(1+r, yearsToRetire) - 1) / r);
      } else {
        fv = currentFunds + annualContrib * yearsToRetire;
      }

      const rmdAge = Math.max(retirementAge, 72);
      const factor = (RMD_LIFE_EXPECTANCY[rmdAge] !== undefined) ? RMD_LIFE_EXPECTANCY[rmdAge] : 25;

      const minDisb = (factor > 0) ? (fv / factor) : 0;
      const midDisb = fv * 0.04;
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
          remainingMin = fv * Math.pow(1+g, yearsInRetirement) -
                        minDisb * ((Math.pow(1+g, yearsInRetirement) - 1) / g);
          remainingMid = fv * Math.pow(1+g, yearsInRetirement) -
                        midDisb * ((Math.pow(1+g, yearsInRetirement) - 1) / g);
        }
      }

      results.push({
        fv,
        growth_rate: r,
        min_disb: minDisb,
        mid_disb: midDisb,
        max_disb: maxDisb,
        remaining_min: remainingMin,
        remaining_mid: remainingMid,
        other_income: otherIncomeAnnual
      });
    }
    return results;
  }

  return {
    nominalProj: projectForRates(nominalRates, nominalRetGrowth),
    realProj: projectForRates(realRates, nominalRetGrowth),
    retirementAge,
    deathAge,
    nominalRetGrowth,
    inflation,
    warnings: ages.warnings
  };
}
