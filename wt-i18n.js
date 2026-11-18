/* UI locale support. The original Portuguese source text is preserved in a WeakMap
   so changing language back never compounds translations. No network/translation API. */
(function(root){
"use strict";
const words={
fr:{
"WorkTime Pro":"WorkTime Pro","O teu trabalho, organizado":"Votre travail, organisé",
"Vista geral":"Vue d'ensemble","O teu mês, ao detalhe":"Votre mois en détail",
"Mês atual":"Mois en cours","Estimativa":"Estimation","Líquido parcial, sem CIS":"Net partiel, hors crédit CIS",
"Bruto estimado":"Brut estimé","Horas no mês":"Heures du mois","País empregador":"Pays de l'employeur",
"Horas normais":"Heures normales","Horas extra":"Heures supplémentaires","Dias trabalhados":"Jours travaillés",
"Dias de férias":"Jours de congé","Acesso rápido":"Accès rapide","Atalhos":"Raccourcis",
"Marcar ponto":"Pointer","Entrada, pausa e saída":"Arrivée, pause et départ","Calendário":"Calendrier",
"Trabalho, férias e folgas":"Travail, congés et repos","Registo manual":"Saisie manuelle",
"Adicionar ou corrigir horas":"Ajouter ou corriger des heures","Férias e feriados":"Congés et jours fériés",
"Saldo e dias registados":"Solde et jours enregistrés","Horas trabalhadas":"Heures travaillées",
"Semanas do mês":"Semaines du mois","Atividade recente":"Activité récente","Ver calendário":"Voir le calendrier",
"Ganhos e descontos":"Revenus et cotisations","Salário e remuneração":"Salaire et rémunération",
"Não é recibo oficial":"Bulletin non officiel","Bruto":"Brut","Descontos estim.":"Retenues estimées","Bónus":"Prime",
"Visão mensal":"Vue mensuelle","Registo em tempo real":"Pointage en temps réel",
"Relógio de ponto":"Pointeuse","Marca a entrada, as pausas, o regresso e a saída.":"Pointez l'arrivée, les pauses, la reprise et le départ.",
"Pronto para começar":"Prêt à commencer","Em pausa":"En pause","Turno em curso":"Service en cours","Retomar trabalho":"Reprendre le travail","Iniciar pausa":"Commencer une pause","Entrada":"Arrivée","Pausas":"Pauses","Tempo":"Temps",
"Útil":"Effectif","Iniciar turno":"Démarrer","Terminar turno":"Terminer",
"Turnos por guardar":"Services à enregistrer","rascunhos":"brouillons",
"Registar / ajustar horas manualmente":"Saisir / corriger les heures",
"Anular turno em curso":"Annuler le service","Dia selecionado":"Jour sélectionné",
"Seleciona um dia":"Sélectionnez un jour","Sem registo":"Aucune saisie",
"Abrir / registar este dia":"Ouvrir / saisir ce jour","Dias com registos":"Jours enregistrés",
"Início":"Accueil","Ponto":"Pointage","Salário":"Salaire","Opções":"Options",
"Personalização":"Personnalisation","Ecrã ao abrir a aplicação":"Écran au démarrage",
"Relógio de ponto":"Pointeuse","Painel principal":"Tableau de bord",
"Acesso rápido":"Accès rapide","Configurações":"Paramètres",
"Horários, países e calendário":"Horaires, pays et calendrier",
"Salário, taxas e impostos":"Salaire, cotisations et impôts","Dados e segurança":"Données et sécurité",
"Aparência":"Apparence","Taxas e Valores":"Taux et montants",
"Valor Hora Base (€/h)":"Salaire horaire de base (€/h)",
"Bónus Horário Fixo (€/h)":"Prime horaire fixe (€/h)",
"Majoração Hora Extra (%)":"Majoration des heures supplémentaires (%)",
"Majoração Noturna (%)":"Majoration de nuit (%)",
"Subsídio Diário / Panier (€/dia)":"Indemnité journalière / panier (€/jour)",
"Média 3M Extra p/ Férias (€/dia)":"Supplément congés moyen 3 mois (€/jour)",
"Sistema de Impostos":"Système fiscal","Regime Fiscal":"Régime fiscal","Classe de Imposto":"Classe d'impôt",
"Taxa IRS Manual Opcional (%)":"Taux d'impôt manuel facultatif (%)",
"Crédito Fiscal CIS (€/mês)":"Crédit d'impôt CIS (€/mois)",
"Classe 1 (Solteiro/Divorciado)":"Classe 1 (Célibataire/Divorcé)",
"Classe 1a (Monoparental)":"Classe 1a (Famille monoparentale)",
"Classe 2 (Casado / PACS)":"Classe 2 (Marié / PACS)",
"Luxemburgo (estimativa)":"Luxembourg (estimation)","Personalizado":"Personnalisé",
"País dos Feriados e Férias":"Pays des jours fériés et congés",
"Calendário Oficial":"Calendrier officiel",
"Dias de Férias Base / Ano":"Congés annuels de base",
"País da empresa e residência":"Pays d'emploi et de résidence",
"País do empregador":"Pays de l'employeur","País de residência":"Pays de résidence",
"Região do calendário (opcional)":"Région du calendrier (facultatif)",
"Horário semanal personalizado":"Horaires hebdomadaires personnalisés",
"Idioma":"Langue","Alternar entre Modo Escuro e Claro":"Passer du mode sombre au mode clair",
"Alternar Tema":"Changer de thème","Dados e Backup":"Données et sauvegarde",
"Guardar Backup (.json)":"Enregistrer une sauvegarde (.json)",
"Exportar Excel (.csv)":"Exporter CSV (.csv)",
"Restaurar Backup anterior (.json)":"Restaurer une sauvegarde (.json)",
"Repor dados anteriores à última importação":"Restaurer les données avant importation",
"Segurança":"Sécurité","Guardar PIN":"Enregistrer le code PIN",
"Trabalho Normal":"Travail normal","Férias (Média 3M)":"Congés (moyenne 3 mois)",
"Feriado Oficial":"Jour férié officiel","Baixa Médica":"Arrêt maladie","Folga / Descanso":"Repos",
"Data":"Date","Tipo de Dia":"Type de jour","Notas (Rota, camião, observações)":"Notes (tournée, camion, observations)",
"Incluir Bónus Horário + Subsídio Diário":"Inclure prime horaire et panier",
"Registos Deste Mês":"Saisies de ce mois","Registar Dia de Trabalho":"Enregistrer une journée",
"Guardar Registo do Dia":"Enregistrer la journée",
"Simulação Fiche de Salaire":"Simulation du bulletin de paie",
"Imposto (IRS) e Créditos":"Impôt et crédits",
"Saldo de Férias e Média de 3 Meses":"Solde des congés et moyenne 3 mois",
"Direito Anual":"Droit annuel","+ Compensatórios":"+ Repos compensateurs",
"Saldo Restante":"Solde restant","Feriados Oficiais":"Jours fériés officiels",
"Guardar PIN de 4 dígitos":"Enregistrer un code PIN de 4 chiffres",
"Taxa social manual (%)":"Cotisations manuelles (%)",
"Retenção manual (%)":"Retenue manuelle (%)",
"Usar mínimo legal":"Utiliser le minimum légal",
"Dias úteis equivalentes":"Jours ouvrés équivalents",
"Calculadora fiscal":"Calculateur fiscal",
"Regra fiscal atual":"Règle fiscale actuelle",
"Ver fonte oficial":"Voir la source officielle"
},
en:{
"O teu trabalho, organizado":"Your work, organized","Vista geral":"Overview",
"O teu mês, ao detalhe":"Your month at a glance","Estimativa":"Estimate",
"Líquido parcial, sem CIS":"Partial net, excluding CIS","Bruto estimado":"Estimated gross",
"Horas no mês":"Hours this month","País empregador":"Employer country",
"Horas normais":"Regular hours","Horas extra":"Overtime","Dias trabalhados":"Days worked",
"Dias de férias":"Vacation days","Acesso rápido":"Quick access","Atalhos":"Shortcuts",
"Marcar ponto":"Clock in","Entrada, pausa e saída":"Start, break and finish",
"Calendário":"Calendar","Trabalho, férias e folgas":"Work, leave and rest days",
"Registo manual":"Manual entry","Adicionar ou corrigir horas":"Add or edit hours",
"Férias e feriados":"Leave and holidays","Saldo e dias registados":"Balance and logged days",
"Horas trabalhadas":"Hours worked","Semanas do mês":"Weeks of month",
"Atividade recente":"Recent activity","Ver calendário":"View calendar",
"Ganhos e descontos":"Earnings and deductions","Salário e remuneração":"Salary and pay",
"Não é recibo oficial":"Not an official payslip","Bruto":"Gross","Descontos estim.":"Estimated deductions",
"Bónus":"Bonus","Visão mensal":"Monthly view","Registo em tempo real":"Live time tracking",
"Relógio de ponto":"Time clock","Marca a entrada, as pausas, o regresso e a saída.":"Track start, break, resume and finish.",
"Pronto para começar":"Ready to start","Em pausa":"On break","Turno em curso":"Shift running","Retomar trabalho":"Resume work","Iniciar pausa":"Start break","Entrada":"Start","Pausas":"Breaks","Tempo":"Time",
"Útil":"Worked","Iniciar turno":"Start shift","Terminar turno":"Finish shift",
"Turnos por guardar":"Pending shifts","rascunhos":"drafts",
"Registar / ajustar horas manualmente":"Log / adjust hours manually",
"Dia selecionado":"Selected day","Seleciona um dia":"Select a day",
"Sem registo":"No entry","Abrir / registar este dia":"Open / log this day",
"Início":"Home","Ponto":"Clock","Salário":"Pay","Opções":"Options",
"Personalização":"Personalization","Ecrã ao abrir a aplicação":"Start screen",
"Painel principal":"Dashboard","Configurações":"Settings",
"Horários, países e calendário":"Schedules, countries and calendar",
"Salário, taxas e impostos":"Pay, rates and taxes","Dados e segurança":"Data and security",
"Aparência":"Appearance","Taxas e Valores":"Rates and amounts",
"Sistema de Impostos":"Tax system","Regime Fiscal":"Tax regime",
"Classe de Imposto":"Tax class","Taxa IRS Manual Opcional (%)":"Optional manual tax rate (%)",
"Crédito Fiscal CIS (€/mês)":"CIS tax credit (€/month)",
"País dos Feriados e Férias":"Holiday calendar country",
"Calendário Oficial":"Official calendar","Dias de Férias Base / Ano":"Annual leave days",
"País da empresa e residência":"Employer and residence countries",
"País do empregador":"Employer country","País de residência":"Residence country",
"Região do calendário (opcional)":"Calendar region (optional)",
"Horário semanal personalizado":"Custom weekly schedule","Idioma":"Language",
"Dados e Backup":"Data and backup","Guardar Backup (.json)":"Save backup (.json)",
"Exportar Excel (.csv)":"Export CSV (.csv)",
"Restaurar Backup anterior (.json)":"Restore backup (.json)",
"Segurança":"Security","Guardar PIN":"Save PIN","Usar mínimo legal":"Use legal minimum",
"Taxa social manual (%)":"Manual social rate (%)","Retenção manual (%)":"Manual withholding (%)",
"Trabalho Normal":"Regular work","Feriado Oficial":"Public holiday",
"Baixa Médica":"Sick leave","Folga / Descanso":"Rest day",
"Valor Hora Base (€/h)":"Base hourly rate (€/h)","Bónus Horário Fixo (€/h)":"Fixed hourly bonus (€/h)",
"Majoração Hora Extra (%)":"Overtime supplement (%)","Majoração Noturna (%)":"Night supplement (%)",
"Subsídio Diário / Panier (€/dia)":"Daily allowance / panier (€/day)",
"Data":"Date","Tipo de Dia":"Day type","Registar Dia de Trabalho":"Log work day",
"Guardar Registo do Dia":"Save day","Registos Deste Mês":"Entries this month",
"Ver fonte oficial":"View official source"
},
de:{
"O teu trabalho, organizado":"Deine Arbeit, organisiert","Vista geral":"Übersicht",
"O teu mês, ao detalhe":"Dein Monat im Überblick","Estimativa":"Schätzung",
"Líquido parcial, sem CIS":"Teilnetto ohne CIS","Bruto estimado":"Geschätztes Brutto",
"Horas no mês":"Stunden im Monat","País empregador":"Arbeitgeberland",
"Horas normais":"Reguläre Stunden","Horas extra":"Überstunden",
"Dias trabalhados":"Arbeitstage","Dias de férias":"Urlaubstage",
"Acesso rápido":"Schnellzugriff","Atalhos":"Kurzbefehle","Marcar ponto":"Zeit erfassen",
"Calendário":"Kalender","Registo manual":"Manuelle Erfassung",
"Férias e feriados":"Urlaub und Feiertage","Horas trabalhadas":"Arbeitsstunden",
"Atividade recente":"Letzte Aktivitäten","Ver calendário":"Kalender ansehen",
"Salário e remuneração":"Lohn und Gehalt","Visão mensal":"Monatsübersicht",
"Registo em tempo real":"Zeiterfassung","Relógio de ponto":"Stempeluhr",
"Pronto para começar":"Bereit zum Starten","Entrada":"Beginn","Pausas":"Pausen",
"Tempo":"Zeit","Útil":"Arbeitszeit","Iniciar turno":"Schicht starten",
"Terminar turno":"Schicht beenden","Turnos por guardar":"Offene Schichten","rascunhos":"Entwürfe",
"Início":"Start","Ponto":"Stempeln","Salário":"Gehalt","Opções":"Optionen",
"Configurações":"Einstellungen","Personalização":"Personalisierung",
"Ecrã ao abrir a aplicação":"Startbildschirm","Dados e segurança":"Daten und Sicherheit",
"Salário, taxas e impostos":"Lohn und Steuern","Aparência":"Darstellung",
"Horários, países e calendário":"Arbeitszeiten, Länder, Kalender",
"País do empregador":"Arbeitgeberland","País de residência":"Wohnsitzland",
"Calendário Oficial":"Feiertagskalender","Dias de Férias Base / Ano":"Jahresurlaubstage",
"Sistema de Impostos":"Steuersystem","Classe de Imposto":"Steuerklasse",
"Idioma":"Sprache","Dados e Backup":"Daten und Sicherung",
"Guardar Backup (.json)":"Backup speichern (.json)","Segurança":"Sicherheit",
"Guardar PIN":"PIN speichern","Usar mínimo legal":"Gesetzliches Minimum verwenden",
"Ver fonte oficial":"Offizielle Quelle ansehen"
},
es:{
"O teu trabalho, organizado":"Tu trabajo, organizado","Vista geral":"Resumen",
"O teu mês, ao detalhe":"Tu mes al detalle","Estimativa":"Estimación",
"Líquido parcial, sem CIS":"Neto parcial sin CIS","Bruto estimado":"Bruto estimado",
"Horas no mês":"Horas del mes","País empregador":"País del empleador",
"Horas normais":"Horas normales","Horas extra":"Horas extra",
"Dias trabalhados":"Días trabajados","Dias de férias":"Días de vacaciones",
"Acesso rápido":"Acceso rápido","Atalhos":"Atajos","Marcar ponto":"Fichar",
"Calendário":"Calendario","Registo manual":"Registro manual",
"Férias e feriados":"Vacaciones y festivos","Horas trabalhadas":"Horas trabajadas",
"Atividade recente":"Actividad reciente","Ver calendário":"Ver calendario",
"Salário e remuneração":"Salario y remuneración","Visão mensal":"Vista mensual",
"Registo em tempo real":"Registro en tiempo real","Relógio de ponto":"Reloj de fichaje",
"Pronto para começar":"Listo para empezar","Entrada":"Entrada","Pausas":"Pausas",
"Tempo":"Tiempo","Útil":"Útil","Iniciar turno":"Iniciar turno",
"Terminar turno":"Terminar turno","Turnos por guardar":"Turnos pendientes","rascunhos":"borradores",
"Início":"Inicio","Ponto":"Fichaje","Salário":"Salario","Opções":"Opciones",
"Configurações":"Ajustes","Personalização":"Personalización",
"Ecrã ao abrir a aplicação":"Pantalla de inicio","Dados e segurança":"Datos y seguridad",
"Salário, taxas e impostos":"Salario e impuestos","Aparência":"Apariencia",
"Horários, países e calendário":"Horarios, países y calendario",
"País do empregador":"País del empleador","País de residência":"País de residencia",
"Calendário Oficial":"Calendario oficial","Dias de Férias Base / Ano":"Días de vacaciones al año",
"Sistema de Impostos":"Sistema fiscal","Classe de Imposto":"Clase fiscal",
"Idioma":"Idioma","Dados e Backup":"Datos y copia de seguridad",
"Guardar Backup (.json)":"Guardar copia (.json)","Segurança":"Seguridad",
"Guardar PIN":"Guardar PIN","Usar mínimo legal":"Usar mínimo legal",
"Ver fonte oficial":"Ver fuente oficial"
},
lu:{
"O teu trabalho, organizado":"Deng Aarbecht, organiséiert","Vista geral":"Iwwerbléck",
"O teu mês, ao detalhe":"Däi Mount am Detail","Estimativa":"Schätzung",
"Líquido parcial, sem CIS":"Deel-Netto ouni CIS","Bruto estimado":"Geschätzte Brutto",
"Horas no mês":"Stonnen am Mount","País empregador":"Land vum Patron",
"Horas normais":"Normal Stonnen","Horas extra":"Iwwerstonnen",
"Dias trabalhados":"Aarbechtsdeeg","Dias de férias":"Congésdeeg",
"Acesso rápido":"Schnellzougang","Marcar ponto":"Stempelen",
"Calendário":"Kalenner","Registo manual":"Manuell Aschreiwung",
"Férias e feriados":"Congé a Feierdeeg","Horas trabalhadas":"Geschaffte Stonnen",
"Atividade recente":"Lescht Aktivitéiten","Ver calendário":"Kalenner weisen",
"Salário e remuneração":"Pai a Verdéngscht","Relógio de ponto":"Stempelauer",
"Pronto para começar":"Bereet fir unzefänken",
"Entrada":"Ufank","Pausas":"Pausen","Tempo":"Zäit","Útil":"Aarbechtszäit",
"Iniciar turno":"Schicht ufänken","Terminar turno":"Schicht ophalen",
"Início":"Start","Ponto":"Stempelen","Salário":"Pai","Opções":"Astellungen",
"Configurações":"Astellungen","Personalização":"Personalisatioun",
"Ecrã ao abrir a aplicação":"Startbildschierm","Dados e segurança":"Donnéeën a Sécherheet",
"Salário, taxas e impostos":"Pai a Steieren","Aparência":"Ausgesinn",
"Horários, países e calendário":"Aarbechtszäiten, Länner a Kalenner",
"País do empregador":"Land vum Patron","País de residência":"Wunnsëtzland",
"Calendário Oficial":"Offizielle Kalenner","Dias de Férias Base / Ano":"Congésdeeg pro Joer",
"Sistema de Impostos":"Steiersystem","Classe de Imposto":"Steierklass",
"Idioma":"Sprooch","Dados e Backup":"Donnéeën a Backup",
"Guardar Backup (.json)":"Backup späicheren (.json)",
"Segurança":"Sécherheet","Guardar PIN":"PIN späicheren",
"Usar mínimo legal":"Gesetzleche Minimum benotzen"
}
};
const originals = new WeakMap();
function normalize(code) { return ["fr","en","de","es","lu","pt"].includes(code)?code:"pt"; }
function tr(text,language) {
 const locale=normalize(language);
 if(locale==="pt")return text;
 const literal=(words[locale]||{})[text];
 if(literal)return literal;
 // Headings such as "4. País dos Feriados e Férias" keep the index.
 const numbered=/^(\d+[A-Z]?\.\s*)(.+)$/.exec(text);
 if(numbered){
   const translated=(words[locale]||{})[numbered[2]];
   if(translated)return numbered[1]+translated;
 }
 return text;
}
function apply(language) {
 const locale=normalize(language);
 document.documentElement.lang=locale==="lu"?"lb":locale;
 if(!document.body) return;
 const scan=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let node;
 while((node=scan.nextNode())) {
   const owner=node.parentElement;
   if(!owner || owner.closest("script,style,noscript,[data-i18n],svg")) continue;
   const content=node.nodeValue;
   const trimmed=content.trim();
   if(!trimmed)continue;
   if(!originals.has(node))originals.set(node,trimmed);
   const base=originals.get(node);
   const translated=tr(base,locale);
   if(translated!==trimmed)node.nodeValue=content.replace(trimmed,translated);
 }
 document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach(input=>{
   const original=input.dataset.wtOrigPlaceholder || input.getAttribute("placeholder");
   if(!input.dataset.wtOrigPlaceholder)input.dataset.wtOrigPlaceholder=original;
   input.setAttribute("placeholder",tr(original,locale));
 });
}
root.WTLocale={apply,tr};
}(window));
