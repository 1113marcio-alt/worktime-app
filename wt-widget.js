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
   if(!p){status("O widget está disponível no APK Android Preview, não no navegador.",false);return;}
   try{
     if(!enabled)await sync(); // import queued actions BEFORE disabling native controls.
     await p.setEnabled({enabled:!!enabled});
     if(enabled){
       await sync();
       status("Widget ativo. Usa «Adicionar ao ecrã inicial» ou procura WorkTime Pro 2 nos Widgets do Samsung.",true);
     }else{
       status("Widget desativado. Os botões no ecrã inicial deixam de marcar horas.",false);
     }
   }catch(_){status("Não foi possível aplicar a configuração do widget.",false);}
 }
 async function toggle(){
   const el=$("cfgWidgetEnabled");
   const enabled=!!(el&&el.checked);
   try{
     settings.widgetEnabled=enabled;
     localStorage.setItem("wt_settings",JSON.stringify(settings));
     await configure(enabled);
   }catch(_){status("Não foi possível guardar a preferência do widget.",false);}
 }
 async function configureNotifications(enabled){
   const p=plugin();
   if(!p || !p.setShiftNotifications) {
     status("As notificações de turno estão disponíveis na Preview Android atualizada.",false);
     return;
   }
   try {
     const result=await p.setShiftNotifications({enabled:!!enabled});
     if(enabled && result && !result.systemAllowed) {
       status("Para mostrar as notificações, autoriza-as nas Definições do Samsung.",false);
     } else if(enabled) {
       status("Notificações ativadas. O estado do turno aparece na barra de notificações.",true);
     } else {
       status("Notificações do turno desativadas.",true);
     }
   } catch (_) {
     status("Não foi possível alterar a preferência das notificações.",false);
   }
 }
 async function toggleNotifications(){
   const checked=!!($("cfgShiftNotifications") && $("cfgShiftNotifications").checked);
   try {
     settings.shiftNotifications=checked;
     localStorage.setItem("wt_settings",JSON.stringify(settings));
     await configureNotifications(checked);
   }catch(_){status("Não foi possível guardar a preferência das notificações.",false);}
 }
 async function openNotificationSettings(){
   const p=plugin();
   if(!p || !p.openNotificationSettings){
     status("As definições de notificação só estão disponíveis no APK Android.",false);
     return;
   }
   try {await p.openNotificationSettings();}
   catch(_){status("Não foi possível abrir as Definições do Android.",false);}
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
   if($("cfgWidgetEnabled"))$("cfgWidgetEnabled").checked=!!settings.widgetEnabled;
   await configure(!!settings.widgetEnabled);
   if($("cfgShiftNotifications"))$("cfgShiftNotifications").checked=!!settings.shiftNotifications;
   await configureNotifications(!!settings.shiftNotifications);
   document.addEventListener("visibilitychange",()=>{if(!document.hidden)sync();});
   root.addEventListener("focus",()=>sync());
 }
 root.WTWidget={init,sync,publish,toggle,add,configure,toggleNotifications,openNotificationSettings,configureNotifications};
}(window));
