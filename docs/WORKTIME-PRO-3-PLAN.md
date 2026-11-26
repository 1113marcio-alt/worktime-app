# WorkTime Pro 3.0 — plano de desenvolvimento
Base preservada: WorkTime Pro 2, commit 4f8f8e8897e8ea0685dd94a23425c7c327bb2f58. Desenvolver na branch worktime-pro-2 para manter o identificador Android Preview e o workflow existente; nunca escrever em main sem autorização explícita.

## Fase 1 — Remuneração
- [x] Histórico de taxas com data de início (inclui remuneração base, bónus horário, extra, noite e panier). Taxas anteriores à primeira data são uma estimativa, não dados inventados.
- [x] Previsão do mês em curso, baseada no horário semanal e nos registos já existentes; não cria registos nem projeta novas horas extraordinárias.
- [x] Fecho/reabertura de meses terminados: snapshot de totais e parâmetros fiscais estimados, líquido real opcional, diferença no relatório PDF, bloqueio de edição/eliminação/preenchimento e aplicação de rascunhos, compatibilidade de backup. Não fecha com turnos pendentes. A taxa do prémio anual permanece configurável; a base usa bruto congelado dos meses fechados. Validação específica executada; confirmação integral no Actions pendente.
- [ ] Confirmar testes integrais no Actions, APK e teste visual num Android. A fiscalidade mantém o modelo estimativo anterior; histórico fiscal e do contrato anual são melhorias separadas.

## Fase 2 — Interface e estatísticas
- [x] Painel inicial personalizável: 8 cartões ordenáveis, mostrar/ocultar, atalhos obrigatoriamente visíveis, preferências e backup.
- [x] Estatísticas mensais e anuais: totais e tabela de 12 meses, estimativas e valores reais dos fechos separados, registos futuros excluídos, dias previstos sem registo identificados usando horário atual.
- [x] Estilos de aparência: Premium original, Minimalista, AMOLED, Efeito vidro e 3 tamanhos de texto, cores/temas preservados e preferências no backup. Testes específicos de estado e persistência executados; contraste visual e navegação no Android pendentes.

## Fase 3 — Gestão de trabalho
- [x] Calendário avançado: intervalo de até 366 dias, pré-visualização, confirmação, nunca substituir existentes, ignorar fechados, turnos pendentes e feriados conhecidos em férias; férias transitadas confirmadas manualmente por ano.
- [x] Modo motorista: diário manual de intervalos de condução, carga, descarga, outros trabalhos, disponibilidade e descanso; travessia da meia-noite, proteção contra sobreposição e backup. Independente do relógio e da folha salarial; sem tacógrafo, GPS ou certificação legal.
- [x] Banco de horas: crédito de horas extra e débito em folgas, saldo cronológico não negativo, associação ao registo diário, exclusão do pagamento das horas extra acumuladas, manutenção de bónus horário e suplemento noturno. Modelo pessoal 1:1; a remuneração da folga não é calculada automaticamente. Regras contratuais exigem confirmação. Testes específicos executados, CI/Android pendentes.

## Fase 4 — Segurança e automatização
- [ ] Backup automático e encriptado: autenticação, recuperação, cópias versionadas, testes de corrupção e recuperação; conservar backup JSON existente. Preferir criptografia autenticada com chave derivada de palavra-passe, nunca criar chave ou segredo no repositório; destino externo requer consentimento.
- [ ] Biometria Android: integração com BiometricPrompt/Keystore e PIN alternativo; não tratar biometria como encriptação dos dados existentes.
- [ ] Notificações inteligentes: permissão explícita, horários configuráveis, evitar avisos repetidos, verificar restrições de execução em segundo plano e não distrair durante condução.

## Fase 5 — Documentos e distribuição
- [ ] Digitalização de recibos: OCR preferencialmente local e confirmação dos campos antes de gravar; nunca apresentar reconhecimento como cálculo oficial.
- [ ] Relatórios semanais, mensais e anuais: PDF e XLSX reais, manter exportação CSV e PDF/impressão existentes, privacidade e consistência dos valores.
- [ ] Atualizações APK: assinatura estável, versão monotónica, canal de distribuição com verificação da integridade e consentimento; não recolher chaves pelo chat. Ver docs/ANDROID-SIGNING.md.

## Critérios comuns de aceitação
Cada alteração precisa de testes específicos e regressão antes de disponibilizar uma versão final. O pipeline já executa node --test tests/smoke.cjs antes da compilação. A confirmação de um teste isolado não prova aprovação de todo o pipeline nem comportamento no dispositivo. Compatibilidade de backups antigos, sem perder registos, preferências ou turnos. Nenhum segredo, recibo ou dado pessoal no GitHub. Teste de instalação/atualização no dispositivo e recuperação por backup. Não promover a Preview a versão estável até aprovação.
