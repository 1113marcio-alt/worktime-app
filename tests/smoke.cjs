const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("index.html", "utf8");
const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).filter(Boolean);
const appScript = scripts.find(script => script.includes("function calculateMonthData("));
assert.ok(appScript, "O script principal da aplicação deve existir.");

function makeApp(initialSettings = {}, initialEntries = {}) {
  const values = new Map([
    ["wt_settings", JSON.stringify(initialSettings)],
    ["wt_entries", JSON.stringify(initialEntries)]
  ]);
  const notices = [];
  class FakeFileReader {
    readAsText(file) { this.onload({ target: { result: file.content } }); }
  }
  const ctx = vm.createContext({
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    },
    window: { addEventListener() {} },
    document: {
      getElementById: id => id === "entryDate" ? { value: "2026-11-18" } : null
    },
    FileReader: FakeFileReader,
    alert: message => notices.push(message),
    confirm: () => true,
    Intl,
    Date,
    console
  });
  vm.runInContext(fs.readFileSync("country-rules.js", "utf8"), ctx);
  ctx.WTCountryRules = ctx.window.WTCountryRules;
  vm.runInContext(appScript, ctx);
  // Estes testes isolam a lógica dos dados sem depender do layout do navegador.
  vm.runInContext("renderAll = function(){}; loadSettingsToInputs = function(){};", ctx);
  return { ctx, values, notices, evaluate: code => vm.runInContext(code, ctx) };
}

test("todo o JavaScript embutido mantém sintaxe válida", () => {
  for (const script of scripts) new vm.Script(script);
  new vm.Script(fs.readFileSync("sw.js", "utf8"));
  new vm.Script(fs.readFileSync("country-rules.js", "utf8"));
  new vm.Script(fs.readFileSync("wt-i18n.js", "utf8"));
});

test("configurações antigas e registos existentes continuam disponíveis", () => {
  const old = { "2026-11-18": { date: "2026-11-18", type: "work", normal: 7.5, extra: 1, night: 0, includeBonus: true, note: "Original" } };
  const app = makeApp({ hourlyRate: 24, holidayCountry: "PT" }, old);
  assert.equal(app.evaluate("settings.hourlyRate"), 24);
  assert.equal(app.evaluate("settings.holidayCountry"), "PT");
  assert.equal(app.evaluate("settings.employerCountry"), "LU");
  assert.equal(app.evaluate("settings.residenceCountry"), "LU");
  assert.equal(app.evaluate('entries["2026-11-18"].note'), "Original");
});

test("cálculo semanal respeita pausas e turnos noturnos", () => {
  const app = makeApp();
  assert.equal(app.evaluate('hoursForSchedule({start:"08:00",end:"16:30",breakMinutes:30})'), 8);
  assert.equal(app.evaluate('hoursForSchedule({start:"22:00",end:"06:00",breakMinutes:30})'), 7.5);
  assert.equal(app.evaluate('hoursForSchedule({start:"99:00",end:"06:00",breakMinutes:0})'), null);
  assert.equal(app.evaluate('hoursForSchedule({start:"08:00",end:"08:00",breakMinutes:0})'), null);
});

test("preencher semana não substitui registos existentes", () => {
  const original = { date: "2026-11-18", type: "work", normal: 6, extra: 2, night: 0, note: "NÃO ALTERAR" };
  const app = makeApp({}, { "2026-11-18": original });
  app.evaluate("fillStandardWeek()");
  const entries = JSON.parse(app.values.get("wt_entries"));
  assert.equal(Object.keys(entries).length, 5);
  assert.deepEqual(entries["2026-11-18"], original);
  assert.equal(entries["2026-11-16"].normal, 8);
  assert.equal(entries["2026-11-20"].normal, 8);
  assert.equal(entries["2026-11-21"], undefined);
});

test("a validação rejeita ficheiros de backup incompatíveis", () => {
  const app = makeApp();
  assert.equal(app.evaluate('isValidWorkTimeBackup({settings:{},entries:{}})'), true);
  assert.equal(app.evaluate('isValidWorkTimeBackup({settings:{},entries:[]})'), false);
  assert.equal(app.evaluate('isValidWorkTimeBackup({settings:{},entries:{"2026-11-18":{date:"2026-11-19",type:"work"}}})'), false);
});

test("importação guarda cópia de recuperação antes de substituir os dados", () => {
  const original = { "2026-11-18": { date: "2026-11-18", type: "work", normal: 8, extra: 0, night: 0 } };
  const app = makeApp({ hourlyRate: 25 }, original);
  const imported = { settings: { hourlyRate: 30 }, entries: {} };
  app.ctx.importBackupJSON({ target: { files: [{ content: JSON.stringify(imported) }] } });
  assert.equal(JSON.parse(app.values.get("wt_settings")).hourlyRate, 30);
  assert.equal(Object.keys(JSON.parse(app.values.get("wt_entries"))).length, 0);
  assert.deepEqual(JSON.parse(app.values.get("wt_pre_import_backup")).entries, original);
  app.ctx.restorePreviousState();
  assert.equal(JSON.parse(app.values.get("wt_settings")).hourlyRate, 25);
  assert.deepEqual(JSON.parse(app.values.get("wt_entries")), original);
});

test("uma importação inválida não altera os dados existentes", () => {
  const app = makeApp({ hourlyRate: 20 }, {});
  const before = app.values.get("wt_settings");
  app.ctx.importBackupJSON({ target: { files: [{ content: '{"settings":{}}' }] } });
  assert.equal(app.values.get("wt_settings"), before);
  assert.equal(app.values.get("wt_pre_import_backup"), undefined);
});


const proSource = fs.readFileSync("pro-ui.js", "utf8");

test("o novo relógio e o calendário têm JavaScript válido e todos os ecrãs existem", () => {
  new vm.Script(proSource);
  for (const id of ["tab-home", "tab-calendario", "tab-ponto", "tab-registo", "tab-folha", "tab-ferias", "tab-config",
    "clockTimer", "clockPrimary", "clockFinish", "clockDraftList", "calendarGrid", "homeNet"]) {
    assert.ok(source.includes('id="' + id + '"'), "Em falta: " + id);
  }
  assert.ok(source.includes('src="pro-ui.js"'));
  assert.ok(source.includes('href="pro-ui.css"'));
  assert.ok(fs.readFileSync("sw.js", "utf8").includes("./pro-ui.js"));
  assert.ok(fs.readFileSync(".github/workflows/apk.yml", "utf8").includes("pro-ui.css pro-ui.js country-rules.js wt-i18n.js wt-widget.js www/"));
});

test("o relógio contabiliza pausas e turnos que passam da meia-noite", () => {
  const ctx = vm.createContext({ window: {}, Date, Intl, console });
  vm.runInContext(proSource, ctx);
  const helpers = ctx.window.ProUI.helpers;
  assert.equal(helpers.localDateKey("2026-11-18T12:00:00Z").slice(0, 7), "2026-11");
  const shift = {
    start: "2026-11-18T22:00:00.000Z",
    end: "2026-11-19T06:00:00.000Z",
    breaks: [
      { start: "2026-11-19T00:00:00.000Z", end: "2026-11-19T00:15:00.000Z" },
      { start: "2026-11-19T03:00:00.000Z", end: "2026-11-19T03:15:00.000Z" }
    ]
  };
  assert.equal(helpers.timeWorkedSeconds(shift, shift.end), 7.5 * 3600);
  assert.equal(helpers.timeParts(7.5 * 3600), "07:30:00");
});

test("adicionar um turno a um registo existente só soma uma vez", () => {
  const old = { "2026-11-18": { date: "2026-11-18", type: "work", normal: 6, extra: 1,
    night: 0, includeBonus: true, note: "Rota original" } };
  const app = makeApp({}, old);
  const draft = { id: "turno-1", start: "2026-11-18T08:00:00.000Z",
    end: "2026-11-18T10:00:00.000Z", breaks: [], seconds: 7200, date: "2026-11-18" };
  app.values.set("wt_shift_drafts", JSON.stringify([draft]));
  vm.runInContext(proSource, app.ctx);
  app.ctx.window.ProUI.applyDraft("turno-1");
  let entry = JSON.parse(app.values.get("wt_entries"))["2026-11-18"];
  assert.equal(entry.normal, 8);
  assert.equal(entry.extra, 1);
  assert.equal(entry.shifts.length, 1);
  assert.ok(entry.note.includes("Rota original"));
  app.values.set("wt_shift_drafts", JSON.stringify([draft]));
  app.ctx.window.ProUI.applyDraft("turno-1");
  entry = JSON.parse(app.values.get("wt_entries"))["2026-11-18"];
  assert.equal(entry.normal, 8, "Uma segunda aplicação não pode duplicar horas");
});

test("turnos da Preview são preservados em snapshots da versão 2", () => {
  const app = makeApp({}, {});
  const draft = { id: "d1", start: "2026-11-18T09:00:00Z",
    end: "2026-11-18T10:00:00Z", breaks: [], seconds: 3600, date: "2026-11-18" };
  app.values.set("wt_shift_drafts", JSON.stringify([draft]));
  const data = app.evaluate("snapshotAllData()");
  assert.equal(data.shiftDrafts.length, 1);
  assert.equal(data.shiftDrafts[0].id, "d1");
  assert.equal(app.evaluate("isValidWorkTimeBackup(snapshotAllData())"), true);
});


test("taxa de pensão e abatimento LU acompanham o mês de 2026", () => {
  const app = makeApp();
  assert.equal(app.evaluate('getLuxSocialParameters("2026-11").pensionRate'), 0.085);
  assert.equal(app.evaluate('getLuxSocialParameters("2026-11").depAllowance'), 692.83);
  assert.equal(app.evaluate('getLuxSocialParameters("2026-02").depAllowance'), 675.94);
  assert.equal(app.evaluate('getLuxSocialParameters("2025-02").pensionRate'), 0.08);
  assert.equal(app.evaluate('getLuxSocialParameters("2025-02").depAllowance'), 659.45);
});

test("simulação de mês vazio não inventa crédito fiscal", () => {
  const app = makeApp({ cisCredit: 50 }, {});
  assert.equal(app.evaluate('calculateMonthData("2026-11").totalGross'), 0);
  assert.equal(app.evaluate('calculateMonthData("2026-11").cisCreditApplied'), 0);
  assert.equal(app.evaluate('calculateMonthData("2026-11").finalNet'), 0);
});

test("CIS manual fica separado do líquido das horas, sem apagar a configuração antiga", () => {
  const old = { "2026-11-18": { date: "2026-11-18", type: "work",
    normal: 8, extra: 1, night: 0, includeBonus: true, note: "Exemplo" } };
  const app = makeApp({ cisCredit: 50 }, old);
  const d = app.evaluate('calculateMonthData("2026-11")');
  assert.ok(Math.abs(d.totalGross - 197.3) < 0.001);
  assert.equal(d.cisCreditApplied, 50);
  assert.ok(d.netBeforeCredit < d.totalGross);
  assert.ok(Math.abs(d.finalNet - d.netBeforeCredit - 50) < 0.001);
  assert.equal(app.evaluate("settings.cisCredit"), 50);
  assert.equal(app.evaluate('entries["2026-11-18"].normal'), 8);
});

test("painel e salário comunicam separadamente o CIS", () => {
  assert.ok(source.includes('id="homeCreditNotice"'));
  assert.ok(source.includes('id="salaryPreviewCredit"'));
  assert.ok(source.includes('id="salaryPreviewWithCredit"'));
  assert.ok(proSource.includes('formatMoney(data.netBeforeCredit)'));
});


test("app abre por defeito no relógio de ponto e a preferência é configurável", () => {
  const app = makeApp({}, {});
  assert.equal(app.evaluate("settings.startScreen"), "ponto");
  const changed = makeApp({startScreen:"home"}, {});
  assert.equal(changed.evaluate("settings.startScreen"), "home");
  assert.ok(source.includes('<section id="tab-ponto" class="space-y-4">'));
  assert.ok(source.includes('<section id="tab-home" class="space-y-5 hidden">'));
  assert.ok(source.includes('id="cfgStartScreen"'));
  assert.ok(proSource.includes('switchTab(preferred)'));
});

test("opções antigas continuam acessíveis após agrupar as configurações", () => {
  for (const id of ["cfgHourlyRate","cfgHourlyBonus","cfgTaxSystem","cfgTaxClass",
    "cfgLang","cfgHolidayCountry","cfgEmployerCountry","cfgResidenceCountry",
    "weeklyScheduleGrid","cfgSecurityPin","cfgStartScreen"]) {
    assert.ok(source.includes('id="' + id + '"'), "Configuração desapareceu: " + id);
  }
  assert.ok(source.includes("function organizeSettings()"));
  assert.ok(source.includes('details.className = "wt-settings-group"'));
  assert.ok(fs.readFileSync("pro-ui.css","utf8").includes(".wt-settings-group"));
});


test("LU PT FR apresentam dias de férias mínimos legais por país do empregador", () => {
  const app = makeApp();
  const { legalLeave, holidays } = app.ctx.WTCountryRules;
  assert.equal(legalLeave("LU"),26);
  assert.equal(legalLeave("PT"),22);
  assert.equal(legalLeave("FR"),25);
  assert.equal(legalLeave("DE"),null);
  assert.equal(holidays(2026,"LU").items.length,11);
  assert.equal(holidays(2026,"PT").items.length,13);
  assert.equal(holidays(2026,"FR").items.length,11);
  assert.equal(holidays(2026,"DE").verified,false);
  assert.ok(holidays(2026,"PT").items.some(x=>x.date==="2026-06-10"));
  assert.ok(holidays(2026,"FR").items.some(x=>x.date==="2026-07-14"));
  assert.ok(holidays(2026,"LU").items.some(x=>x.date==="2026-06-23"));
});

test("classes fiscais 1, 1a e 2 alteram as estimativas apenas no LU", () => {
  const app = makeApp();
  const params={country:"LU",month:"2026-11",regularGross:3000,extraBaseGross:0,
    extraMajorationGross:0,totalGross:3000,manualTaxRate:0,manualSocialRate:0,cisCredit:0};
  const engine=app.ctx.WTCountryRules.estimatePayroll;
  const one=engine({...params,classId:"1"});
  const oneA=engine({...params,classId:"1a"});
  const two=engine({...params,classId:"2"});
  assert.ok(one.taxIrs>oneA.taxIrs);
  assert.ok(oneA.taxIrs>two.taxIrs);
  const fixed=engine({...params,classId:"1",manualTaxRate:9});
  const fixed2=engine({...params,classId:"2",manualTaxRate:9});
  assert.equal(fixed.taxIrs,fixed2.taxIrs,"taxa manual deve sobrepor classe");
  const zero=engine({...params,classId:"1",manualTaxRate:0,forceManual:true});
  assert.equal(zero.taxIrs,0);
});

test("Portugal e França não apresentam a retenção LU como se fosse oficial", () => {
  const app=makeApp();
  const args={month:"2026-11",regularGross:2000,extraBaseGross:0,extraMajorationGross:0,
    totalGross:2000,classId:"2",manualTaxRate:10,manualSocialRate:12,cisCredit:50};
  const pt=app.ctx.WTCountryRules.estimatePayroll({...args,country:"PT"});
  const fr=app.ctx.WTCountryRules.estimatePayroll({...args,country:"FR"});
  assert.equal(pt.socialOther,220);
  assert.equal(fr.socialOther,240);
  assert.equal(pt.cisCreditApplied,0);
  assert.equal(fr.cisCreditApplied,0);
  assert.equal(pt.taxClassApplicable,false);
  assert.equal(fr.taxClassApplicable,false);
  assert.ok(pt.taxStatus.includes("tabelas"));
});

test("mudança de empregador atualiza férias automáticas e mantém valores manuais", () => {
  const app=makeApp();
  app.ctx.document.getElementById=() => ({value:"PT"});
  app.evaluate("saveSettings = function(){ localStorage.setItem('wt_settings',JSON.stringify(settings)); }");
  app.ctx.changeEmployerCountry();
  assert.equal(app.evaluate("settings.employerCountry"),"PT");
  assert.equal(app.evaluate("settings.annualVacation"),22);
  app.evaluate("settings.vacationAuto=false; settings.annualVacation=29;");
  app.ctx.document.getElementById=() => ({value:"FR"});
  app.ctx.changeEmployerCountry();
  assert.equal(app.evaluate("settings.annualVacation"),29);
});

test("o PIN é guardado separadamente de países e outros campos", () => {
  const app=makeApp({}, {});
  const status={textContent:"",className:""};
  const pin={value:"1234"};
  app.ctx.document.getElementById=id=>id==="cfgSecurityPin"?pin:id==="pinSaveStatus"?status:null;
  app.ctx.savePin();
  assert.equal(JSON.parse(app.values.get("wt_settings")).securityPin,"1234");
  assert.ok(status.textContent.includes("guardado"));
  pin.value="12";
  app.ctx.savePin();
  assert.equal(JSON.parse(app.values.get("wt_settings")).securityPin,"1234");
});

test("a tradução de francês altera labels no dicionário e tem fallback seguro", () => {
  const app=makeApp();
  vm.runInContext(fs.readFileSync("wt-i18n.js","utf8"),app.ctx);
  assert.equal(app.ctx.window.WTLocale.tr("Relógio de ponto","fr"),"Pointeuse");
  assert.equal(app.ctx.window.WTLocale.tr("Dados e segurança","fr"),"Données et sécurité");
  assert.equal(app.ctx.window.WTLocale.tr("Relógio de ponto","en"),"Time clock");
  assert.equal(app.ctx.window.WTLocale.tr("Relógio de ponto","pt"),"Relógio de ponto");
});


test("país do empregador pode sincronizar feriados sem alterar residência", () => {
  const app=makeApp({residenceCountry:"LU",holidayCountry:"LU",syncCalendarWithEmployer:true}, {});
  const refs={
    cfgEmployerCountry:{value:"PT"},
    cfgHolidayCountry:{value:"LU"},
    cfgAnnualVacation:{value:26},
    cfgSyncCalendarWithEmployer:{checked:true}
  };
  app.ctx.document.getElementById=id=>refs[id] || {value:""};
  app.evaluate("saveSettings = function(){ settings.annualVacation=Number(document.getElementById('cfgAnnualVacation').value); settings.holidayCountry=document.getElementById('cfgHolidayCountry').value; localStorage.setItem('wt_settings',JSON.stringify(settings)); }");
  app.ctx.changeEmployerCountry();
  assert.equal(app.evaluate("settings.employerCountry"),"PT");
  assert.equal(app.evaluate("settings.annualVacation"),22);
  assert.equal(app.evaluate("settings.holidayCountry"),"PT");
  assert.equal(app.evaluate("settings.residenceCountry"),"LU");
  refs.cfgHolidayCountry.value="FR";
  app.evaluate("saveSettings = function(){ settings.holidayCountry=document.getElementById('cfgHolidayCountry').value; settings.employerCountry=document.getElementById('cfgEmployerCountry').value; settings.annualVacation=Number(document.getElementById('cfgAnnualVacation').value); localStorage.setItem('wt_settings',JSON.stringify(settings)); }");
  app.ctx.confirm=()=>false;
  app.ctx.changeCalendarCountry();
  assert.equal(app.evaluate("settings.syncCalendarWithEmployer"),false);
  assert.equal(app.evaluate("settings.holidayCountry"),"FR");
  assert.equal(app.evaluate("settings.employerCountry"),"PT");
  app.ctx.confirm=()=>true;
  refs.cfgHolidayCountry.value="LU";
  app.ctx.changeCalendarCountry();
  assert.equal(app.evaluate("settings.holidayCountry"),"LU");
  assert.equal(app.evaluate("settings.employerCountry"),"LU");
  assert.equal(app.evaluate("settings.annualVacation"),26);
});

test("tradução aplica prefixos numerados nas definições", () => {
  const app=makeApp();
  vm.runInContext(fs.readFileSync("wt-i18n.js","utf8"),app.ctx);
  const tr=app.ctx.window.WTLocale.tr;
  assert.equal(tr("3. Idioma","fr"),"3. Langue");
  assert.equal(tr("4. País dos Feriados e Férias","fr"),"4. Pays des jours fériés et congés");
  assert.equal(tr("4B. Horário semanal personalizado","fr"),"4B. Horaires hebdomadaires personnalisés");
});


test("escolha de tema escuro/claro fica guardada sem perder configurações", () => {
  const app=makeApp({theme:"dark", hourlyRate:28}, {});
  const dom={classList:{toggle(){}},style:{},setAttribute(name,value){this[name]=value;}};
  const button={textContent:""};
  app.ctx.document.documentElement=dom;
  app.ctx.document.getElementById=id=>id==="cfgThemeButton"?button:null;
  app.ctx.document.querySelectorAll=()=>[];
  app.ctx.toggleTheme();
  assert.equal(JSON.parse(app.values.get("wt_settings")).theme,"light");
  assert.equal(JSON.parse(app.values.get("wt_settings")).hourlyRate,28);
  assert.equal(dom["data-wt-theme"],"light");
  assert.ok(button.textContent.includes("escuro"));
  app.ctx.toggleTheme();
  assert.equal(dom["data-wt-theme"],"dark");
  assert.equal(JSON.parse(app.values.get("wt_settings")).theme,"dark");
  assert.ok(fs.readFileSync("pro-ui.css","utf8").includes('html[data-wt-theme="light"] .wt-card'));
});

test("o inglês traduz textos antes misturados e os avisos dinâmicos dos países", () => {
  const app=makeApp();
  vm.runInContext(fs.readFileSync("wt-i18n.js","utf8"),app.ctx);
  const tr=app.ctx.window.WTLocale.tr;
  assert.equal(tr("Usar também o calendário de feriados do país empregador","en"),
    "Use the employer country's holiday calendar too");
  assert.equal(tr("Modo claro","en"),"Light mode");
  assert.equal(tr("Ativar modo claro","fr"),"Activer le thème clair");
  assert.ok(tr("Empregador: LU (salário e férias). Calendário: FR (feriados). Feriados nacionais disponíveis.","en")
    .startsWith("Employer: LU"));
  assert.ok(tr("Mínimo legal geral PT: 22 dias. Atualização automática ativa.","fr")
    .startsWith("Minimum légal général PT"));
});

test("o widget tem manifesto nativo, pedido opcional, filas de ações e controlo de PIN", () => {
  const files=[
    "android-widget/src/main/java/lu/marcio/worktimepro/preview/WidgetStore.java",
    "android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeWidgetProvider.java",
    "android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeWidgetPlugin.java",
    "android-widget/res/xml/worktime_widget_info.xml",
    "android-widget/res/layout/widget_worktime.xml",
    "scripts/install_android_widget.py","wt-widget.js"
  ];
  files.forEach(path=>assert.ok(fs.existsSync(path),"Ficheiro widget em falta: "+path));
  const provider=fs.readFileSync(files[1],"utf8");
  const store=fs.readFileSync(files[0],"utf8");
  const plugin=fs.readFileSync(files[2],"utf8");
  assert.ok(store.includes("pending_events"));
  assert.ok(store.includes("events.length() >= 512"));
  assert.ok(provider.includes("AppWidgetProvider"));
  assert.ok(plugin.includes('requestPinAppWidget'));
  assert.ok(plugin.includes('getPendingActions'));
  assert.ok(fs.readFileSync("index.html","utf8").includes('id="cfgWidgetEnabled"'));
  assert.ok(fs.readFileSync(".github/workflows/apk.yml","utf8").includes("install_android_widget.py"));
  new vm.Script(fs.readFileSync("wt-widget.js","utf8"));
});

test("marcações de widget fechado são reaplicadas como rascunho sem duplicar horas", async () => {
  const app=makeApp({}, {});
  let queue=[
    {id:"widget-start",at:"2026-11-18T08:00:00.000Z",action:"start"},
    {id:"widget-pause",at:"2026-11-18T10:00:00.000Z",action:"pause"},
    {id:"widget-resume",at:"2026-11-18T10:30:00.000Z",action:"resume"},
    {id:"widget-finish",at:"2026-11-18T16:30:00.000Z",action:"finish"}
  ];
  const displayed=[];
  app.ctx.window.Capacitor={Plugins:{WorkTimeWidget:{
    getPendingActions:async()=>({events:[...queue]}),
    acknowledgeActions:async({throughId})=>{
      const i=queue.findIndex(e=>e.id===throughId);
      if(i>=0)queue=queue.slice(i+1);
    },
    updateState:async(state)=>{displayed.push(state);},
    setEnabled:async()=>{}
  }}};
  vm.runInContext(proSource,app.ctx);
  vm.runInContext(fs.readFileSync("wt-widget.js","utf8"),app.ctx);
  await app.ctx.window.WTWidget.sync();
  assert.equal(queue.length,0);
  assert.equal(app.values.get("wt_active_shift"),undefined);
  const drafts=JSON.parse(app.values.get("wt_shift_drafts"));
  assert.equal(drafts.length,1);
  assert.equal(drafts[0].seconds,8*3600);
  assert.equal(drafts[0].source,"android-widget");
  assert.equal(displayed.at(-1).state,"idle");
  // A native retry must not create a second draft.
  queue=[{id:"widget-finish",at:"2026-11-18T16:30:00.000Z",action:"finish"}];
  await app.ctx.window.WTWidget.sync();
  assert.equal(JSON.parse(app.values.get("wt_shift_drafts")).length,1);
  assert.equal(app.values.get("wt_entries"),"{}","O widget nunca escreve diretamente no histórico salarial");
});


test("histórico deriva de registos antigos, turnos confirmados e rascunhos sem apagar dados", () => {
  const old={
    "2026-11-16":{date:"2026-11-16",type:"work",normal:8,extra:1,note:"Rota antiga"},
    "2026-11-17":{date:"2026-11-17",type:"work",normal:8,extra:0,
      shifts:[{id:"saved-1",start:"2026-11-17T08:00:00Z",end:"2026-11-17T16:30:00Z",
        seconds:28800,breaks:[{start:"2026-11-17T12:00:00Z",end:"2026-11-17T12:30:00Z"}]}]}
  };
  const app=makeApp({},old);
  app.values.set("wt_shift_drafts",JSON.stringify([{
    id:"draft-1",date:"2026-11-18",start:"2026-11-18T09:00:00Z",
    end:"2026-11-18T10:00:00Z",seconds:3600,breaks:[]
  }]));
  vm.runInContext(proSource,app.ctx);
  const rows=app.ctx.window.ProUI.helpers.historyRows();
  assert.equal(rows.length,3);
  assert.equal(rows.filter(row=>row.status==="saved").length,2);
  assert.equal(rows.filter(row=>row.status==="draft").length,1);
  assert.ok(rows.some(row=>row.legacy&&row.hours===9));
  assert.ok(rows.some(row=>row.id==="saved-1"&&row.breaks.length===1));
  assert.equal(JSON.parse(app.values.get("wt_entries"))["2026-11-16"].note,"Rota antiga");
  assert.ok(source.includes('id="clockHistoryList"'));
});

test("notificações de turno só aparecem com autorização e reutilizam as ações seguras do widget", () => {
  const notification="android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeNotification.java";
  assert.ok(fs.existsSync(notification));
  const native=fs.readFileSync(notification,"utf8");
  const store=fs.readFileSync("android-widget/src/main/java/lu/marcio/worktimepro/preview/WidgetStore.java","utf8");
  const plugin=fs.readFileSync("android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeWidgetPlugin.java","utf8");
  const installer=fs.readFileSync("scripts/install_android_widget.py","utf8");
  assert.ok(native.includes('WidgetStore.notificationsEnabled(context)'));
  assert.ok(native.includes('WidgetStore.isEnabled(context)'));
  assert.ok(native.includes('Manifest.permission.POST_NOTIFICATIONS'));
  assert.ok(native.includes('setOngoing(true)'));
  assert.ok(store.includes('KEY_NOTIFICATIONS'));
  assert.ok(plugin.includes('setShiftNotifications'));
  assert.ok(plugin.includes('openNotificationSettings'));
  assert.ok(installer.includes('android.permission.POST_NOTIFICATIONS'));
  assert.ok(source.includes('id="cfgShiftNotifications"'));
  assert.ok(fs.readFileSync("wt-widget.js","utf8").includes('toggleNotifications'));
});

test("marcação na aplicação aguarda sincronização do widget e preserva rascunhos", () => {
  assert.ok(proSource.includes("async function primaryClockAction()"));
  assert.ok(proSource.includes("async function finishShift()"));
  assert.ok(proSource.includes("async function discardActive()"));
  new vm.Script(proSource);
});
