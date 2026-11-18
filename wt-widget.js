/* Optional Android home widget. Native clicks are journaled first, then replayed
   into the existing localStorage record when the Preview is opened/resumed.
   A finished shift remains a draft until the worker confirms it in the app. */
(function(root){
 "use strict";
 const $=id=>document.getElementById(id);
 let syncing=null,ready=false;

 function plugin(){
   return root.Capacitor && root.Capacitor.Plugins &&
     root.Capacitor.Plugins.WorkTimeWidget || null;
 }
 function status(message,ok){
   const el=$("widgetStatus");
   if(el){el.textContent=message;el.className="wt-note "+(ok?"text-emerald-400":"text-amber-300");}
 }
 function notificationStatus(message,ok){
   const el=$("notificationStatus");
   if(!el){status(message,ok);return;}
   el.textContent=message;
   el.className="wt-note "+(ok?"text-emerald-400":"text-amber-300");
 }
 function readJson(key,defaultValue){
   try {const value=localStorage.getItem(key);return value?JSON.parse(value):defaultValue;}
   catch(_){return defaultValue;}
 }
 function writeJson(key,value){
   localStorage.setItem(key,JSON.stringify(value));
 }
 function nativeState(){
   const shift=readJson("wt_active_shift",null);
   const state=shift && shift.start ?
     (shift.status==="paused"?"paused":"working") : "idle";
   return {state,started:state!=="idle" ? shift.start : ""};
 }
 async function publish(){
   const p=plugin();
   if(!p)return;
   try {await p.updateState(nativeState());}
   catch(_){status("Não foi possível atualizar o widget. Abre novamente a aplicação.",false);}
 }
 function isValidEvent(event){
   return event&&typeof event.id==="string"&&
     ["start","pause","resume","finish"].includes(event.action)&&
     typeof event.at==="string"&&!Number.isNaN(Date.parse(event.at));
 }
 function replayOne(event){
   if(!isValidEvent(event))return false;
   if(localStorage.getItem("wt_widget_last_event")===event.id)return true;
   let active=readJson("wt_active_shift",null);
   let pending=readJson("wt_shift_drafts",[]);
   if(!Array.isArray(pending))pending=[];
   if(event.action==="start"){
     if(!active){
       active={id:"widget-"+event.id,start:event.at,breaks:[],status:"working"};
       writeJson("wt_active_shift",active);
     }
   } else if(event.action==="pause"){
     if(active&&active.status==="working"&&Array.isArray(active.breaks)){
       active.breaks.push({start:event.at,end:null});
       active.status="paused";
       writeJson("wt_active_shift",active);
     }
   } else if(event.action==="resume"){
     if(active&&active.status==="paused"&&Array.isArray(active.breaks)){
       const last=active.breaks[active.breaks.length-1];
       if(last&&!last.end){
         last.end=event.at;
         active.status="working";
         writeJson("wt_active_shift",active);
       }
     }
   } else if(event.action==="finish"){
     if(active&&active.start&&Array.isArray(active.breaks)){
       const end=event.at;
       const seconds=root.ProUI&&root.ProUI.helpers ?
         root.ProUI.helpers.timeWorkedSeconds(active,end) : 0;
       const breaks=active.breaks.map(p=>({start:p.start,end:p.end||end}));
       // Even a short shift is kept for review; never lose a widget entry.
       const date=root.ProUI&&root.ProUI.helpers ?
         root.ProUI.helpers.localDateKey(active.start) : event.at.slice(0,10);
       const draft={id:active.id,start:active.start,end,breaks,
         seconds,date,source:"android-widget"};
       if(!pending.some(e=>e.id===draft.id)){
         pending.unshift(draft);
         writeJson("wt_shift_drafts",pending);
       }
       localStorage.removeItem("wt_active_shift");
     }
   }
   localStorage.setItem("wt_widget_last_event",event.id);
   return true;
 }
 async function sync(){
   if(syncing)return syncing;
   const p=plugin();
   if(!p)return;
   syncing=(async()=>{
     try {
       const response=await p.getPendingActions();
       const events=Array.isArray(response&&response.events)?response.events:[];
       let count=0;
       for(const event of events){
         if(!replayOne(event))break;
         await p.acknowledgeActions({throughId:event.id});
         count++;
       }
       await p.updateState(nativeState());
       if(count&&root.ProUI)root.ProUI.render();
     }catch(_){
       status("Não foi possível sincronizar todas as ações do widget. Mantém os dados e volta a abrir a aplicação.",false);
     }
   })().finally(()=>{syncing=null;});
   return syncing;
 }
 async function configure(enabled){
   const p=plugin();
   if(!p){
     status("O widget está disponível no APK Android Preview, não no navegador.",false);
     return false;
   }
   try {
     if(!enabled)await sync(); // Importar marcações antes de desativar.
     const result=await p.setEnabled({enabled:!!enabled});
     if(result && typeof result.enabled==="boolean" && result.enabled!==!!enabled)
       throw new Error("Não foi possível confirmar o estado do widget.");
     if(enabled){
       await sync();
       status("Widget ativo. Os botões Iniciar, Pausa e Terminar estão disponíveis no ecrã inicial.",true);
     }else{
       status("Widget desativado. Os botões no ecrã inicial deixam de marcar horas.",false);
     }
     return true;
   }catch(_){
     status("Não foi possível aplicar a configuração do widget. Tenta novamente.",false);
     return false;
   }
 }
 async function toggle(){
   const el=$("cfgWidgetEnabled");
   const enabled=!!(el&&el.checked);
   const previous=!!settings.widgetEnabled;
   const success=await configure(enabled);
   if(!success){
     if(el)el.checked=previous;
     return;
   }
   try {
     settings.widgetEnabled=enabled;
     localStorage.setItem("wt_settings",JSON.stringify(settings));
   }catch(_){
     status("Os botões foram alterados, mas a preferência não ficou guardada. Verifica o armazenamento.",false);
   }
 }
 async function reactivate(){
   const el=$("cfgWidgetEnabled");
   if(!el)return;
   el.checked=true;
   await toggle();
 }
 async function configureNotifications(enabled){
   const p=plugin();
   if(!p || !p.setShiftNotifications) {
     notificationStatus("As notificações de turno estão disponíveis na Preview Android atualizada.",false);
     return false;
   }
   try {
     const result=await p.setShiftNotifications({enabled:!!enabled});
     if(enabled && result && !result.systemAllowed) {
       notificationStatus("Para mostrar as notificações, autoriza-as nas Definições do Samsung.",false);
     } else if(enabled) {
       notificationStatus("Notificações ativadas. O estado do turno aparece na barra de notificações.",true);
     } else {
       notificationStatus("Notificações do turno desativadas.",true);
     }
     return true;
   } catch (_) {
     notificationStatus("Não foi possível alterar a preferência das notificações.",false);
     return false;
   }
 }
 async function refreshNotificationStatus(){
   const p=plugin();
   if(!p || !p.getShiftNotificationStatus)return;
   try{
     // O Android é a fonte de verdade. Nunca regravar as preferências nativas
     // com dados de um backup antigo ao abrir a aplicação.
     const native=await p.getShiftNotificationStatus();
     if(!native || typeof native.enabled!=="boolean")return;
     const old=!!settings.shiftNotifications;
     settings.shiftNotifications=native.enabled;
     const input=$("cfgShiftNotifications");
     if(input)input.checked=native.enabled;
     if(old!==native.enabled){
       try{localStorage.setItem("wt_settings",JSON.stringify(settings));}catch(_){}
     }
     if(native.enabled&&!native.systemAllowed)notificationStatus(
       "As notificações estão ativadas na app, mas bloqueadas no Samsung. Abre Permissões de notificações.",false);
     else if(native.enabled)notificationStatus(
       "Notificações de turno autorizadas e sincronizadas com o Android.",true);
     else notificationStatus("Notificações de turno desativadas.",true);
   }catch(_){notificationStatus("Não foi possível confirmar o estado das notificações Android.",false);}
 }
 async function toggleNotifications(){
   const checked=!!($("cfgShiftNotifications") && $("cfgShiftNotifications").checked);
   if (checked && !settings.widgetEnabled) {
     $("cfgShiftNotifications").checked=false;
     notificationStatus("Ativa primeiro o widget. Os botões da notificação usam o mesmo registo seguro.",false);
     return;
   }
   const old=!!settings.shiftNotifications;
   const applied=await configureNotifications(checked);
   if(!applied){
     if($("cfgShiftNotifications"))$("cfgShiftNotifications").checked=old;
     return;
   }
   try {
     settings.shiftNotifications=checked;
     localStorage.setItem("wt_settings",JSON.stringify(settings));
   }catch(_){notificationStatus("Não foi possível guardar a preferência das notificações.",false);}
 }
 async function openNotificationSettings(){
   const p=plugin();
   if(!p || !p.openNotificationSettings){
     notificationStatus("As definições de notificação só estão disponíveis no APK Android.",false);
     return;
   }
   try {await p.openNotificationSettings();}
   catch(_){notificationStatus("Não foi possível abrir as Definições do Android.",false);}
 }
 async function add(){
   const p=plugin();
   if(!p){status("Instala a Preview Android com suporte a widgets.",false);return;}
   if(!settings.widgetEnabled){
     status("Ativa primeiro o widget. A marcação pelo widget funciona sem pedir o PIN da aplicação.",false);return;
   }
   try{
     const response=await p.requestPinWidget();
     if(response&&response.requested){
       status("Confirma a adição do widget no Samsung quando surgir o aviso.",true);
     }else{
       status("No Samsung, mantém premida uma zona vazia do ecrã inicial → Widgets → WorkTime Pro 2 Preview.",false);
     }
   }catch(_){
     status("Abre o ecrã inicial do Samsung → Widgets → WorkTime Pro 2 Preview.",false);
   }
 }
 async function init(){
   if(ready)return;ready=true;
   const p=plugin();
   // Não desativar automaticamente um widget que já tinha sido autorizado
   // no Android. O estado nativo tem precedência sobre um backup desatualizado.
   let native=null;
   if(p && p.getStatus){
     try{native=await p.getStatus();}catch(_){}
   }
   if(native && typeof native.enabled==="boolean"){
     if(native.hasPendingEvents)await sync();
     const previouslyEnabled=!!settings.widgetEnabled;
     settings.widgetEnabled=native.enabled;
     const checkbox=$("cfgWidgetEnabled");
     if(checkbox)checkbox.checked=!!native.enabled;
     if(previouslyEnabled!==native.enabled){
       try{localStorage.setItem("wt_settings",JSON.stringify(settings));}catch(_){}
     }
     if(native.enabled){
       await sync();
       status("Widget ativo. Já podes marcar entrada, pausa e saída no ecrã inicial.",true);
     }else{
       status(previouslyEnabled
         ? "A última instalação desativou o widget. Toca em «Reativar widget» para voltar a marcar."
         : "Widget desativado. Ativa os botões rápidos ou toca em «Reativar widget».",false);
     }
   } else {
     // Compatibilidade com a integração Android anterior.
     if($("cfgWidgetEnabled"))$("cfgWidgetEnabled").checked=!!settings.widgetEnabled;
     await configure(!!settings.widgetEnabled);
   }
   if($("cfgShiftNotifications"))$("cfgShiftNotifications").checked=!!settings.shiftNotifications;
   await refreshNotificationStatus();
   document.addEventListener("visibilitychange",()=>{
     if(!document.hidden){sync();refreshNotificationStatus();}
   });
   root.addEventListener("focus",()=>{sync();refreshNotificationStatus();});
 }
 root.WTWidget={init,sync,publish,toggle,reactivate,add,configure,toggleNotifications,openNotificationSettings,configureNotifications,refreshNotificationStatus};
}(window));
