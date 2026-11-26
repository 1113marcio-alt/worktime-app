# Android: assinatura permanente do WorkTime Pro 2 Preview

**Estado:** o workflow suporta uma chave fixa, mas só a usará depois de adicionares quatro segredos ao repositório no GitHub. Nunca envies senhas, chaves ou o ficheiro keystore pelo ChatGPT, por mensagens ou num commit.

## Por que é necessária?

O GitHub Actions gerava cada APK de teste com uma chave de depuração temporária. O Android recusa atualizar uma aplicação com o mesmo ID se a assinatura mudar. Uma chave tua, reutilizada em cada compilação, permite instalar atualizações sucessivas **da Preview assinada** sem desinstalar.

**Limitação inevitável:** a Preview que já está instalada foi assinada com uma chave de DEBUG diferente. O primeiro APK com a tua nova chave **não poderá atualizar diretamente** essa instalação. Depois de guardar e verificar um backup JSON completo, será necessário desinstalar **apenas a Preview** uma única vez, instalar a primeira versão assinada e importar o backup. A aplicação original permanece intocada. **Não desinstalar antes de confirmar o backup.** Os APKs seguintes, assinados pela mesma chave, poderão atualizar a Preview.

## 1. Criar a chave num ambiente sob teu controlo

Num computador (ou Codespace privado com Java instalado), abrir o terminal e executar:

~~~bash
keytool -genkeypair -v \
  -keystore worktime-preview-release.jks \
  -storetype PKCS12 \
  -alias worktime-preview \
  -keyalg RSA -keysize 3072 -validity 10000
~~~

O keytool pede-te uma senha e as informações do certificado. Não coloques a senha no comando ou no histórico do terminal. Se o formato PKCS12 utilizar a mesma senha para a chave e para o armazém, usa-a nos dois segredos de palavra-passe.

Guarda **duas cópias seguras** do ficheiro .jks e das senhas fora do repositório. Perder a chave obriga a instalar novamente a aplicação e pode implicar perda de dados sem backup. Não coloques o ficheiro .jks em git, Issues, artefactos Actions ou pastas partilhadas públicas.

## 2. Criar os quatro segredos GitHub

Em https://github.com/1113marcio-alt/worktime-app/settings/secrets/actions escolhe **New repository secret**, um de cada vez:

| Nome exato | Valor |
|---|---|
| WORKTIME_PREVIEW_KEYSTORE_B64 | Conteúdo Base64 de todo o ficheiro .jks |
| WORKTIME_PREVIEW_STORE_PASSWORD | Palavra-passe do ficheiro .jks |
| WORKTIME_PREVIEW_KEY_ALIAS | worktime-preview |
| WORKTIME_PREVIEW_KEY_PASSWORD | Palavra-passe da chave |

Para criar Base64 sem publicar o ficheiro:

~~~bash
python3 -c "import base64;print(base64.b64encode(open('worktime-preview-release.jks','rb').read()).decode())"
~~~

Copia a saída **apenas** para o segredo privado correspondente no GitHub. Nunca a coloques no chat ou num ficheiro versionado.

## 3. Compilar

Em **Actions → Build Android APK**, seleciona **Run workflow**, escolhe a branch worktime-pro-2 e inicia a execução.

- Se os quatro segredos existirem, o ficheiro será WorkTime-Pro-2-PREVIEW-SIGNED.apk: chave permanente, adequada a futuras atualizações da Preview.
- Se os segredos faltarem, será WorkTime-Pro-2-PREVIEW-DEBUG.apk: apenas para testes e **não garante atualização**.
- O workflow **nunca** publica o ficheiro .jks nem qualquer senha como artefacto.

Após a primeira instalação da versão assinada, mantém **a mesma chave, alias e senhas** para todas as versões futuras. Protege as permissões de escrita na branch: pessoas que podem alterar workflows podem tentar aceder a segredos usados nesses workflows.

## 4. Verificar a assinatura sem expor a chave

Se tiveres Android SDK Build Tools instalado:

~~~bash
apksigner verify --print-certs WorkTime-Pro-2-PREVIEW-SIGNED.apk
~~~

Compara a impressão digital SHA-256 de duas versões sucessivas. Devem ser iguais. Isto é diferente do SHA-256 do ficheiro APK, que muda entre versões.

## Preservação dos dados

O identificador Android da Preview mantém-se lu.marcio.worktimepro.preview. O identificador da app original lu.marcio.worktimepro e a branch main não são alterados por este processo.

O backup JSON deverá incluir settings, entries, activeShift e shiftDrafts. Guarda-o fora da aplicação e confirma que podes abrir o ficheiro antes de qualquer reinstalação.

## WorkTime Pro 3 Preview — canal de atualização

A branch `worktime-pro-2` mantém o pacote Android `lu.marcio.worktimepro.preview`. A partir da fase 5, o código de versão é 100000 + GITHUB_RUN_NUMBER e o nome é 3.0-preview.N, tanto em DEBUG como na versão assinada. Os nomes de artefactos Actions antigos são mantidos por compatibilidade.

Por defeito, as compilações apenas disponibilizam o artefacto Actions; não publicam releases. Depois de confirmar os testes, a assinatura permanente e o funcionamento no teu Android:

1. Abre Actions → Build Android APK → Run workflow.
2. Seleciona a branch worktime-pro-2 e ativa a opção `publish_preview` (publicação pública opcional no repositório).
3. A publicação só ocorre se a compilação terminar com sucesso e existir o APK assinado, verificado por apksigner. É publicada como pré-release com tag `worktime-preview-v3-N` e o ficheiro `WorkTime-Pro-3-PREVIEW-SIGNED.apk`.
4. Na app, Opções → Segurança → Atualizações da aplicação → Procurar atualizações. A consulta é manual e usa os metadados públicos das últimas 30 releases GitHub. Não envia registos, credenciais ou recibos. Se encontrar uma versão superior do canal Preview, abre a página oficial no navegador para descarregar.
5. Guarda um backup externo, confirma a assinatura e instala pelo Android. Não desinstales para contornar um conflito de assinatura. Se a instalação atual for DEBUG, a primeira migração para uma chave permanente pode exigir reinstalação e recuperação do backup.

A app não instala automaticamente nem contorna as verificações do Android. O SHA-256 da release, quando publicado, é metadado indicativo; não é uma verificação efetuada ao ficheiro descarregado pela app. Não foram publicados APKs nem configuradas chaves pela implementação desta funcionalidade.
