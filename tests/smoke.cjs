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
  vm.runInContext(appScript, ctx);
  // Estes testes isolam a lógica dos dados sem depender do layout do navegador.
  vm.runInContext("renderAll = function(){}; loadSettingsToInputs = function(){};", ctx);
  return { ctx, values, notices, evaluate: code => vm.runInContext(code, ctx) };
}

test("todo o JavaScript embutido mantém sintaxe válida", () => {
  for (const script of scripts) new vm.Script(script);
  new vm.Script(fs.readFileSync("sw.js", "utf8"));
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
