# WorkTime Pro 2.0 — Plano de evolução

## Decisões aprovadas
- Suportar todos os países progressivamente, adicionando regras apenas após verificação.
- Usar o país da entidade empregadora como referência fiscal principal.
- Guardar separadamente o país de residência.
- Manter país/região do calendário e idioma independentes do país fiscal.
- Preservar os dados e funcionalidades existentes.
- Desenvolver na branch worktime-pro-2; não alterar main nesta fase.

## Inventário inicial
A aplicação atual é uma PWA concentrada em index.html, com manifest.json e sw.js. Os dados principais estão em localStorage nas chaves wt_settings e wt_entries. Inclui configuração de remuneração, registo diário, cálculos mensais, comparação de recibos, backup/restauro JSON e exportação CSV.

Limitações identificadas: registos apenas com totais diários; preenchimento semanal fixo de 8h de segunda a sexta; fiscalidade e feriados orientados sobretudo ao Luxemburgo; traduções incompletas; cache PWA com nome fixo. O workflow APK atual é acionado por push em main e precisa de uma via de teste na branch de desenvolvimento.

## Preservação obrigatória
- Fazer backup JSON e testar a importação antes de qualquer migração.
- Preservar wt_settings e wt_entries e todos os campos antigos.
- Introduzir versão de esquema e migrações idempotentes.
- Manter compatibilidade com backups antigos.
- Não migrar para IndexedDB sem cópia, validação e recuperação testadas.
- Não inventar horas de entrada/saída para registos antigos que só contêm duração total.

## Configuração futura
Separar employerCountry, residenceCountry, calendarCountry, calendarRegion, language, currency, taxYear e workSchedule. O país empregador é a referência fiscal principal; residência fica separada para casos transfronteiriços; calendário e idioma não alteram fiscalidade.

Exemplo conceptual, não substituir diretamente as configurações atuais:
```json
{
  "schemaVersion": 2,
  "language": "pt-PT",
  "employerCountry": "LU",
  "residenceCountry": "LU",
  "calendarCountry": "LU",
  "calendarRegion": null,
  "currency": "EUR",
  "taxYear": 2026,
  "taxProfile": { "mode": "employer-country", "class": null, "manualWithholdingRate": null },
  "workSchedule": { "timezone": "Europe/Luxembourg", "weeklyTemplate": {}, "breaks": [] }
}
```

## Funcionalidades planeadas
1. Horários semanais configuráveis.
2. Entrada, saída e pausas pagas/não pagas, incluindo pausas múltiplas e turnos repartidos.
3. Horas normais, extraordinárias e noturnas.
4. Calendário por país/região/ano, com feriados, férias, baixa e folgas.
5. Remuneração bruta, complementos, subsídios, retenção estimada e líquido estimado.
6. Relatórios semanais, mensais e anuais; comparação de recibos e exportações.
7. Fiscalidade modular por país e ano, com fonte oficial, data de verificação e limitações. Países não verificados ficam em modo manual/estimativo, nunca apresentados como cálculo oficial.

## Fases
0. Inventário completo de ficheiros, workflows, dependências, dados e pipeline APK.
1. Camada de compatibilidade, versão de esquema e testes de backup/restauro.
2. Separação de país empregador, residência, calendário/região e idioma.
3. Horários e marcações detalhadas.
4. Calendário e remuneração com testes de regressão.
5. Fiscalidade por país/ano com fontes oficiais.
6. Traduções, modo offline, build APK e testes Android.

## Critérios de aceitação
- Nenhum dado antigo desaparece; backups antigos continuam a importar.
- Idioma, calendário e país fiscal são independentes.
- Alterar país empregador não apaga histórico.
- Registos antigos continuam visíveis e editáveis.
- Regras fiscais não verificadas são identificadas como estimativas.
- main permanece intacta até aprovação explícita.

## Próximo passo
Concluir o inventário do repositório e do workflow APK antes de alterar a aplicação. Implementar primeiro a camada de compatibilidade e os testes de preservação.
