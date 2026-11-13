# Inscrições do HackaRun na planilha (Google Apps Script)

O site é estático (Cloudflare Pages) e não tem servidor próprio. As inscrições vão para uma **planilha do Google**
por meio de um **Web App do Apps Script**, que é gratuito. A inscrição é **individual**: cada pessoa se inscreve
sozinha e as equipes são formadas no **sorteio presencial de 12/11**. O mesmo Web App informa ao site quantas vagas já
foram ocupadas e, depois do sorteio, publica a lista de **equipes confirmadas**.

```
site (formulário) --POST--------------> Web App --> aba "Inscritos" (1 linha por pessoa)
site (contador)   --GET ?action=slots--> vagas ocupadas (tudo que não está cancelado)
site (/equipes)   --GET ?action=teams--> equipes da aba "Equipes" com Status "confirmado":
                                         nome, número de integrantes e insígnia
```

## O que o script faz

- **Valida no servidor** com as mesmas regras do site (um teste compara os dois lados): nome completo, e-mail,
  WhatsApp com DDD (gravado como `(63) 99999-9999`), perfil, curso, período, instituição, matrícula, área, idade e
  consentimento na versão vigente do aviso de privacidade. Campos que não valem para o perfil escolhido são
  ignorados e ficam vazios.
- **Uma inscrição por pessoa:** e-mail, WhatsApp (comparado só pelos dígitos) e matrícula não se repetem entre as
  inscrições que não estão `cancelado`. O site recebe `duplicate_email`, `duplicate_whatsapp` ou
  `duplicate_student_id` e marca o campo certo.
- **Reenvio sem duplicar:** cada formulário manda uma chave de envio. A mesma chave com o mesmo e-mail recebe o mesmo
  protocolo (`HR26-XXXXXX`), pelo cache e, depois dele, pela coluna **Chave de envio**.
- **Prazo e vagas** conferidos a cada envio (propriedades `CLOSES_AT`, `CAPACITY` e `INSCRICOES_FECHADAS`).
- **Limites de envio:** até 10 tentativas a cada 10 minutos por e-mail e 120 envios por minuto no total. O
  `LockService` coloca as inscrições simultâneas em fila.
- **Proteção contra fórmula:** texto digitado que começa com `=`, `+`, `-` ou `@` é gravado como texto. As únicas
  fórmulas da planilha são as do próprio script.

## As três abas

O script cria e formata as abas sozinho (seção 4). Não crie abas nem títulos à mão e **não renomeie** abas nem
títulos de coluna: o script localiza tudo por esses nomes.

### Inscritos (aba azul-clara, a primeira)

Uma linha por pessoa. Título e as três primeiras colunas ficam congelados; há filtro em todas as colunas.

| Coluna                     | Conteúdo                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Protocolo                  | Código entregue à pessoa (`HR26-XXXXXX`)                                                                  |
| Data/hora                  | Momento da inscrição                                                                                      |
| Nome completo              |                                                                                                           |
| E-mail                     | Canal oficial de comunicação                                                                              |
| WhatsApp                   | `(63) 99999-9999`                                                                                         |
| Conversar                  | Link **Abrir WhatsApp**, montado a partir da coluna WhatsApp                                              |
| Perfil                     | Estuda na UniCatólica · Estuda em outra instituição · Já se formou · Trabalha ou estuda por conta própria |
| Instituição                | `UniCatólica`, a instituição informada (outra instituição) ou vazio                                       |
| Curso                      | Curso atual ou curso em que se formou (vazio para quem estuda por conta própria)                          |
| Período                    | `1º` a `10º` para quem estuda; vazio para os demais                                                       |
| Matrícula                  | Só UniCatólica, opcional (gravada como texto)                                                             |
| Área                       | Só para quem já se formou ou estuda por conta própria                                                     |
| 18 anos ou mais            | Sim ou Não                                                                                                |
| Autorização do responsável | `não precisa` (maiores) ou `pendente` (menores); menu `pendente` / `entregue` / `não precisa`             |
| Status                     | Menu `inscrito` / `credenciado` / `ausente` / `cancelado` (começa em `inscrito`)                          |
| Equipe                     | Preenchida pela organização no sorteio; menu com os nomes da aba Equipes                                  |
| Origem                     | De onde veio o envio                                                                                      |
| Consentimento              | Versão do aviso de privacidade aceito e data/hora (prova do aceite)                                       |
| Chave de envio             | Usada para reconhecer reenvios                                                                            |

Cores: `pendente` em âmbar e `entregue` em verde na autorização; cada Status tem sua cor e a linha `cancelado` fica
apagada.

### Equipes (aba azul)

Preparada para o dia do sorteio. As linhas 2 a 31 já vêm com fórmulas (30 equipes); enquanto a coluna Equipe estiver
vazia, a linha fica em branco.

| Coluna            | Conteúdo                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| Equipe            | Nome digitado pela organização (por exemplo, `Equipe Pikachu`)          |
| Insígnia          | Miniatura da imagem, a partir do **ID da insígnia**                     |
| Integrantes (qtd) | Quantas pessoas da aba Inscritos estão nesta equipe (sem as canceladas) |
| Integrantes       | Nomes, um por linha                                                     |
| E-mails           | Separados por `; `, prontos para o campo Cco                            |
| WhatsApps         | Separados por `, `                                                      |
| Status            | Menu `pendente` / `confirmado`. Só `confirmado` aparece no site         |
| ID da insígnia    | ID do arquivo no Drive (texto)                                          |
| Link da insígnia  | Abre a imagem no Drive                                                  |

Precisa de mais de 30 equipes? Escreva o nome na próxima linha livre e rode `configurarPlanilha`: as fórmulas são
estendidas até a última linha usada.

### Resumo (aba roxa)

Refeita a cada `configurarPlanilha`, protegida com aviso. Mostra: inscrições ativas, vagas (`CAPACITY`) e vagas
restantes, credenciados, ausentes, cancelados, credenciados ainda sem equipe, menores de 18 anos, autorizações
pendentes, contagem por perfil, contagem **por curso** e **por instituição**, as listas prontas para copiar (e-mails
das inscrições ativas, e-mails dos credenciados, WhatsApps das inscrições ativas) e um passo a passo de uso.

## 1. Criar (ou abrir) a planilha

1. Entre no Google Drive com a **conta da organização** (não use conta pessoal: ela passa a ser a dona dos dados).
2. Crie uma planilha nova, por exemplo **HackaRun 2026 · Inscrições**, ou abra a que já existe.
3. Em planilha nova, a primeira aba vazia (`Página1` ou `Sheet1`) vira a aba **Inscritos**.

## 2. Colar o código

1. Na planilha, abra **Extensões > Apps Script**. O projeto aberto fica ligado a esta planilha.
2. Apague o conteúdo do `Código.gs` e cole o de [`Code.gs`](./Code.gs).
3. Para cada arquivo abaixo, clique em **+ > Script**, digite o nome (sem o `.gs`) e cole o conteúdo. Se o arquivo
   já existir, substitua todo o conteúdo.

   | Arquivo      | Função                                                                      |
   | ------------ | --------------------------------------------------------------------------- |
   | `Validation` | Regras do servidor (iguais às do site), consentimento e proteção de fórmula |
   | `Limits`     | Prazo, capacidade, vagas ocupadas e limite de envios                        |
   | `Images`     | Pasta das insígnias no Drive e conferência do ID da insígnia                |
   | `Sheets`     | Colunas das abas, gravação de cada inscrição e fórmulas                     |
   | `Registry`   | E-mails, WhatsApps e matrículas já inscritos                                |
   | `Setup`      | `configurarPlanilha()`: cria e formata as abas                              |
   | `Summary`    | Aba Resumo                                                                  |
   | `Mentors`    | Cadastro de mentores: abas Mentores e Resumo Mentores (seção 8)             |
   | `Draw`       | Sorteio das equipes pelo site (`/sorteio`): aba Sorteio (seção 7)           |
   | `Feedback`   | Avaliação entre colegas (`/feedback`) e painel da organização               |
   | `Gems`       | Questões dos NPCs das gemas (`/gemas`): aba Questões (seção 9)              |

4. Em **Configurações do projeto** (engrenagem), marque **Mostrar arquivo de manifesto "appsscript.json" no
   editor**. Volte ao editor e substitua o conteúdo do `appsscript.json` pelo de [`appsscript.json`](./appsscript.json)
   (fuso `America/Araguaina`, runtime V8 e os escopos mínimos: esta planilha e o Drive, para a pasta das insígnias).
5. Salve (Ctrl+S). O editor não pode indicar erro.

## 3. Propriedades do script

Em **Configurações do projeto > Propriedades do script > Adicionar propriedade do script**, crie as propriedades
abaixo e clique em **Salvar propriedades do script**:

| Propriedade           | Valor atual                       | Função                                                                                                                                                                                                                         |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CAPACITY`            | `75`                              | Máximo de inscritos (pessoas). Conta tudo que não está `cancelado`                                                                                                                                                             |
| `CLOSES_AT`           | `2026-11-08T23:59:00-03:00`       | Prazo final, em data ISO **com hora e fuso** (`-03:00` é o horário de Palmas)                                                                                                                                                  |
| `INSCRICOES_FECHADAS` | (vazio)                           | `sim` fecha na hora, sem alterar o site. Para reabrir, apague ou use `nao`                                                                                                                                                     |
| `FOTOS_PASTA_ID`      | (criada sozinha)                  | Pasta do Drive das insígnias (o final da URL da pasta)                                                                                                                                                                         |
| `ID_SEGREDO`          | (criada sozinha)                  | Segredo dos ids públicos das equipes. Não apague nem compartilhe                                                                                                                                                               |
| `PLANILHA_VERSAO`     | (criada sozinha)                  | Versão do layout aplicado (hoje `7`)                                                                                                                                                                                           |
| `SORTEIO_TOKEN`       | (criada pelo `gerarChaveSorteio`) | Chave do sorteio pelo site: rode `gerarChaveSorteio` no editor e copie a chave do registro de execução para o segredo `SORTEIO_TOKEN` da Cloudflare. Sem ela (ou com menos de 24 caracteres), o sorteio pelo site não responde |

- Valor inválido em `CLOSES_AT` ou `CAPACITY` **fecha** as inscrições e registra o erro no log.
- Mantenha `CLOSES_AT` e `CAPACITY` iguais ao bloco `registration` do `src/infrastructure/content/event.json`.
- Sem `FOTOS_PASTA_ID`, o script cria a pasta `HackaRun 2026 · Insígnias das equipes` no Drive de quem publica.

## 4. Montar a planilha e autorizar

1. No editor, abra o arquivo `Setup`, escolha a função **`configurarPlanilha`** e clique em **Executar**.
2. Autorize com a conta da organização. No aviso **"O Google não verificou este app"**, clique em **Avançado >
   Acessar ... (não seguro)** e em **Permitir**. As permissões pedidas são só **esta planilha** e o **Drive**.
3. O **Registro de execução** mostra as abas criadas e o endereço da pasta das insígnias.
4. Na primeira insígnia, a planilha pode exibir a faixa **"algumas fórmulas estão tentando enviar e receber dados de
   terceiros"**: clique em **Permitir acesso** (é o `=IMAGE()` buscando a miniatura). Basta uma vez.

`configurarPlanilha` pode ser executada novamente a qualquer momento (por exemplo, depois de alterar `CAPACITY`):
não apaga dados nem duplica filtro, faixa, proteção ou regra de cor, e refaz as fórmulas. As fórmulas são gravadas no
idioma da planilha (em português o separador de argumentos é `;`).

### Vindo da inscrição por equipe (layout 6)

Se a planilha já tem as abas **Equipes** e **Integrantes** da inscrição por equipe (o primeiro título é
`Protocolo`), o script **não apaga nada**: elas passam a se chamar **Equipes (inscrição antiga)** e **Integrantes
(inscrição antiga)**, com os dados e as fórmulas intactos, e as abas novas são criadas ao lado. O Resumo é refeito
para as abas novas. Se esquecer de rodar `configurarPlanilha`, a primeira inscrição faz a migração sozinha.

Ordem recomendada: crie `INSCRICOES_FECHADAS=sim`, cole os arquivos, publique a nova versão (seção 6), rode
`configurarPlanilha` e então apague `INSCRICOES_FECHADAS`. Depois de migrar, não volte para uma implantação antiga.

## 5. Publicar como Web App (primeira vez)

1. **Implantar > Nova implantação** > tipo **App da Web**.
2. **Executar como:** _Eu (conta da organização)_. **Quem pode acessar:** _Qualquer pessoa_.
3. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
4. Confira no navegador:
   - `URL?action=health` responde `{"ok":true,"open":true}`;
   - `URL?action=slots` responde `{"ok":true,"open":true,"capacity":75,"taken":0}`;
   - `URL?action=teams` responde `{"ok":true,"teams":[]}`.
5. No Cloudflare Pages, em **Settings > Variables and Secrets**, ambiente **Production**, defina
   `PUBLIC_REGISTRATION_ENDPOINT` com essa URL e refaça o deploy de produção.

## 6. Publicar uma nova versão (código alterado)

1. Cole os arquivos alterados e salve.
2. **Implantar > Gerenciar implantações** > selecione a implantação ativa > **Editar** (lápis) > **Versão: Nova
   versão** > **Implantar**. A URL continua a mesma.
3. **Não** use "Nova implantação" para atualizar: ela gera outra URL e o site deixa de enviar.
4. Mudou `CONSENT_VERSION`, colunas ou regras? Publique o script **junto com o deploy do site**. Hoje a versão do
   aviso é `2026-10-v5` (o script também aceita a `2026-10-v4` durante a troca; `Validation.gs` e `src/application/use-cases/SubmitRegistration.ts`; um teste confere).

## 7. Rotina da organização

### Até o evento

- Acompanhe a aba **Resumo** (inscrições ativas, vagas restantes, menores de idade).
- **Cancelar uma inscrição:** Status `cancelado`. A vaga, o e-mail, o WhatsApp e a matrícula ficam livres para uma
  nova inscrição, e o contador do site é atualizado na hora.
- **Mandar mensagem:** copie, no Resumo, a célula de e-mails e cole no campo **Cco** do e-mail. A coluna
  **Conversar** abre o WhatsApp de cada pessoa.

### Credenciamento

1. Localize a pessoa na aba **Inscritos** (filtro ou Ctrl+F pelo nome).
2. Troque o Status para `credenciado`. Quem não comparecer fica como `ausente`.
3. **Menores de 18 anos:** confira a autorização do responsável e troque `pendente` por `entregue`.

### Sorteio das equipes (12/11), pelo site

O sorteio é feito em `hackarun.com.br/sorteio`, com o login da organização (passo a passo de ligar no README do
projeto, seção Deploy). O site forma as equipes com quem está `credenciado` e grava tudo sozinho:

1. **Tela 1 (Equipes):** "Sortear equipes" forma as equipes (4 pessoas, a sobra vira 5º integrante) e grava na hora:
   coluna **Equipe** da aba Inscritos, uma linha `pendente` por equipe na aba **Equipes** e o registro na aba
   **Sorteio** (número, nome, Pokémon, semente e repetições de nível). Sortear de novo substitui o sorteio anterior,
   enquanto nenhuma equipe tiver nome.
2. **Tela 2 (Nomes):** "Sortear todas" dá um Pokémon (e o nome `Equipe <Pokémon>`) a cada equipe, sem repetir, e troca
   o nome nas três abas. A partir daqui as equipes não podem mais ser refeitas pelo site.
3. **Publicar no site:** com todos os nomes, o botão confirma as equipes (Status `confirmado`). Em até 1 minuto elas
   aparecem em `/equipes`, com o nome, a arte do Pokémon e o número de integrantes.

A chave `SORTEIO_TOKEN` pode ser apagada depois do sorteio: o site para de ler e gravar a planilha na hora.

### Sorteio das equipes à mão (plano B)

1. Na aba **Equipes**, escreva o nome de cada equipe na coluna **Equipe** (por exemplo, `Equipe Pikachu`).
2. Na aba **Inscritos**, escolha a **Equipe** de cada pessoa credenciada no menu da coluna. Só aparecem os nomes
   escritos na aba Equipes. Integrantes, quantidade, e-mails e WhatsApps são preenchidos sozinhos na aba Equipes.
3. **Insígnia:** suba a imagem (JPG, PNG ou WebP) na pasta das insígnias, compartilhe como **Qualquer pessoa com o
   link · Leitor**, copie o ID do link (`.../file/d/<ID>/view`) e cole na coluna **ID da insígnia**.
4. **Publicar no site:** troque o Status da equipe para `confirmado`. Em até 1 minuto ela aparece em `/equipes`,
   com nome, insígnia, número e nome dos integrantes. E-mails, telefones e matrículas nunca saem da planilha.
5. O Resumo mostra quantos credenciados ainda estão sem equipe.

Renomear uma equipe depois de publicada muda o identificador dela no site; corrigir maiúsculas ou acentos não muda.

## 8. Cadastro de mentores (página `/seja-mentor`)

O cadastro de mentores é **independente das inscrições**: tem as próprias abas e a própria versão de montagem, e
não mexe em **Inscritos**, **Equipes** nem **Resumo** (um teste compara essas abas antes e depois de vários
cadastros). A única mudança fora do `Mentors.gs` é uma linha no `doPost` do `Code.gs`
(`if (body.action === 'register-mentor') return registerMentor_(body);`).

- **Instalar:** cole o `Mentors.gs` (novo arquivo, nome `Mentors`) e o `Code.gs` atualizado, salve e publique
  **uma nova versão** (seção 6). As abas **Mentores** (verde-âmbar) e **Resumo Mentores** nascem no primeiro
  cadastro; para criá-las antes, rode `configurarMentores()` no editor. Pode rodar de novo: não apaga cadastro.
- **Aba Mentores:** uma linha por pessoa (protocolo `MT26-XXXXXX`), com nome, contato, área (e, para "Outra",
  a área que a pessoa escreveu), especialidades, perfil público, se é egresso (curso e ano), os dias do evento em que
  pode acompanhar as equipes (sempre presencial) e se pode divulgar o nome. A organização cuida das colunas **Status** (`novo`, `contatado`, `confirmado`, `recusado`,
  `cancelado`), **Equipe(s) atendida(s)** e **Anotações**. Cadastro `cancelado` libera o e-mail e o WhatsApp.
- **Aba Resumo Mentores:** contadores ao vivo, listas prontas para copiar (e-mails e WhatsApps dos confirmados) e o
  passo a passo da organização, tudo lendo a aba Mentores.
- **Dias:** o site oferece 12, 13 e 14/11 (o 11/11 é só de oficinas), mas o script aceita todos os dias do evento
  (11 a 14/11). Se a coordenação pedir outro dia, mude só o site (`MENTOR_DAYS` em
  `src/domain/value-objects/MentorProfile.ts` e a lista em `src/presentation/formatters/MentorLabels.ts`): a planilha
  não precisa ser tocada nem republicada.
- **Regras:** e-mail e WhatsApp não se repetem entre mentores ativos (a mesma pessoa pode ser participante e
  mentora); reenvio com a mesma chave devolve o mesmo protocolo; mesmos limites de envio das inscrições.
- **Consentimento:** versão `2026-10-m1` (seção "Cadastro de mentores" de `/privacidade`), gravada na coluna
  **Consentimento**. Mudou o texto, suba a versão no `Mentors.gs` e no site.
- **Fechar o cadastro:** crie a propriedade `MENTORES_FECHADOS` com o valor `sim` (apague para reabrir). Não afeta as
  inscrições.

## 9. Gemas dos NPCs (página `/gemas`)

Tela da organização, com o mesmo login do sorteio. Cada NPC escolhe a sua cor e sorteia só as questões da palestra
correspondente: azul (Git e GitHub), amarelo (destravando ideias com IA) e vermelho (Design Thinking e Scrum). Quem
acerta recebe a ficha física da cor; a tela não registra equipe.

- **Aba Questões:** colunas `Cor` (`azul`, `amarelo` ou `vermelho`), `Nº`, `Pergunta`, `A`, `B`, `C`, `D` e
  `Resposta` (a letra). Linha incompleta fica de fora. As questões e o gabarito ficam só na planilha, nunca no
  repositório.
- **Fila sem repetição:** a questão sorteada vai para o fim da fila da cor e só volta depois que todas as outras
  saírem. O sorteio acontece no aparelho do NPC (sem esperar a internet) e a fila é copiada nas propriedades do script
  (`GEMAS_FILA_AZUL`, `GEMAS_FILA_AMARELO`, `GEMAS_FILA_VERMELHO`). Sem internet, o aparelho guarda a fila e envia
  quando a conexão voltar.
- **Recomeçar a fila de uma cor:** apague a propriedade da cor e limpe os dados do navegador do aparelho daquele NPC.

## Testes

Os testes executam os `.gs` reais no Node, com dublês dos serviços do Google (planilha, fórmulas, filtros, cache,
lock, propriedades e Drive), e comparam as regras com as do domínio do site:

```
npx vitest run tests/infrastructure/apps-script
```

## Cotas do plano gratuito

| Recurso               | Limite aproximado                                       |
| --------------------- | ------------------------------------------------------- |
| Tempo por execução    | 6 min (cada inscrição leva cerca de 1 s)                |
| Execuções simultâneas | 30 (o lock coloca o restante na fila)                   |
| Gatilhos (`onEdit`)   | 90 min por dia no total; cada edição leva milissegundos |
| Planilha              | 10 milhões de células                                   |

## LGPD

- O aviso de privacidade fica em `/privacidade`. Cada linha guarda a prova do aceite na coluna **Consentimento**;
  sem ela o script recusa a inscrição.
- Dados guardados por pessoa: nome, e-mail, WhatsApp, perfil, instituição, curso, período, matrícula (opcional), área
  e se tem 18 anos ou mais. Nada de dado sensível.
- Compartilhe a planilha **só** com a organização e nunca com "qualquer pessoa com o link". Só as insígnias são
  públicas.
- **Retenção:** até 6 meses depois do evento; depois, apague a planilha ou anonimize o que for necessário para
  estatística.
- Pedidos de acesso, correção ou exclusão: localize pelo protocolo ou pelo e-mail na aba **Inscritos** e atenda em
  até 15 dias. Lembre-se das abas **(inscrição antiga)**, se existirem.
