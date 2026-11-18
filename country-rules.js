/* WorkTime Pro 2 — Country policies.
   National holidays + annual leave minima are legally grounded for LU/PT/FR.
   Country-specific withholding calculations are NOT certified payroll software.
   Official sources:
   LU leave: https://guichet.public.lu/en/entreprises/ressources-humaines/conges/annuel/conge-annuel.html
   LU public holidays: https://guichet.public.lu/en/entreprises/ressources-humaines/conditions-travail/gestion/travail-jours-feries.html
   PT leave/holidays: https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475
   FR leave: https://www.service-public.gouv.fr/particuliers/vosdroits/F2258
   FR public holidays: https://www.service-public.gouv.fr/particuliers/vosdroits/F2405
   PT social rate: https://www.seg-social.pt/ptss/pssd/menu/trabalho/remuneracoes-contribuicoes/entidades-empregadoras/calculo-contribuicoes
   LU taxes: https://impotsdirects.public.lu/fr/support/foire-aux-questions/faq-fr/residents.html
   FR withholding: https://entreprendre.service-public.gouv.fr/vosdroits/F34732
   PT withholding: https://info.portaldasfinancas.gov.pt/pt/atualidades/legislativa/Paginas/Despacho-233-A-2026.aspx
*/
(function (root) {
  "use strict";

  const policies = {
    LU: { paidLeave: 26, leaveUnit: "dias de trabalho", holidaysVerified: true, taxModel: "LU_ESTIMATE",
      taxSource: "https://impotsdirects.public.lu/content/acd/fr/baremes.html", holidaysSource: "https://guichet.public.lu/en/entreprises/ressources-humaines/conditions-travail/gestion/travail-jours-feries.html" },
    PT: { paidLeave: 22, leaveUnit: "dias úteis", holidaysVerified: true, taxModel: "PT_MANUAL",
      taxSource: "https://info.portaldasfinancas.gov.pt/pt/atualidades/legislativa/Paginas/Despacho-233-A-2026.aspx", holidaysSource: "https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475" },
    FR: { paidLeave: 25, leaveUnit: "dias úteis equivalentes (30 dias ouvrables)", holidaysVerified: true, taxModel: "FR_MANUAL",
      taxSource: "https://entreprendre.service-public.gouv.fr/vosdroits/F34732", holidaysSource: "https://www.service-public.gouv.fr/particuliers/vosdroits/F2405" }
  };
  const iso = (year, month, day) => String(year) + "-" + String(month).padStart(2, "0") +
    "-" + String(day).padStart(2, "0");

  // Gregorian Easter (Meeus/Jones/Butcher), valid for modern years.
  function easterSunday(year) {
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
    const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
    const l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*m+114)/31);
    const day=((h+l-7*m+114)%31)+1;
    return new Date(Date.UTC(year,month-1,day,12));
  }
  function shifted(date,days) {
    const d = new Date(date.getTime()); d.setUTCDate(d.getUTCDate()+days);
    return iso(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());
  }
  function holidays(year,country,region) {
    const y=Number(year);
    if(!Number.isInteger(y)||y<2000||y>2100) return {items:[],verified:false};
    const e=easterSunday(y);
    let fixed=[],moving=[];
    if(country==="LU") {
      fixed=[[1,1,"Ano Novo"],[5,1,"Dia do Trabalhador"],[5,9,"Dia da Europa"],
        [6,23,"Dia Nacional"],[8,15,"Assunção"],[11,1,"Todos os Santos"],
        [12,25,"Natal"],[12,26,"Santo Estêvão"]];
      moving=[[-0+1,"Segunda-feira de Páscoa"],[39,"Ascensão"],[50,"Segunda-feira de Pentecostes"]];
    } else if(country==="PT") {
      fixed=[[1,1,"Ano Novo"],[4,25,"Dia da Liberdade"],[5,1,"Dia do Trabalhador"],
        [6,10,"Dia de Portugal"],[8,15,"Assunção"],[10,5,"Implantação da República"],
        [11,1,"Todos os Santos"],[12,1,"Restauração da Independência"],
        [12,8,"Imaculada Conceição"],[12,25,"Natal"]];
      moving=[[-2,"Sexta-feira Santa"],[0,"Páscoa"],[60,"Corpo de Deus"]];
    } else if(country==="FR") {
      fixed=[[1,1,"Jour de l'An"],[5,1,"Fête du Travail"],[5,8,"Victoire 1945"],
        [7,14,"Fête nationale"],[8,15,"Assomption"],[11,1,"Toussaint"],
        [11,11,"Armistice 1918"],[12,25,"Noël"]];
      moving=[[1,"Lundi de Pâques"],[39,"Ascension"],[50,"Lundi de Pentecôte"]];
      const normalized=String(region||"").toLowerCase();
      // FR regional holidays require locality-specific checks. Only explicit Alsace/Moselle.
      if(/alsace|moselle|bas-rhin|haut-rhin/i.test(normalized)) {
        fixed.push([12,26,"Saint-Étienne (Alsace-Moselle)"]);
        // Good Friday is local to qualifying communes: not added automatically.
      }
    } else return {items:[],verified:false};
    const items=[
      ...fixed.map(([m,d,name])=>({date:iso(y,m,d),name})),
      ...moving.map(([offset,name])=>({date:shifted(e,offset),name}))
    ].sort((a,b)=>a.date.localeCompare(b.date));
    return {items,verified:true,source:policies[country].holidaysSource};
  }
  function legalLeave(country) {
    return policies[country] ? policies[country].paidLeave : null;
  }
  function pct(value) {
    const n=Number(value);
    return Number.isFinite(n) ? Math.min(100,Math.max(0,n))/100 : 0;
  }
  function estimatePayroll({country,month,regularGross,extraBaseGross,extraMajorationGross,totalGross,
    classId,manualTaxRate,manualSocialRate,cisCredit}) {
    const c=String(country||"LU").toUpperCase();
    const total=Math.max(0,Number(totalGross)||0);
    const regular=Math.max(0,Number(regularGross)||0);
    const extraBase=Math.max(0,Number(extraBaseGross)||0);
    const extraMajor=Math.max(0,Number(extraMajorationGross)||0);
    const base=regular+extraBase+extraMajor;
    const manualTax=pct(manualTaxRate), manualSocial=pct(manualSocialRate);
    const override=manualTax>0;
    let pension=0,health=0,dependency=0,socialOther=0,tax=0,effectiveTaxRate=0;
    let taxLabel="",taxStatus="",taxSource="";
    let socialComplete=false;
    let taxClassApplicable=false;
    let depAllowance=0,pensionRate=0;
    if(c==="LU"){
      // Existing approximate LU model; do not label official. 2026 pension 8.5%.
      pensionRate=month>="2026-01"?0.085:0.08;
      depAllowance=month>="2026-06"?692.83:675.94;
      pension=regular*pensionRate;
      health=(regular+extraBase)*0.0305;
      dependency=Math.max(0,regular+extraBase-depAllowance)*0.014;
      const taxable=Math.max(0,regular-pension-health);
      const monthlyClass=String(classId||"1");
      taxClassApplicable=true;
      if(override) effectiveTaxRate=manualTax;
      else if(monthlyClass==="2") effectiveTaxRate=taxable>4500?0.11:taxable>3200?0.065:0.02;
      else if(monthlyClass==="1a") effectiveTaxRate=taxable>4000?0.14:0.07;
      else effectiveTaxRate=taxable>4000?0.19:taxable>3000?0.13:0.08;
      tax=taxable*effectiveTaxRate;
      taxLabel="Classe "+monthlyClass+(override?" • taxa manual":" • estimativa por classe");
      taxStatus="Luxemburgo — simulação simplificada, não corresponde ao barème oficial de retenção. "
        +(override?"Taxa manual substitui o cálculo por classe.":"Classe fiscal altera a estimativa.");
      taxSource=policies.LU.taxSource;
      socialComplete=true; // apenas os componentes sociais atualmente modelados.
    }else if(c==="PT"){
      // Taxa habitual do trabalhador por conta de outrem (regime geral).
      socialOther=base*.11;
      effectiveTaxRate=manualTax;
      tax=Math.max(0,base-socialOther)*effectiveTaxRate;
      taxLabel=override?"IRS • retenção manual":"IRS • retenção não configurada";
      taxStatus="Portugal — Segurança Social geral estimada a 11%. A retenção IRS depende "
        +"das tabelas de 2026, agregado, dependentes e região. Introduza a taxa do recibo. "
        +"As classes 1/1a/2 do Luxemburgo não se aplicam.";
      taxSource=policies.PT.taxSource;
      socialComplete=false;
    }else if(c==="FR"){
      socialOther=base*manualSocial;
      tax=base*manualTax;
      effectiveTaxRate=manualTax;
      taxLabel=manualTax>0?"PAS • taxa manual":"PAS • sem taxa configurada";
      taxStatus="França — prélèvement à la source baseado na taxa comunicada pelo fisco "
        +"ao empregador. Indique a taxa real e uma taxa social manual; sem esta última "
        +"o líquido está incompleto. A classe fiscal luxemburguesa não se aplica.";
      taxSource=policies.FR.taxSource;
    }else{
      socialOther=base*manualSocial;
      tax=base*manualTax;
      effectiveTaxRate=manualTax;
      taxLabel="Cálculo manual";
      taxStatus="País ainda sem motor fiscal verificado. Indique taxas manualmente. "
        +"O líquido é apenas um valor parcial e não deve ser usado como recibo.";
    }
    const deductions=pension+health+dependency+socialOther+tax;
    const beforeCredit=total-deductions;
    const cisCreditApplied=(c==="LU"&&total>0)?Math.max(0,Number(cisCredit)||0):0;
    return {ccssPension:pension,ccssHealth:health,ccssDep:dependency,socialOther,
      taxIrs:tax,effectiveTaxRate,netBeforeCredit:beforeCredit,
      finalNet:beforeCredit+cisCreditApplied,cisCreditApplied,
      taxLabel,taxStatus,taxSource,socialComplete,taxClassApplicable,pensionRate,depAllowance,
      country:c,manualMode:c!=="LU"||override};
  }
  root.WTCountryRules={holidays,legalLeave,policies,estimatePayroll,easterSunday};
}(window));
