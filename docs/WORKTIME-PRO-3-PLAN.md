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
- [~] Backup encriptado portátil e cópias automáticas durante sessão: AES-256-GCM + PBKDF2-SHA256 (600000 iterações), palavra-passe apenas em memória, três versões locais diárias/semanais, exportação/restauro e recuperação anterior; backup JSON legado preservado. Testes do módulo com Web Crypto (Unicode, payload de 1 MB, palavra-passe errada, adulteração), rotação e falhas de armazenamento. Pendente: serviço automático persistente após fechar a app, validação da recuperação integrada no CI e teste Android. O armazenamento dos registos e as cópias pré-importação criadas ao importar JSON simples não são encriptados por esta funcionalidade. Importar ficheiro encriptado passa a proteger também a cópia de recuperação anterior com a palavra-passe da importação.
- [x] Biometria Android: BiometricPrompt forte nativo (Android 11+), ativação local explícita com PIN ativo, cancelamento e PIN alternativo. Não protege criptograficamente os registos; preferência e autorização não exportadas. Lógica JS simulada e integração estática verificadas; compilação e teste de sensor pendentes.
- [~] Lembretes de entrada/saída: alarmes Android inexatos, dias/horários selecionáveis, canal silencioso e sem detalhes salariais, permissão do sistema; rearme ao abrir a app após reinício/paragem forçada. Avisos dentro da app para dias sem registo, rascunhos e férias próximas. Configuração dos alarmes nativa deste dispositivo, sem reativação por importação. Inclui agora um terceiro lembrete opcional de pausa a hora fixa, com ID de alarme independente e validação de horários. Pendente: teste de entrega real; não deteta condução.

## Fase 5 — Documentos e distribuição
- [x] Digitalização: câmara/galeria Capacitor e OCR ML Kit integrado, valores bruto/líquido sugeridos conservadoramente e confirmação manual; só valores confirmados entram nos registos e backups. Mantém estimativas congeladas. Testes do parser, persistência e fecho executados; reconhecimento em fotografia e compilação Android pendentes.
- [x] Relatórios semanais, mensais e anuais: PDF via diálogo de impressão e XLSX OOXML real com folhas Resumo/Registos/Meses, sem fórmulas em notas, sem previsão ou futuro, valores reais separados. Sem retenção fiscal semanal artificial. CSV e PDF antigos preservados. Verificações específicas JS do modelo/ZIP/CRC executadas; testes completos, abertura no Excel e impressão Android pendentes.
- [~] Atualizações: versão Android monotónica 100000 + número da execução, nome 3.0-preview.N, ID Preview preservado. Consulta manual a releases oficiais, validação de canal/tag e versão, abertura no navegador; publicação assinada opcional e manual, após testes, com apksigner. Sem instalação automática; Android confirma assinatura. Ainda é necessário configurar/confirmar os segredos de assinatura, publicar uma versão e testar o percurso real. Ver docs/ANDROID-SIGNING.md.

## Critérios comuns de aceitação
Cada alteração precisa de testes específicos e regressão antes de disponibilizar uma versão final. O pipeline já executa node --test tests/smoke.cjs antes da compilação. A confirmação de um teste isolado não prova aprovação de todo o pipeline nem comportamento no dispositivo. Compatibilidade de backups antigos, sem perder registos, preferências ou turnos. Nenhum segredo, recibo ou dado pessoal no GitHub. Teste de instalação/atualização no dispositivo e recuperação por backup. Não promover a Preview a versão estável até aprovação.

## Estabilização (Preview)
- Lembretes opcionais de pausa a hora fixa adicionados; notificações silenciosas, não substituem tacógrafo nem verificam regras legais.
- Corrigidas datas locais perto da meia-noite, reposição de aparência ao descartar alterações, retorno explícito em importações canceladas/inválidas, privacidade no PDF antigo e CSV, e proteção contra leitura de recibo fora do mês válido.
- 37 títulos/controlos principais traduzidos em francês, inglês, alemão, espanhol e luxemburguês; mensagens dinâmicas e restantes textos ainda por rever.
- Backup portátil encriptado continua dependente de sessão desbloqueada. Um serviço persistente exigirá desenho e validação próprios; não simular backup de dados atuais a partir de ficheiros antigos.
- 131 testes definidos. Verificações direcionadas em JavaScript executadas; execução integral do CI e APK continuam por confirmar. Não publicar release assinada antes de validar instalação/atualização e restauro num dispositivo real.

- Proteção da recuperação anterior à importação encriptada e botão de cópia local imediata. Verificações direcionadas da lógica com módulo criptográfico simulado aprovadas; novos testes com Web Crypto real adicionados ao CI, ainda sem confirmação integral. Mantém recuperação JSON antiga; não altera a proteção dos dados internos nem cria um serviço persistente em segundo plano.
