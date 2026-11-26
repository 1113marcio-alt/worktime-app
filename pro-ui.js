/* WorkTime Pro 2.0 — dashboard, calendar and time clock.
   The original settings and daily entries remain the source of truth. */
(function () {
  "use strict";

  const ACTIVE_KEY = "wt_active_shift";
  const DRAFTS_KEY = "wt_shift_drafts";
  const $ = id => document.getElementById(id);
  let calendarSelected = null;
  let previousCalendarTap = {date:"", at:0};
  // Mantém o estado fora de cada botão: o calendário recria o HTML depois
  // do primeiro toque, mas o segundo toque deve continuar a ser reconhecido.
  function isSecondCalendarTap(iso,at) {
    const now = typeof at === "number" ? at : Date.now();
    const second = previousCalendarTap.date === iso &&
      now >= previousCalendarTap.at && now - previousCalendarTap.at <= 480;
    previousCalendarTap = second ? {date:"",at:0} : {date:iso,at:now};
    return second;
  }

  let activeTab = "home";

  function getStored(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  function saveStored(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { alert("Sem espaço para guardar os dados. Exporte um backup e liberte espaço."); return false; }
  }
  function localeCode() {
    const codes = {pt:"pt-PT",fr:"fr-FR",de:"de-DE",es:"es-ES",en:"en-GB",lu:"lb-LU"};
    return codes[settings.lang] || "pt-PT";
  }
  function localDateKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0");
  }
  function monthLabel(value) {
    const date = new Date(value + "-01T12:00:00");
    if (Number.isNaN(date.getTime())) return value;
    const text = new Intl.DateTimeFormat(localeCode(), { month: "long", year: "numeric" }).format(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  function displayDate(date) {
    if (!date) return "";
    const dt = new Date(date + "T12:00:00");
    return new Intl.DateTimeFormat(localeCode(), { day: "numeric", month: "long", year: "numeric" }).format(dt);
  }
  function clockTime(value) {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? "--:--" :
      new Intl.DateTimeFormat(localeCode(), { hour: "2-digit", minute: "2-digit" }).format(dt);
  }
  function timeParts(totalSeconds) {
    const sec = Math.max(0, Math.floor(totalSeconds || 0));
    return String(Math.floor(sec / 3600)).padStart(2, "0") + ":" +
      String(Math.floor((sec % 3600) / 60)).padStart(2, "0") + ":" +
      String(sec % 60).padStart(2, "0");
  }
  function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  function timeWorkedSeconds(shift, finish) {
    if (!shift || !shift.start || !Array.isArray(shift.breaks)) return 0;
    const start = Date.parse(shift.start);
    const end = Date.parse(finish || shift.end || new Date().toISOString());
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    const elapsed = end - start;
    let paused = 0;
    for (const pause of shift.breaks) {
      const from = Date.parse(pause.start);
      const to = Date.parse(pause.end || finish || new Date().toISOString());
      if (Number.isFinite(from) && Number.isFinite(to)) {
        paused += Math.max(0, Math.min(to, end) - Math.max(from, start));
      }
    }
    return Math.max(0, Math.floor((elapsed - Math.min(elapsed, paused)) / 1000));
  }
  function currentShift() {
    const shift = getStored(ACTIVE_KEY, null);
    if (!shift || !shift.start || !Array.isArray(shift.breaks)) return null;
    return shift;
  }
  function drafts() {
    const data = getStored(DRAFTS_KEY, []);
    return Array.isArray(data) ? data : [];
  }
  function getMonth() {
    return $("currentMonthPicker").value || localDateKey(new Date()).slice(0, 7);
  }
  function setMonth(value) {
    $("currentMonthPicker").value = value;
    calendarSelected = value === localDateKey(new Date()).slice(0, 7) ? localDateKey(new Date()) : value + "-01";
    renderAll();
  }
  function stepMonth(delta) {
    const date = new Date(getMonth() + "-01T12:00:00");
    date.setMonth(date.getMonth() + delta);
    setMonth(localDateKey(date).slice(0, 7));
  }

  function renderHome() {
    if (!$("homeNet")) return;
    const month = getMonth();
    const data = calculateMonthData(month);
    $("homeMonth").textContent = monthLabel(month);
    $("homeNet").textContent = formatMoney(data.netBeforeCredit);
    $("homeGross").textContent = formatMoney(data.totalGross);
    $("homeCreditNotice").textContent = data.cisCreditApplied > 0
      ? "CIS configurado: +" + formatMoney(data.cisCreditApplied) +
        " (não incluído neste saldo; depende da situação fiscal e do período remunerado)."
      : "Valores acumulados apenas dos dias registados; não representam necessariamente o salário mensal.";
    $("homeNormal").textContent = data.normalH.toFixed(2) + " h";
    $("homeOvertime").textContent = data.extraH.toFixed(2) + " h";
    $("homeWorkdays").textContent = data.monthEntries.filter(e => e.type === "work").length;
    $("homeVacationDays").textContent = data.monthEntries.filter(e => e.type === "vacation").length;
    $("homeHours").textContent = (data.normalH + data.extraH).toFixed(2) + " h";
    $("homeCountry").textContent = settings.employerCountry || "LU";
    if ($("salaryPreviewNet")) {
      $("salaryPreviewNet").textContent = formatMoney(data.netBeforeCredit);
      $("salaryPreviewGross").textContent = formatMoney(data.totalGross);
      $("salaryPreviewCredit").textContent = "CIS configurado (a confirmar): +" +
        formatMoney(data.cisCreditApplied);
      $("salaryPreviewWithCredit").textContent = "Simulação com CIS: " +
        formatMoney(data.finalNet) + " — sujeito a elegibilidade.";
      $("salaryPreviewDeductions").textContent =
        formatMoney(data.ccssPension + data.ccssHealth + data.ccssDep + data.taxIrs);
      $("salaryPreviewBonus").textContent = formatMoney(data.bonusGross);
    }

    const bars = [0, 0, 0, 0, 0];
    for (const entry of data.monthEntries) {
      if (entry.type !== "work") continue;
      const date = Number(entry.date.slice(-2));
      if (date > 0 && date <= 31) bars[Math.min(4, Math.floor((date - 1) / 7))] +=
        safeNumber(entry.normal) + safeNumber(entry.extra);
    }
    const peak = Math.max(1, ...bars);
    const chart = $("homeHoursChart");
    chart.replaceChildren();
    for (let i = 0; i < bars.length; i++) {
      const col = document.createElement("div");
      col.className = "wt-chart-col";
      const rail = document.createElement("div");
      rail.className = "wt-chart-rail";
      const fill = document.createElement("div");
      fill.className = "wt-chart-fill";
      fill.style.height = Math.round(100 * bars[i] / peak) + "%";
      fill.title = bars[i].toFixed(2) + " horas";
      rail.appendChild(fill);
      const label = document.createElement("small");
      label.textContent = "S" + (i + 1);
      col.append(rail, label);
      chart.appendChild(col);
    }
    const list = $("homeRecent");
    list.replaceChildren();
    if (!data.monthEntries.length) {
      const empty = document.createElement("p");
      empty.className = "wt-note";
      empty.textContent = "Ainda não existem registos neste mês. Começa por registar um dia ou iniciar um turno.";
      list.appendChild(empty);
    } else {
      const kind = { work: "Trabalho", vacation: "Férias", holiday: "Feriado",
        sick: "Baixa médica", off: "Folga" };
      data.monthEntries.slice(0, 4).forEach(entry => {
        const row = document.createElement("button");
        row.className = "wt-entry-line w-full text-left";
        row.type = "button";
        row.onclick = () => openDate(entry.date);
        const day = document.createElement("span");
        day.className = "wt-entry-day";
        const b = document.createElement("b"); b.textContent = entry.date.slice(-2);
        const small = document.createElement("small"); small.textContent = entry.date.slice(5, 7);
        day.append(b, small);
        const body = document.createElement("span");
        body.className = "flex-1 min-w-0";
        const title = document.createElement("span"); title.className = "wt-entry-title block";
        title.textContent = kind[entry.type] || entry.type;
        const sub = document.createElement("span"); sub.className = "wt-entry-sub block truncate";
        sub.textContent = entry.type === "work" ? (safeNumber(entry.normal) + safeNumber(entry.extra)).toFixed(2) + " h trabalhadas" :
          (entry.note || "Ver registo");
        body.append(title, sub);
        const arrow = document.createElement("span"); arrow.textContent = "›";
        arrow.className = "text-xl text-slate-500";
        row.append(day, body, arrow);
        list.appendChild(row);
      });
    }
  }

  function holidayForDay(iso) {
    const policy = window.WTCountryRules;
    if (!policy) return null;
    const year = Number(iso.slice(0,4));
    const country = settings.holidayCountry || "LU";
    const data = policy.holidays(year,country,settings.calendarRegion);
    return data.items.find(h => h.date === iso) || null;
  }
  function renderCalendar() {
    if (!$("calendarGrid")) return;
    const month = getMonth();
    $("calendarTitle").textContent = monthLabel(month);
    const start = new Date(month + "-01T12:00:00");
    const year = start.getFullYear();
    const monthNumber = start.getMonth();
    const monthDays = new Date(year, monthNumber + 1, 0).getDate();
    const offset = (start.getDay() + 6) % 7;
    const size = Math.ceil((monthDays + offset) / 7) * 7;
    const today = localDateKey(new Date());
    if (!calendarSelected || !calendarSelected.startsWith(month)) {
      calendarSelected = today.startsWith(month) ? today : month + "-01";
    }
    const grid = $("calendarGrid");
    grid.replaceChildren();
    const weekdays = document.querySelectorAll(".wt-cal-weekdays span");
    const mon = new Date(2026,10,16); // second-feira 16 Nov 2026
    weekdays.forEach((node,index) => {
      const dt = new Date(mon);
      dt.setDate(mon.getDate()+index);
      node.textContent = new Intl.DateTimeFormat(localeCode(), {weekday:"short"}).format(dt).replace(".","").toUpperCase();
    });
    for (let index = 0; index < size; index++) {
      const dateNumber = index - offset + 1;
      if (dateNumber < 1 || dateNumber > monthDays) {
        const blank = document.createElement("div");
        blank.className = "wt-day wt-outside";
        grid.appendChild(blank);
        continue;
      }
      const iso = month + "-" + String(dateNumber).padStart(2, "0");
      const entry = entries[iso];
      const holiday = holidayForDay(iso);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wt-day" + (today === iso ? " wt-current" : "") +
        (calendarSelected === iso ? " wt-selected" : "");
      btn.setAttribute("aria-label", displayDate(iso) + (entry ? " com registo" : ""));
      const day = document.createElement("span");
      day.textContent = String(dateNumber);
      btn.appendChild(day);
      if (entry || holiday) {
        const marker = document.createElement("i");
        marker.className = "wt-dot " + (entry ? entry.type : "holiday");
        btn.appendChild(marker);
      }
      btn.onclick = () => {
        if (isSecondCalendarTap(iso)) openDate(iso);
        else { calendarSelected = iso; renderCalendar(); }
      };
      // Para rato/desktop, usar também o evento de duplo clique.
      btn.ondblclick = () => openDate(iso);
      grid.appendChild(btn);
    }
    const legend = $("calendarSummary");
    const currentEntries = Object.values(entries).filter(e => e.date && e.date.startsWith(month));
    legend.textContent = currentEntries.length + " dias com registos" +
      (window.WTCountryRules && window.WTCountryRules.holidays(Number(month.slice(0,4)),
        settings.holidayCountry || "LU", settings.calendarRegion).verified
        ? " • " + (settings.holidayCountry || "LU") + " " + month.slice(0,4) : "");
    const selected = entries[calendarSelected];
    const holiday = holidayForDay(calendarSelected);
    $("selectedDayTitle").textContent = displayDate(calendarSelected);
    $("selectedDayDetail").textContent = selected ?
      ({work:"Trabalho",vacation:"Férias",holiday:"Feriado",sick:"Baixa médica",off:"Folga"}[selected.type] || selected.type) +
      (selected.type === "work" ? " • " + (safeNumber(selected.normal) + safeNumber(selected.extra)).toFixed(2) + " h" : "") +
      (selected.note ? " • " + selected.note : "") :
      (holiday ? holiday.name : "Sem registo neste dia");
  }
  function openDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    loadManualEntryForDate(iso);
    renderAll();
    switchTab("registo");
  }
  function openSelectedDay() {
    if (calendarSelected) openDate(calendarSelected);
  }
  function renderClock() {
    if (!$("clockTimer")) return;
    const shift = currentShift();
    const date = localDateKey(new Date());
    const state = shift ? (shift.status === "paused" ? "Em pausa" : "Turno em curso") : "Pronto para começar";
    $("clockTimer").textContent = shift ? timeParts(timeWorkedSeconds(shift)) : "00:00:00";
    $("clockStatus").textContent = state;
    $("clockDate").textContent = displayDate(shift ? localDateKey(shift.start) : date);
    $("clockStartTime").textContent = shift ? clockTime(shift.start) : "--:--";
    $("clockBreaks").textContent = shift ? String(shift.breaks.length) : "0";
    $("clockPrimary").textContent = !shift ? "▶ Iniciar turno" :
      (shift.status === "paused" ? "▶ Retomar trabalho" : "Ⅱ Iniciar pausa");
    $("clockPrimary").className = "wt-button " + (!shift ? "primary" : "cyan");
    $("clockFinish").disabled = !shift;
    $("clockDiscard").hidden = !shift;
    renderDrafts();
    renderHistory();
    if (window.WTLocale) window.WTLocale.apply(settings.lang);
  }
  async function primaryClockAction() {
    if (window.WTWidget) await window.WTWidget.sync();
    const shift = currentShift();
    const time = new Date().toISOString();
    if (!shift) {
      const next = {
        id: "shift-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        start: time, breaks: [], status: "working"
      };
      if (saveStored(ACTIVE_KEY, next)) {
        renderClock();
        if (window.WTWidget) window.WTWidget.publish();
      }
      return;
    }
    if (shift.status === "paused") {
      const last = shift.breaks[shift.breaks.length - 1];
      if (!last || last.end) { alert("Não foi possível retomar esta pausa."); return; }
      last.end = time;
      shift.status = "working";
    } else {
      shift.breaks.push({ start: time, end: null });
      shift.status = "paused";
    }
    if (saveStored(ACTIVE_KEY, shift)) {
      renderClock();
      if (window.WTWidget) window.WTWidget.publish();
    }
  }
  async function finishShift() {
    if (window.WTWidget) await window.WTWidget.sync();
    const shift = currentShift();
    if (!shift) return;
    const end = new Date().toISOString();
    const seconds = timeWorkedSeconds(shift, end);
    if (seconds < 60) { alert("O turno precisa de pelo menos um minuto de trabalho para ser guardado."); return; }
    if (!confirm("Terminar o turno? Foram trabalhadas " + (seconds / 3600).toFixed(2) +
      " horas, excluindo as pausas. O turno ficará como rascunho até escolher Guardar no dia.")) return;
    const closedBreaks = shift.breaks.map(p => ({ start: p.start, end: p.end || end }));
    const draft = {
      id: shift.id, start: shift.start, end, breaks: closedBreaks,
      seconds, date: localDateKey(shift.start)
    };
    const saved = drafts();
    if (saved.some(item => item.id === draft.id)) {
      alert("Este turno já foi guardado como rascunho."); return;
    }
    saved.unshift(draft);
    // Gravar o rascunho antes de remover o turno ativo.
    if (saveStored(DRAFTS_KEY, saved)) {
      try { localStorage.removeItem(ACTIVE_KEY); } catch (_) {}
      renderClock();
      if (window.WTWidget) window.WTWidget.publish();
    }
  }
  async function discardActive() {
    if (window.WTWidget) await window.WTWidget.sync();
    if (!currentShift()) return;
    if (!confirm("Anular este turno em curso sem guardar as horas?")) return;
    localStorage.removeItem(ACTIVE_KEY);
    renderClock();
    if (window.WTWidget) window.WTWidget.publish();
  }
  let historyFilter = "all";

  // Historical data is read-only and derived exclusively from already saved
  // daily entries and pending drafts. No migration or duplicate copies.
  function historyRows() {
    const rows = [];
    for (const entry of Object.values(entries)) {
      if (!entry || typeof entry !== "object" || typeof entry.date !== "string") continue;
      const clock = entry.manualTime;
      const savedShifts = Array.isArray(entry.shifts) ? entry.shifts : [];
      if (entry.type === "work" && clock && clock.start && clock.end) {
        // A manual correction takes precedence over archived widget shifts.
        // The original shifts remain safely stored in the day for audit.
        rows.push({date:entry.date,status:"saved",type:"work",
          start:clock.start,end:clock.end,seconds:clock.workedMinutes*60,
          breaks:[],manualBreakMinutes:clock.breakMinutes,
          note:entry.note || "",manualExact:true,id:null});
      } else if (savedShifts.length && !entry.manuallyEdited) {
        savedShifts.forEach(shift => {
          if (!shift || typeof shift !== "object") return;
          rows.push({date:entry.date,status:"saved",type:entry.type,
            start:shift.start,end:shift.end,seconds:shift.seconds,breaks:shift.breaks,
            note:entry.note || "",id:shift.id || null});
        });
      } else {
        rows.push({date:entry.date,status:"saved",type:entry.type,
          note:entry.note || "",hours:safeNumber(entry.normal)+safeNumber(entry.extra),
          start:null,end:null,breaks:[],id:null,legacy:true});
      }
    }
    for (const draft of drafts()) {
      if (!draft || typeof draft !== "object" || typeof draft.date !== "string") continue;
      rows.push({date:draft.date,status:"draft",type:"work",
        start:draft.start,end:draft.end,seconds:draft.seconds,breaks:draft.breaks,
        id:draft.id || null,source:draft.source || "app"});
    }
    rows.sort((a,b)=>String(b.end || b.start || b.date)
      .localeCompare(String(a.end || a.start || a.date)));
    return rows;
  }

  function renderHistory() {
    const container=$("clockHistoryList");
    if(!container)return;
    container.replaceChildren();
    const rows=historyRows().filter(row => historyFilter==="all" || row.status===historyFilter);
    $("historyCount").textContent=String(rows.length);
    if(!rows.length){
      const p=document.createElement("p");
      p.className="wt-note";
      p.textContent="Ainda não existem turnos nesta categoria.";
      container.appendChild(p);
      return;
    }
    rows.slice(0,60).forEach(row => {
      const box=document.createElement("div");
      box.className="wt-entry-line";
      const date=document.createElement("span");
      date.className="wt-entry-day";
      const day=document.createElement("b");day.textContent=row.date.slice(-2);
      const month=document.createElement("small");month.textContent=row.date.slice(5,7);
      date.append(day,month);
      const body=document.createElement("div");body.className="flex-1 min-w-0";
      const title=document.createElement("div");title.className="wt-entry-title";
      title.textContent=row.status==="draft" ? "Por confirmar" :
        (row.type==="work" ? "Trabalho confirmado" : (row.type || "Registo"));
      const interval=document.createElement("div");interval.className="wt-entry-sub";
      const hours=Number.isFinite(row.seconds) ? (row.seconds/3600).toFixed(2) :
        row.legacy ? row.hours.toFixed(2) : "—";
      const times=row.start && row.end ? clockTime(row.start)+"–"+clockTime(row.end)+" · " : "";
      interval.textContent=times+hours+" h"+(row.legacy?" · Registo manual (sem marcações)":"");
      const pause=document.createElement("div");pause.className="wt-entry-sub";
      const pauses=Array.isArray(row.breaks) ? row.breaks : [];
      pause.textContent=row.manualExact
        ? "Pausa não remunerada: "+Number(row.manualBreakMinutes||0)+" min"
        : pauses.length ? "Pausas: "+pauses.map(p => clockTime(p.start)+"–"+clockTime(p.end)).join(", ")
        : (row.start ? "Sem pausas registadas" : "");
      body.append(title,interval,pause);
      const button=document.createElement("button");
      button.className="wt-pill";
      button.type="button";
      button.textContent=row.status==="draft"?"Ver rascunho":"Ver dia";
      button.onclick=()=>{
        if(row.status==="draft"){
          $("clockDraftList").scrollIntoView({behavior:"smooth",block:"center"});
        }else{
          openDate(row.date);
        }
      };
      box.append(date,body,button);
      container.appendChild(box);
    });
    if(rows.length>60){
      const more=document.createElement("p");more.className="wt-note";
      more.textContent="A mostrar os 60 registos mais recentes.";
      container.appendChild(more);
    }
    if(window.WTLocale)window.WTLocale.apply(settings.lang);
  }
  function setHistoryFilter(filter){
    historyFilter=["all","saved","draft"].includes(filter)?filter:"all";
    renderHistory();
  }

  function renderDrafts() {
    const container = $("clockDraftList");
    if (!container) return;
    container.replaceChildren();
    const data = drafts();
    $("draftCount").textContent = String(data.length);
    if (!data.length) {
      const msg = document.createElement("p");
      msg.className = "wt-note";
      msg.textContent = "Nenhum turno por guardar. Os turnos terminados aparecem aqui antes de entrarem no calendário.";
      container.appendChild(msg);
      return;
    }
    data.forEach(draft => {
      const card = document.createElement("div"); card.className = "wt-draft";
      const title = document.createElement("p"); title.className = "font-bold text-sm";
      title.textContent = displayDate(draft.date);
      const sub = document.createElement("p"); sub.className = "wt-note";
      sub.textContent = clockTime(draft.start) + " – " + clockTime(draft.end) + " • " +
        (safeNumber(draft.seconds) / 3600).toFixed(2) + " horas úteis";
      const actions = document.createElement("div"); actions.className = "wt-draft-actions";
      const save = document.createElement("button"); save.className = "wt-button primary flex-1";
      save.textContent = "Guardar no dia"; save.onclick = () => applyDraft(draft.id);
      const remove = document.createElement("button"); remove.className = "wt-button danger";
      remove.textContent = "Descartar"; remove.onclick = () => discardDraft(draft.id);
      actions.append(save, remove); card.append(title, sub, actions); container.appendChild(card);
    });
  }
  function applyDraft(id) {
    const pending = drafts();
    const draft = pending.find(item => item.id === id);
    if (!draft || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return;
    const date = draft.date;
    const prior = entries[date];
    if (prior && Array.isArray(prior.shifts) && prior.shifts.some(shift => shift.id === draft.id)) {
      alert("Este turno já foi aplicado ao dia."); return;
    }
    if (prior && prior.type !== "work") {
      alert("Já existe um registo de férias, baixa, feriado ou folga neste dia. Resolva-o primeiro no registo manual; o rascunho fica guardado.");
      return;
    }
    const hourTotal = Math.round((safeNumber(draft.seconds) / 3600) * 100) / 100;
    if (!hourTotal) return;
    const day = new Date(date + "T12:00:00").getDay();
    const schedule = settings.weeklySchedule || defaultSettings.weeklySchedule;
    const slot = schedule[day] || defaultSettings.weeklySchedule[day];
    const planned = slot.enabled ? hoursForSchedule(slot) : null;
    // O limite normal aplica-se à soma dos turnos do dia, não a cada turno.
    // Horas já registadas manualmente continuam intactas.
    const alreadyNormal = prior ? safeNumber(prior.normal) : 0;
    const remainingNormal = planned === null
      ? hourTotal : Math.max(0, planned - alreadyNormal);
    const normal = Math.round(Math.min(hourTotal, remainingNormal) * 100) / 100;
    const extra = Math.max(0, Math.round((hourTotal - normal) * 100) / 100);
    // IDs diferentes ainda podem representar a mesma marcação, por engano.
    // Rejeitar sobreposição temporal em vez de duplicar salário.
    const ranges = prior ? [
      ...(Array.isArray(prior.shifts) ? prior.shifts : []),
      ...(prior.manualTime && prior.manualTime.start && prior.manualTime.end
        ? [prior.manualTime] : [])
    ] : [];
    const draftStart = Date.parse(draft.start), draftEnd = Date.parse(draft.end);
    if (Number.isFinite(draftStart) && Number.isFinite(draftEnd) &&
        ranges.some(item => {
          const a = Date.parse(item.start), b = Date.parse(item.end);
          return Number.isFinite(a) && Number.isFinite(b) &&
            draftStart < b && draftEnd > a;
        })) {
      alert("Este turno sobrepõe-se a horas já guardadas neste dia. O rascunho foi mantido para corrigires sem duplicar salário.");
      return;
    }
    if (prior && !confirm("Este dia já tem " +
      (safeNumber(prior.normal) + safeNumber(prior.extra)).toFixed(2) +
      " horas. Queres SOMAR este turno? Confirma para evitar horas duplicadas.")) return;
    const note = "Ponto " + clockTime(draft.start) + "–" + clockTime(draft.end);
    const merged = prior ? {
      ...prior,
      normal: Math.round((safeNumber(prior.normal) + normal) * 100) / 100,
      extra: Math.round((safeNumber(prior.extra) + extra) * 100) / 100,
      note: prior.note ? prior.note + " | " + note : note,
      shifts: [...(Array.isArray(prior.shifts) ? prior.shifts : []), draft]
    } : {
      date, type: "work", normal, extra, night: 0,
      includeBonus: true, note, shifts: [draft]
    };
    const updated = { ...entries, [date]: merged };
    if (!saveStored("wt_entries", updated)) return;
    entries = updated;
    saveStored(DRAFTS_KEY, pending.filter(item => item.id !== id));
    renderAll();
  }
  function discardDraft(id) {
    if (!confirm("Descartar este turno? Não será adicionado ao registo diário.")) return;
    saveStored(DRAFTS_KEY, drafts().filter(draft => draft.id !== id));
    renderClock();
  }

  function init() {
    if (!$("tab-home")) return;
    $("clockDate").textContent = displayDate(localDateKey(new Date()));
    const preferred = ["ponto", "home", "calendario"].includes(settings.startScreen)
      ? settings.startScreen : "ponto";
    switchTab(preferred);
    render();
    // Atualizar apenas o cronómetro a cada segundo, sem reconstruir botões/rascunhos.
    window.setInterval(() => {
      const shift = currentShift();
      if ($("clockTimer")) $("clockTimer").textContent =
        shift ? timeParts(timeWorkedSeconds(shift)) : "00:00:00";
    }, 1000);
    window.addEventListener("focus", renderClock);
    if (window.WTWidget) window.WTWidget.init();
  }
  function render() {
    renderHome();
    renderCalendar();
    renderClock();
    if (window.WTLocale) window.WTLocale.apply(settings.lang);
  }
  function onTabChange(tab) {
    activeTab = tab;
    if (tab === "home" || tab === "calendario" || tab === "ponto") render();
  }
  window.ProUI = {
    init, render, onTabChange, stepMonth, openDate, openSelectedDay, setHistoryFilter,
    primaryClockAction, finishShift, discardActive, applyDraft, discardDraft,
    // Pure helpers exported for automated tests.
    helpers: { localDateKey, timeWorkedSeconds, timeParts, historyRows, isSecondCalendarTap }
  };
}());
