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
  assert.ok(fs.readFileSync(".github/workflows/apk.yml", "utf8").includes("pro-ui.css pro-ui.js country-rules.js wt-i18n.js wt-widget.js wt-icon.svg www/"));
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

function setupPinSecurity(app) {
  app.ctx.window.crypto=require("node:crypto").webcrypto;
  app.ctx.window.btoa=btoa;
  app.ctx.window.atob=atob;
  app.ctx.TextEncoder=TextEncoder;
  vm.runInContext(fs.readFileSync("wt-pin.js","utf8"),app.ctx);
}

test("PIN novo usa verificador criptográfico e não é guardado em texto", async() => {
  const app=makeApp({}, {});
  setupPinSecurity(app);
  const status={textContent:"",className:""};
  const pin={value:"1234"};
  app.ctx.document.getElementById=id=>id==="cfgSecurityPin"?pin:id==="pinSaveStatus"?status:null;
  assert.equal(await app.ctx.savePin(),true);
  const settings=JSON.parse(app.values.get("wt_settings"));
  const verifier=JSON.parse(app.values.get("wt_pin_verifier"));
  assert.equal(settings.securityPin,"");
  assert.ok(!app.values.get("wt_settings").includes("1234"));
  assert.equal(verifier.algorithm,"PBKDF2-SHA256");
  assert.ok(verifier.iterations >= 100000);
  assert.equal(await app.ctx.window.WTPin.verify("1234",verifier),true);
  assert.equal(await app.ctx.window.WTPin.verify("2345",verifier),false);
  assert.ok(status.textContent.includes("guardado"));
  assert.equal(pin.value,"");
  pin.value="12";
  assert.equal(await app.ctx.savePin(),false);
  assert.equal(JSON.parse(app.values.get("wt_pin_verifier")).hash,verifier.hash);
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


function prepareWidgetActivationTest(webEnabled,nativeInitiallyEnabled) {
  const app=makeApp({widgetEnabled:webEnabled}, {});
  const checkbox={checked:false};
  const feedback={textContent:"",className:""};
  const notificationFeedback={textContent:"",className:""};
  app.ctx.document.getElementById=id=>id==="cfgWidgetEnabled"?checkbox:
    id==="widgetStatus"?feedback:id==="notificationStatus"?notificationFeedback:null;
  app.ctx.document.addEventListener=()=>{};
  let nativeEnabled=nativeInitiallyEnabled;
  const enabledCalls=[];
  app.ctx.window.Capacitor={Plugins:{WorkTimeWidget:{
    getStatus:async()=>({enabled:nativeEnabled,hasPendingEvents:false,
      notificationsEnabled:false,state:"idle"}),
    getPendingActions:async()=>({events:[]}),
    updateState:async()=>{},
    setEnabled:async({enabled})=>{
      enabledCalls.push(enabled);
      nativeEnabled=enabled;
      return {enabled:nativeEnabled};
    },
    setShiftNotifications:async()=>({systemAllowed:true})
  }}};
  vm.runInContext(fs.readFileSync("wt-widget.js","utf8"),app.ctx);
  return {app,checkbox,feedback,enabledCalls,getNative:()=>nativeEnabled};
}

test("o widget previamente autorizado continua ativo mesmo com backup local desatualizado",async()=>{
  const x=prepareWidgetActivationTest(false,true);
  await x.app.ctx.window.WTWidget.init();
  assert.equal(x.checkbox.checked,true);
  assert.equal(x.getNative(),true);
  assert.deepEqual(x.enabledCalls,[],"a inicialização nunca desativa o widget já autorizado");
  assert.equal(JSON.parse(x.app.values.get("wt_settings")).widgetEnabled,true);
});

test("se o Android desativou o widget, exige reativação explícita sem perder registos",async()=>{
  const original={"2026-11-18":{date:"2026-11-18",type:"work",normal:8,extra:1}};
  const x=prepareWidgetActivationTest(true,false);
  x.app.values.set("wt_entries",JSON.stringify(original));
  await x.app.ctx.window.WTWidget.init();
  assert.equal(x.getNative(),false);
  assert.equal(x.checkbox.checked,false);
  assert.deepEqual(x.enabledCalls,[]);
  assert.match(x.feedback.textContent,/reativ/i);
  await x.app.ctx.window.WTWidget.reactivate();
  assert.equal(x.getNative(),true);
  assert.equal(x.checkbox.checked,true);
  assert.deepEqual(x.enabledCalls,[true]);
  assert.equal(JSON.parse(x.app.values.get("wt_settings")).widgetEnabled,true);
  assert.deepEqual(JSON.parse(x.app.values.get("wt_entries")),original);
  const plugin=fs.readFileSync("android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeWidgetPlugin.java","utf8");
  assert.ok(plugin.includes("void getStatus(PluginCall call)"));
  assert.ok(source.includes("WTWidget.reactivate()"));
});


test("assinatura permanente usa apenas segredos privados e distingue APK debug de assinado", () => {
  const workflow=fs.readFileSync(".github/workflows/apk.yml","utf8");
  const signer=fs.readFileSync("scripts/configure_android_release_signing.py","utf8");
  for(const secret of ["WORKTIME_PREVIEW_KEYSTORE_B64",
    "WORKTIME_PREVIEW_STORE_PASSWORD","WORKTIME_PREVIEW_KEY_ALIAS",
    "WORKTIME_PREVIEW_KEY_PASSWORD"]) {
    assert.ok(workflow.includes("secrets."+secret));
  }
  assert.ok(workflow.includes("base64 --decode"));
  assert.ok(workflow.includes("WORKTIME_SIGNED=true"));
  assert.ok(workflow.includes("./gradlew assembleRelease"));
  assert.ok(workflow.includes("./gradlew assembleDebug"));
  assert.ok(workflow.includes("WorkTime-Pro-2-PREVIEW-SIGNED.apk"));
  assert.ok(workflow.includes("WorkTime-Pro-2-PREVIEW-DEBUG.apk"));
  assert.ok(workflow.includes("dist/*.apk"));
  assert.ok(signer.includes("System.getenv('WORKTIME_KEYSTORE_PATH')"));
  assert.ok(!signer.includes("BEGIN PRIVATE KEY"));
  assert.ok(fs.readFileSync("docs/ANDROID-SIGNING.md","utf8").includes("não poderá atualizar diretamente"));
});

test("idiomas traduzem histórico e configurações de widget e notificações",()=>{
  const app=makeApp();
  vm.runInContext(fs.readFileSync("wt-i18n.js","utf8"),app.ctx);
  const tr=app.ctx.window.WTLocale.tr;
  assert.equal(tr("Histórico de turnos","en"),"Shift history");
  assert.equal(tr("Histórico de turnos","fr"),"Historique des services");
  assert.equal(tr("Widget no ecrã inicial","en"),"Home screen widget");
  assert.equal(tr("Mostrar notificação durante o turno","fr"),
    "Afficher une notification pendant le service");
  assert.equal(tr("Arquivo de horas","de"),"Stundenarchiv");
  assert.equal(tr("Arquivo de horas","es"),"Archivo de horas");
  assert.equal(tr("Arquivo de horas","lu"),"Stonnenarchiv");
});

test("notificações nativas autorizadas não são desativadas automaticamente ao abrir a app",async()=>{
  const x=prepareWidgetActivationTest(true,true);
  let setNativeCalls=0;
  const plugin=x.app.ctx.window.Capacitor.Plugins.WorkTimeWidget;
  plugin.getShiftNotificationStatus=async()=>({enabled:true,systemAllowed:true});
  plugin.setShiftNotifications=async()=>{setNativeCalls++;return {systemAllowed:true};};
  const notificationCheckbox={checked:false};
  const oldGet=x.app.ctx.document.getElementById;
  x.app.ctx.document.getElementById=id=>id==="cfgShiftNotifications"?notificationCheckbox:oldGet(id);
  await x.app.ctx.window.WTWidget.init();
  assert.equal(setNativeCalls,0);
  assert.equal(notificationCheckbox.checked,true);
  assert.equal(JSON.parse(x.app.values.get("wt_settings")).shiftNotifications,true);
  assert.equal(x.getNative(),true);
  assert.deepEqual(x.enabledCalls,[]);
});


test("widget compacto 4x1 mantém os botões e apresenta o novo logo WT", () => {
  const widget = fs.readFileSync("android-widget/res/layout/widget_worktime.xml","utf8");
  const dims = fs.readFileSync("android-widget/res/xml/worktime_widget_info.xml","utf8");
  const provider = fs.readFileSync("android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeWidgetProvider.java","utf8");
  assert.ok(widget.includes('android:orientation="horizontal"'));
  assert.ok(widget.includes('android:src="@drawable/wt_logo_badge"'));
  for(const id of ["widget_logo","widget_title","widget_status","widget_primary","widget_finish"])
    assert.ok(widget.includes('android:id="@+id/'+id+'"'),id);
  assert.ok(dims.includes('android:minHeight="65dp"'));
  assert.ok(dims.includes('android:minWidth="250dp"'));
  assert.ok(dims.includes('android:resizeMode="horizontal|vertical"'));
  for(const id of ["widget_primary","widget_finish","widget_title","widget_logo"])
    assert.ok(provider.includes("R.id."+id));
  for(const operation of ["ACTION_START", "ACTION_PAUSE", "ACTION_RESUME", "ACTION_FINISH"])
    assert.ok(provider.includes(operation));
  assert.ok(provider.includes("WidgetStore.record(context, operation)"),
    "As ações nativas continuam registadas na fila persistente");
});

test("ícone do Android e PWA compartilham o mesmo logotipo WT azul da aplicação", () => {
  const foreground=fs.readFileSync("android-widget/res/drawable/wt_launcher_foreground.xml","utf8");
  const badge=fs.readFileSync("android-widget/res/drawable/wt_logo_badge.xml","utf8");
  const bg=fs.readFileSync("android-widget/res/drawable/wt_launcher_background.xml","utf8");
  const svg=fs.readFileSync("wt-icon.svg","utf8");
  const style=fs.readFileSync("pro-ui.css","utf8");
  const manifest=JSON.parse(fs.readFileSync("manifest.json","utf8"));
  const script=fs.readFileSync("scripts/install_android_widget.py","utf8");
  assert.ok(foreground.includes('android:fillColor="#FFFFFF"'));
  const path=foreground.match(/android:pathData="([^"]+)"/);
  assert.ok(path,"As letras WT devem existir no vector");
  assert.ok(svg.includes('d="'+path[1]+'"'),
    "O mesmo desenho WT deve aparecer no ícone web e nativo");
  for(const color of ["#2F6AF0","#54C8D9"]) {
    assert.ok(bg.includes(color));
    assert.ok(svg.includes(color));
  }
  assert.ok(badge.includes('@drawable/wt_launcher_foreground'));
  assert.ok(style.toLowerCase().includes("#2f6af0"));
  assert.ok(style.toLowerCase().includes("#54c8d9"));
  for(const filename of ["ic_launcher.xml","ic_launcher_round.xml"]) {
    const file="android-widget/res/mipmap-anydpi-v26/"+filename;
    assert.ok(fs.existsSync(file));
    const xml=fs.readFileSync(file,"utf8");
    assert.ok(xml.includes('@drawable/wt_launcher_foreground'));
    assert.ok(xml.includes('@drawable/wt_launcher_background'));
  }
  assert.ok(script.includes('app.set(f"{{{NS}}}icon", "@mipmap/ic_launcher")'));
  assert.equal(manifest.icons[0].src,"./wt-icon.svg");
  assert.ok(!manifest.icons[0].src.startsWith("https://"),
    "Ícone não deve depender de um site externo");
  assert.ok(source.includes('href="wt-icon.svg"'));
  assert.ok(fs.readFileSync(".github/workflows/apk.yml","utf8")
    .includes("wt-widget.js wt-icon.svg www/"));
  assert.ok(fs.readFileSync("sw.js","utf8").includes("'./wt-icon.svg'"));
});


test("widget compacto mostra cronómetro nativo que corre sem abrir a app", () => {
  const xml=fs.readFileSync("android-widget/res/layout/widget_worktime.xml","utf8");
  const provider=fs.readFileSync("android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeWidgetProvider.java","utf8");
  const store=fs.readFileSync("android-widget/src/main/java/lu/marcio/worktimepro/preview/WidgetStore.java","utf8");
  const plugin=fs.readFileSync("android-widget/src/main/java/lu/marcio/worktimepro/preview/WorkTimeWidgetPlugin.java","utf8");
  assert.ok(xml.includes("<Chronometer"));
  assert.ok(xml.includes('android:id="@+id/widget_elapsed"'));
  assert.ok(xml.includes('android:orientation="horizontal"'));
  assert.ok(xml.includes('android:layout_height="wrap_content"'));
  assert.ok(provider.includes("SystemClock.elapsedRealtime() - elapsedMillis"));
  assert.ok(provider.includes("view.setChronometer(R.id.widget_elapsed"));
  assert.ok(provider.includes('"working".equals(state)'));
  assert.ok(provider.includes("WidgetStore.workedMillis(context)"));
  for(const field of ["KEY_WORKED_MS","KEY_WORKING_SINCE"]){
    assert.ok(store.includes(field));
  }
  assert.ok(store.includes('if ("pause".equals(action))'));
  assert.ok(store.includes('edit.putLong(KEY_WORKED_MS, elapsedBeforeAction)'));
  assert.ok(store.includes('edit.remove(KEY_WORKING_SINCE)'));
  assert.ok(store.includes('if ("resume".equals(action))'));
  assert.ok(store.includes('edit.putLong(KEY_WORKING_SINCE, nowMillis)'));
  assert.ok(store.includes("pending(context).length() > 0"));
  assert.ok(plugin.includes('call.getInt("workedSeconds", 0)'));
  assert.ok(fs.readFileSync("wt-widget.js","utf8").includes("timeWorkedSeconds(shift,new Date().toISOString())"));
});

test("tempo enviado ao widget exclui pausa aberta e pausa concluída", async() => {
  const app=makeApp({}, {});
  const now=Date.now();
  const iso=offset=>new Date(now+offset*1000).toISOString();
  const active={id:"test-shift",start:iso(-30*60),status:"paused",
    breaks:[{start:iso(-20*60),end:iso(-15*60)},{start:iso(-5*60),end:null}]};
  app.values.set("wt_active_shift",JSON.stringify(active));
  vm.runInContext(proSource,app.ctx);
  const states=[];
  app.ctx.window.Capacitor={Plugins:{WorkTimeWidget:{updateState:async state=>states.push(state)}}};
  vm.runInContext(fs.readFileSync("wt-widget.js","utf8"),app.ctx);
  await app.ctx.window.WTWidget.publish();
  assert.equal(states.length,1);
  assert.equal(states[0].state,"paused");
  assert.ok(states[0].workedSeconds>=1198&&states[0].workedSeconds<=1201,
    "30 min de turno menos 5 min pausa anterior e 5 min pausa aberta = 20 min");
  active.status="working";
  active.breaks[1].end=iso(0);
  app.values.set("wt_active_shift",JSON.stringify(active));
  await app.ctx.window.WTWidget.publish();
  assert.equal(states[1].state,"working");
  assert.ok(states[1].workedSeconds>=1198&&states[1].workedSeconds<=1201);
  app.values.delete("wt_active_shift");
  await app.ctx.window.WTWidget.publish();
  assert.equal(states[2].state,"idle");
  assert.equal(states[2].workedSeconds,0);
});


function manualDayFixture(app, date="2026-11-11") {
  const elements={};
  const ids=["entryDate","entryType","entryUseTimes","entryStartTime","entryEndTime",
    "entryBreakMinutes","entryNextDay","entryNormal","entryExtra","entryNight",
    "entryIncludeBonus","entryNote","currentMonthPicker","manualClockPanel",
    "manualClockFields","manualTotalHint","entrySaveButton","entrySaveText",
    "entrySaveStatus","entryTimePreview","manualEntryCard",
    "paidLeavePanel","paidLeaveHint","entryPaidLeaveHours"];
  for(const id of ids) elements[id]={
    value:"",checked:false,readOnly:false,disabled:false,
    textContent:"",className:"",
    classList:{toggle(){},add(){},remove(){}},
    addEventListener(){},
  };
  elements.entryDate.value=date;
  elements.entryType.value="work";
  elements.entryUseTimes.checked=true;
  elements.entryStartTime.value="06:02";
  elements.entryEndTime.value="17:05";
  elements.entryBreakMinutes.value="0";
  elements.entryPaidLeaveHours.value="8";
  elements.entryNight.value="0";
  elements.entryIncludeBonus.checked=true;
  elements.currentMonthPicker.value="2026-11";
  app.ctx.document.getElementById=id=>elements[id]||null;
  return elements;
}

test("horário exato de duas semanas atrás calcula 8h normais e 3,05h extra",()=>{
  const app=makeApp();
  const d=app.evaluate('calculateManualEntryTime("2026-11-11","06:02","17:05",0,false)');
  assert.equal(d.workedMinutes,663);
  assert.equal(d.normal,8);
  assert.equal(d.extra,3.05);
  assert.equal(d.startTime,"06:02");
  assert.equal(d.endTime,"17:05");
  const withBreak=app.evaluate('calculateManualEntryTime("2026-11-11","06:02","17:05",30,false)');
  assert.equal(withBreak.workedMinutes,633);
  assert.equal(withBreak.normal,8);
  assert.equal(withBreak.extra,2.55);
});

test("cálculo histórico valida pausas e suporta saída no dia seguinte",()=>{
  const app=makeApp();
  const overnight=app.evaluate('calculateManualEntryTime("2026-11-11","22:00","06:00",30,true)');
  assert.equal(overnight.workedMinutes,450);
  assert.equal(overnight.normal,7.5);
  assert.equal(overnight.extra,0);
  assert.ok(overnight.end>overnight.start);
  const noNext=app.evaluate('calculateManualEntryTime("2026-11-11","22:00","06:00",30,false)');
  assert.ok(noNext.error.includes("dia seguinte"));
  const invalid=app.evaluate('calculateManualEntryTime("2026-11-11","09:00","09:20",30,false)');
  assert.ok(invalid.error.includes("pausa"));
  const incomplete=app.evaluate('calculateManualEntryTime("2026-11-11","","17:00",30,false)');
  assert.ok(incomplete.error);
  assert.equal(app.evaluate('calculateManualEntryTime("2026-11-11","05:00","15:00",0,false)').workedMinutes,600);
});

test("guardar dia antigo guarda marcações exatas e o botão passa de azul a cinzento",()=>{
  const old={date:"2026-11-11",type:"work",normal:8,extra:0,night:0,
    includeBonus:true,note:"Entrega original",shifts:[{id:"shift-old",seconds:28800}]};
  const app=makeApp({},{"2026-11-11":old});
  const e=manualDayFixture(app);
  e.entryNote.value="Ponto 06:02–17:05";
  app.ctx.markEntryDirty();
  assert.equal(e.entrySaveButton.disabled,false);
  const result=app.ctx.saveEntry();
  assert.equal(result,true);
  const saved=JSON.parse(app.values.get("wt_entries"))["2026-11-11"];
  assert.equal(saved.normal,8);
  assert.equal(saved.extra,3.05);
  assert.equal(saved.manualTime.startTime,"06:02");
  assert.equal(saved.manualTime.endTime,"17:05");
  assert.equal(saved.manualTime.workedMinutes,663);
  assert.equal(saved.note,"Ponto 06:02–17:05");
  assert.equal(saved.shifts[0].id,"shift-old","preserva o histórico do widget");
  assert.equal(saved.manuallyEdited,true);
  assert.equal(e.entrySaveButton.disabled,true);
  assert.ok(e.entrySaveText.textContent.includes("Guardado"));
  assert.ok(e.entrySaveStatus.textContent.includes("sucesso"));
  app.ctx.markEntryDirty();
  assert.equal(e.entrySaveButton.disabled,false);
  assert.ok(e.entrySaveText.textContent.includes("Guardar"));
  assert.ok(fs.readFileSync("pro-ui.css","utf8").includes("#entrySaveButton.wt-day-saved"));
});

test("guardar dia inválido ou armazenamento indisponível não altera as horas",()=>{
  const original={"2026-11-11":{date:"2026-11-11",type:"work",normal:8,extra:1,note:"Original"}};
  const app=makeApp({},original);
  const e=manualDayFixture(app);
  e.entryStartTime.value="";
  assert.equal(app.ctx.saveEntry(),false);
  assert.equal(JSON.parse(app.values.get("wt_entries"))["2026-11-11"].note,"Original");
  assert.equal(e.entrySaveButton.disabled,false);
  e.entryStartTime.value="06:02";
  app.ctx.localStorage.setItem=()=>{throw Error("Disco cheio");};
  assert.equal(app.ctx.saveEntry(),false);
  assert.equal(app.evaluate('entries["2026-11-11"].note'),"Original");
  assert.ok(e.entrySaveStatus.textContent.includes("Não foi possível guardar"));
});

test("editar data antiga carrega horas gravadas sem misturar com novo dia",()=>{
  const app=makeApp({},{"2026-11-11":{date:"2026-11-11",type:"work",normal:8,extra:2.55,night:0,
    note:"Quarta",manualTime:{start:"2026-11-11T06:02:00.000Z",
      end:"2026-11-11T17:05:00.000Z",startTime:"06:02",endTime:"17:05",
      breakMinutes:30,nextDay:false,workedMinutes:633}}});
  const e=manualDayFixture(app);
  app.ctx.loadManualEntryForDate("2026-11-11");
  assert.equal(e.entryUseTimes.checked,true);
  assert.equal(e.entryStartTime.value,"06:02");
  assert.equal(e.entryEndTime.value,"17:05");
  assert.equal(Number(e.entryBreakMinutes.value),30);
  assert.equal(e.entryNote.value,"Quarta");
  assert.equal(e.entrySaveButton.disabled,true);
  app.ctx.loadManualEntryForDate("2026-11-12");
  assert.equal(e.entryUseTimes.checked,true,"num dia novo propõe-se registo pelas horas");
  assert.equal(e.entryStartTime.value,"");
  assert.equal(e.entryEndTime.value,"");
  assert.equal(e.entryNote.value,"");
  assert.equal(e.entrySaveButton.disabled,false);
});

test("horário manual aparece no histórico de Ponto antes dos turnos antigos",()=>{
  const app=makeApp({},{"2026-11-11":{
    date:"2026-11-11",type:"work",normal:8,extra:2.55,
    shifts:[{id:"shift-prev",seconds:30000}],
    manualTime:{start:"2026-11-11T06:02:00.000Z",end:"2026-11-11T17:05:00.000Z",
      workedMinutes:633,breakMinutes:30}
  }});
  vm.runInContext(proSource,app.ctx);
  const rows=app.ctx.window.ProUI.helpers.historyRows();
  assert.equal(rows.length,1);
  assert.equal(rows[0].manualExact,true);
  assert.equal(rows[0].manualBreakMinutes,30);
  assert.equal(rows[0].seconds,633*60);
  assert.ok(proSource.includes("loadManualEntryForDate(iso)"));
});


test("2 turnos no mesmo dia repartem corretamente 8h normais e 2h extra", () => {
  const day="2026-11-23";
  const a={id:"monday-am",date:day,start:"2026-11-23T08:00:00Z",
    end:"2026-11-23T12:00:00Z",breaks:[],seconds:4*3600};
  const b={id:"monday-pm",date:day,start:"2026-11-23T13:00:00Z",
    end:"2026-11-23T19:00:00Z",breaks:[],seconds:6*3600};
  const app=makeApp();
  app.values.set("wt_shift_drafts",JSON.stringify([a,b]));
  vm.runInContext(proSource,app.ctx);
  app.ctx.window.ProUI.applyDraft(a.id);
  let result=JSON.parse(app.values.get("wt_entries"))[day];
  assert.equal(result.normal,4);
  assert.equal(result.extra,0);
  app.ctx.window.ProUI.applyDraft(b.id);
  result=JSON.parse(app.values.get("wt_entries"))[day];
  assert.equal(result.normal,8);
  assert.equal(result.extra,2);
  assert.equal(result.shifts.length,2);
  assert.equal(JSON.parse(app.values.get("wt_shift_drafts")).length,0);
  const sum=app.evaluate('calculateMonthData("2026-11")');
  assert.equal(sum.normalH,8);
  assert.equal(sum.extraH,2);
});

test("o registo adicional respeita horas manuais anteriores e impede sobreposição",()=>{
  const day="2026-11-23";
  const original={date:day,type:"work",normal:6,extra:1,night:0,
    includeBonus:true,note:"Entrada manual"};
  const app=makeApp({}, {[day]:original});
  const draft={id:"extra-two",date:day,start:"2026-11-23T15:00:00Z",
    end:"2026-11-23T17:00:00Z",breaks:[],seconds:7200};
  const overlap={id:"overlapping",date:day,start:"2026-11-23T16:00:00Z",
    end:"2026-11-23T18:00:00Z",breaks:[],seconds:7200};
  app.values.set("wt_shift_drafts",JSON.stringify([draft,overlap]));
  vm.runInContext(proSource,app.ctx);
  app.ctx.window.ProUI.applyDraft(draft.id);
  let saved=JSON.parse(app.values.get("wt_entries"))[day];
  assert.equal(saved.normal,8);
  assert.equal(saved.extra,1);
  assert.equal(saved.shifts.length,1);
  app.ctx.window.ProUI.applyDraft(overlap.id);
  saved=JSON.parse(app.values.get("wt_entries"))[day];
  assert.equal(saved.normal,8);
  assert.equal(saved.extra,1);
  assert.equal(saved.shifts.length,1);
  assert.deepEqual(JSON.parse(app.values.get("wt_shift_drafts")).map(x=>x.id),["overlapping"]);
  assert.ok(app.notices.some(n=>n.includes("sobrepõe")));
});

test("taxas de suplemento definidas a 0% permanecem a 0% após guardar",()=>{
  const app=makeApp({overtimePct:40,nightPct:15,hourlyRate:28});
  const vals={
    cfgHourlyRate:"28",cfgHourlyBonus:"2.60",
    cfgOvertimePct:"0",cfgNightPct:"0",
    cfgDailyPanier:"0",cfgVacAvgSupplement:"0",
    cfgTaxSystem:"luxembourg",cfgTaxClass:"1",
    cfgManualTaxRate:"0",cfgCisCredit:"0",
    cfgLang:"pt",cfgStartScreen:"ponto",
    cfgHolidayCountry:"LU",cfgEmployerCountry:"LU",
    cfgResidenceCountry:"LU",cfgCalendarRegion:"",
    cfgAnnualVacation:"26",cfgManualSocialRate:"0"
  };
  app.ctx.document.getElementById=id=>({value:vals[id]??"",checked:id==="cfgSyncCalendarWithEmployer"});
  assert.equal(app.ctx.saveSettings(),true);
  const stored=JSON.parse(app.values.get("wt_settings"));
  assert.equal(stored.overtimePct,0);
  assert.equal(stored.nightPct,0);
  assert.equal(stored.hourlyRate,28);
  vals.cfgOvertimePct="";
  vals.cfgNightPct="";
  assert.equal(app.ctx.saveSettings(),true);
  assert.equal(JSON.parse(app.values.get("wt_settings")).overtimePct,0,
    "campo vazio não força uma majoração de 40%");
  assert.equal(JSON.parse(app.values.get("wt_settings")).nightPct,0,
    "campo vazio não força uma majoração de 15%");
});

test("falha ao guardar opções não altera as configurações na memória",()=>{
  const app=makeApp({hourlyRate:24,overtimePct:40,nightPct:15});
  const ids={cfgHourlyRate:"51",cfgHourlyBonus:"2",cfgOvertimePct:"0",cfgNightPct:"0",
    cfgDailyPanier:"0",cfgVacAvgSupplement:"0",cfgTaxSystem:"luxembourg",
    cfgTaxClass:"2",cfgManualTaxRate:"0",cfgCisCredit:"0",cfgLang:"pt",
    cfgStartScreen:"ponto",cfgHolidayCountry:"LU",cfgEmployerCountry:"LU",
    cfgResidenceCountry:"LU",cfgCalendarRegion:"",cfgAnnualVacation:"26",
    cfgManualSocialRate:"0"};
  app.ctx.document.getElementById=id=>({value:ids[id]??"",checked:false});
  const old=app.values.get("wt_settings");
  app.ctx.localStorage.setItem=()=>{throw Error("Sem espaço");};
  assert.equal(app.ctx.saveSettings(),false);
  assert.equal(app.evaluate("settings.hourlyRate"),24);
  assert.equal(app.evaluate("settings.overtimePct"),40);
  assert.equal(app.values.get("wt_settings"),old);
});

test("apagar registo ou preencher semana preserva dados quando o armazenamento falha",()=>{
  const old={"2026-11-18":{date:"2026-11-18",type:"work",normal:7,extra:1,night:0}};
  const app=makeApp({},old);
  const before=app.values.get("wt_entries");
  app.ctx.localStorage.setItem=()=>{throw Error("Sem espaço");};
  assert.equal(app.ctx.deleteEntry("2026-11-18"),false);
  assert.equal(app.evaluate('entries["2026-11-18"].normal'),7);
  assert.equal(app.values.get("wt_entries"),before);
  assert.equal(app.ctx.fillStandardWeek(),false);
  assert.equal(app.evaluate("Object.keys(entries).length"),1);
  assert.equal(app.values.get("wt_entries"),before);
  assert.ok(app.notices.some(msg=>msg.includes("Nenhum registo foi alterado")));
});


test("férias novas usam o horário do dia e as antigas conservam o valor de 8h",()=>{
  const original={"2026-11-24":{date:"2026-11-24",type:"vacation",
    normal:8,extra:0,night:0,includeBonus:false,note:"Férias antigas"}};
  const app=makeApp({hourlyRate:20,hourlyBonus:2,vacAvgSupplement:16,
    weeklySchedule:{1:{enabled:true,start:"09:00",end:"15:30",breakMinutes:30},
      0:{enabled:false,start:"08:00",end:"16:30",breakMinutes:30}}},original);
  const e=manualDayFixture(app,"2026-11-23");
  assert.equal(app.evaluate('scheduledLeaveHours("2026-11-23")'),6);
  assert.equal(app.evaluate('scheduledLeaveHours("2026-11-22")'),0);
  assert.equal(app.evaluate('paidHoursForEntry(entries["2026-11-24"])'),8);
  app.ctx.loadManualEntryForDate("2026-11-23");
  e.entryType.value="vacation";
  app.ctx.onDayTypeChange();
  assert.equal(Number(e.entryPaidLeaveHours.value),6);
  const result=app.ctx.saveEntry();
  assert.equal(result,true);
  const entries=JSON.parse(app.values.get("wt_entries"));
  assert.equal(entries["2026-11-23"].paidLeaveHours,6);
  assert.equal(entries["2026-11-24"].paidLeaveHours,undefined);
  const month=app.evaluate('calculateMonthData("2026-11")');
  assert.equal(month.vacDays,2);
  assert.equal(month.vacPaidHours,14);
  const expected=(6+8)*(20+2)+14/8*16;
  assert.equal(month.vacationGross,expected);
  app.ctx.loadManualEntryForDate("2026-11-24");
  assert.equal(Number(e.entryPaidLeaveHours.value),8,
    "Alterar um dia antigo não pode recalcular automaticamente as suas 8h");
});

test("dias de férias em folga têm 0h por defeito, mas permitem correção contratual",()=>{
  const app=makeApp({hourlyRate:21,hourlyBonus:1,vacAvgSupplement:8});
  const e=manualDayFixture(app,"2026-11-22"); // domingo sem trabalho programado
  app.ctx.loadManualEntryForDate("2026-11-22");
  e.entryType.value="vacation";
  app.ctx.onDayTypeChange();
  assert.equal(Number(e.entryPaidLeaveHours.value),0);
  assert.equal(app.ctx.saveEntry(),true);
  assert.equal(app.evaluate('calculateMonthData("2026-11").vacationGross'),0);
  assert.equal(app.evaluate('calculateMonthData("2026-11").vacPaidHours'),0);
  // Um dia sem horas remuneradas não consome férias na contagem anual.
  e.entryPaidLeaveHours.value="3.5";
  app.ctx.markEntryDirty();
  assert.equal(app.ctx.saveEntry(),true);
  assert.equal(app.evaluate('calculateMonthData("2026-11").vacPaidHours'),3.5);
  assert.equal(app.evaluate('calculateMonthData("2026-11").vacationGross'),3.5*(21+1)+3.5/8*8);
  assert.equal(JSON.parse(app.values.get("wt_entries"))["2026-11-22"].paidLeaveHours,3.5);
});

test("horas pagas de férias inválidas não apagam entradas anteriores",()=>{
  const old={"2026-11-23":{date:"2026-11-23",type:"vacation",normal:8,extra:0,night:0,
    paidLeaveHours:6,note:"Original"}};
  const app=makeApp({},old);
  const e=manualDayFixture(app,"2026-11-23");
  app.ctx.loadManualEntryForDate("2026-11-23");
  e.entryPaidLeaveHours.value="-2";
  assert.equal(app.ctx.saveEntry(),false);
  assert.equal(JSON.parse(app.values.get("wt_entries"))["2026-11-23"].paidLeaveHours,6);
  e.entryPaidLeaveHours.value="25";
  assert.equal(app.ctx.saveEntry(),false);
  e.entryPaidLeaveHours.value="";
  assert.equal(app.ctx.saveEntry(),false);
  assert.ok(e.entrySaveStatus.textContent.includes("entre 0 e 24"));
});

test("o horário semanal permanece intacto quando falha a gravação",()=>{
  const app=makeApp({}, {});
  const oldSchedule=app.evaluate("JSON.stringify(settings.weeklySchedule)");
  app.ctx.document.getElementById=id=>{
    const matched=id.match(/^week(Enabled|Start|End|Break)(\d)$/);
    if (matched) {
      const field=matched[1],day=Number(matched[2]);
      return {
        checked: day>=1&&day<=5,
        value:field==="Start"?"09:00":field==="End"?"18:00":"60"
      };
    }
    return {value:""};
  };
  app.ctx.localStorage.setItem=()=>{throw Error("Storage quota exceeded");};
  assert.equal(app.ctx.saveWeeklySchedule(),false);
  assert.equal(app.evaluate("JSON.stringify(settings.weeklySchedule)"),oldSchedule);
  assert.ok(app.notices.some(x=>x.includes("O horário anterior foi mantido")));
});


test("build Android gera CSS local sem depender do servidor Tailwind",()=>{
  const path=require("node:path"),os=require("node:os");
  const {spawnSync}=require("node:child_process");
  const workflow=fs.readFileSync(".github/workflows/apk.yml","utf8");
  const config=fs.readFileSync("tailwind.config.cjs","utf8");
  const tailwindInput=fs.readFileSync("tailwind-input.css","utf8");
  assert.ok(workflow.includes("tailwindcss@3.4.17"));
  assert.ok(workflow.includes("tailwind.generated.css"));
  assert.ok(workflow.includes("python3 scripts/prepare_offline_android.py"));
  assert.ok(config.includes('"./index.html"'));
  assert.ok(tailwindInput.includes("@tailwind utilities"));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"worktime-offline-"));
  try {
    const www=path.join(tmp,"www");
    fs.mkdirSync(www);
    fs.writeFileSync(path.join(www,"index.html"),source);
    fs.writeFileSync(path.join(www,"sw.js"),fs.readFileSync("sw.js","utf8"));
    // Test the transformer independently of a real npm installation.
    fs.writeFileSync(path.join(www,"tailwind.generated.css"),"/* offline */"+".test{color:red;}".repeat(350));
    const result=spawnSync("python3",[path.resolve("scripts/prepare_offline_android.py")],
      {cwd:tmp,encoding:"utf8"});
    assert.equal(result.status,0,result.stderr);
    const html=fs.readFileSync(path.join(www,"index.html"),"utf8");
    const sw=fs.readFileSync(path.join(www,"sw.js"),"utf8");
    assert.ok(html.includes('href="tailwind.generated.css"'));
    assert.ok(!html.includes("cdn.tailwindcss.com"));
    assert.ok(!html.includes("tailwind.config ="));
    assert.ok(sw.includes("'./tailwind.generated.css'"));
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test("CSV escapa aspas, quebras e bloqueia fórmulas de notas",()=>{
  const app=makeApp();
  const formulaPrefix = '"' + String.fromCharCode(39);
  const examples=[
    ["a,b",'"a,b"'],
    ['A"B','"A""B"'],
    ['=HYPERLINK("https://exemplo")',formulaPrefix+'=HYPERLINK(""https://exemplo"")"'],
    ["   @SUM(A1)",formulaPrefix+'   @SUM(A1)"'],
    ["+CMD",formulaPrefix+'+CMD"'],
    ["-10",formulaPrefix+'-10"']
  ];
  for(const [input,expected] of examples) {
    assert.equal(app.evaluate("safeCsvText("+JSON.stringify(input)+")"),expected);
  }
  assert.ok(source.includes('rows.join("\\r\\n")'));
  assert.ok(source.includes("URL.revokeObjectURL"));
});
