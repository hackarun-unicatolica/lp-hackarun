<div align="center">

<sub>**Português** · [English](README.en.md)</sub>

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="https://raw.githubusercontent.com/hackarun-unicatolica/lp-hackarun/main/docs/media/scroll-preview-poster.jpg" />
  <img src="docs/media/scroll-preview.webp" width="960" alt="Animação da rolagem da página do HackaRun: a cada seção, as partículas em 3D formam um objeto diferente (globo, cronômetro, ponto de interrogação, terreno, palco, troféu e galáxia) e, no fim, voltam a formar o globo atrás da chamada para a inscrição." />
</picture>

# HackaRun

**Desvende. Programe. Conquiste.**

Landing page do 1º HackaRun, evento de tecnologia, inovação e empreendedorismo da UniCatólica. O site apresenta o
evento, o regulamento, a programação, os mentores e os prêmios, e recebe a inscrição individual dos participantes, que
é gravada numa planilha do Google. Ao fundo, uma cena 3D em WebGL muda de forma a cada seção, acompanhando o scroll.

[![CI](https://github.com/hackarun-unicatolica/lp-hackarun/actions/workflows/ci.yml/badge.svg)](https://github.com/hackarun-unicatolica/lp-hackarun/actions/workflows/ci.yml)
![Astro](https://img.shields.io/badge/Astro-7-FF5D01?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strictest-3178C6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r186-049EF4?logo=threedotjs&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-3.15-88CE02?logo=greensock&logoColor=white)
[![Lighthouse mobile: performance 95, acessibilidade 100, boas práticas 100 e SEO 100](https://img.shields.io/badge/Lighthouse%20mobile-95%20%C2%B7%20100%20%C2%B7%20100%20%C2%B7%20100-0CCE6B?logo=lighthouse&logoColor=white)](#performance)

**[Ver o site → hackarun.com.br](https://hackarun.com.br)**

[Como contribuir](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

</div>

---

**Sumário:** [Visão geral](#visão-geral) · [Telas](#telas) · [Cenas 3D](#cenas-3d-por-seção) ·
[Tecnologias](#tecnologias) · [Arquitetura](#arquitetura) · [Performance](#performance) ·
[Acessibilidade](#acessibilidade) · [Segurança e LGPD](#segurança-e-lgpd) · [Como rodar](#como-rodar-no-seu-pc) ·
[Contribuindo](#contribuindo) · [Deploy](#deploy) · [Roadmap](#roadmap) · [Créditos](#créditos)

## Visão geral

- **O evento:** 1ª edição do HackaRun, de 11 a 14 de novembro de 2026, em Palmas-TO. A realização é da UniCatólica, a
  organização é da LAES (Liga Acadêmica de Engenharia de Software e Inteligência Artificial) e o Capim Dourado
  Shopping é o parceiro da premiação e o palco da final. São quatro dias: oficinas, abertura oficial, desenvolvimento
  e a grande final. O hackathon é aberto a estudantes da UniCatólica e de outras instituições, profissionais e
  entusiastas de tecnologia.
- **A inscrição:** é **individual**, de 19/10 a 08/11, e por enquanto não tem limite de vagas. As equipes (de 4
  pessoas, no máximo 5) são formadas num sorteio presencial, em 12/11.
- **O site:** página inicial com o evento, o regulamento (com o PDF para baixar), a programação em abas por dia, os
  mentores, a grande final, os prêmios, os patrocinadores e as perguntas frequentes; a página de inscrição
  (`/inscricao`); o cadastro de mentores (`/seja-mentor`); o aviso de privacidade (`/privacidade`); o modelo de autorização do responsável para menores de 18
  anos (`/autorizacao`); e a página das equipes (`/equipes`), que fica escondida até o sorteio.
- **Cena 3D:** sete objetos gerados por código aparecem na página (globo, cronômetro, ponto de interrogação, terreno,
  palco, troféu e galáxia), com 9 mil a 42 mil partículas. Não há modelos 3D nem vídeos. O pós-processamento (bloom,
  vinheta e aberração cromática) existe no código, mas está desligado para manter as partículas nítidas.
- **Desempenho:** Lighthouse mobile com 95 em Performance e 100 em Acessibilidade, Boas práticas e SEO
  (medição de 22/10/2026, detalhada em [Performance](#performance)).
- **Acessibilidade:** o conteúdo funciona sem JavaScript e sem WebGL, a página respeita `prefers-reduced-motion` e há
  um botão para pausar as animações.
- **Inscrições sem servidor próprio:** o formulário envia os dados para um Google Apps Script, que grava cada
  inscrição no Google Sheets (abas Inscritos, Equipes, Resumo, Mentores e Resumo Mentores).

## Telas

<p align="center">
  <img src="docs/media/sections-desktop.jpg" width="960" alt="Nove seções da página no desktop: o início, com o logo do HackaRun e a contagem regressiva; o evento, com o cronômetro; os NPCs, com o ponto de interrogação; o regulamento, com as regras da competição e os pesos da pontuação; a programação, com as abas por dia; os mentores; a final no Capim Dourado Shopping; os prêmios, com o troféu; e a chamada final para a inscrição, com o globo." />
  <br /><sub>Nove seções da página no desktop.</sub>
</p>

<p align="center">
  <img src="docs/media/mobile.jpg" width="960" alt="Cinco telas da versão para celular: o início com a contagem regressiva, os NPCs, o regulamento, a programação com as abas dos quatro dias e a chamada final para a inscrição." />
  <br /><sub>A mesma página no celular (390 px).</sub>
</p>

<p align="center">
  <img src="docs/media/teams-page.jpg" width="720" alt="A página de equipes no desktop: o menu com Voltar ao evento e Inscrição, o contador de seis equipes confirmadas, a busca por nome e seis cards, cada um com a logo e a quantidade de integrantes da equipe." />
  <br /><sub>Página <code>/equipes</code>, escondida até o sorteio. As equipes e as imagens desta captura são fictícias.</sub>
</p>

<p align="center">
  <img src="docs/media/registration.jpg" width="960" alt="A página de inscrição no desktop e no celular: o formulário individual, com nome completo, e-mail, WhatsApp, idade e perfil, e ao lado o status das inscrições, o que é preciso ter em mãos e as etapas." />
  <br /><sub>Página <code>/inscricao</code>, com dados fictícios e o envio simulado.</sub>
</p>

## Cenas 3D por seção

Cada seção da página tem uma cena (`data-scene`). Durante o scroll, as partículas passam de uma forma para a outra, e a
câmera acompanha a transição ([`FlightPath`](src/presentation/experience/camera/FlightPath.ts)). As formas são
geradas num Web Worker e usam a mesma ordem espacial (curva de Morton), o que deixa a troca entre uma forma e outra
contínua.

| Seção                    | Cena      | Objeto                                                      |
| ------------------------ | --------- | ----------------------------------------------------------- |
| Início (`#inicio`)       | `core`    | Globo formado por faixas de partículas                      |
| O evento (`#sobre`)      | `orbit`   | Cronômetro com mostrador, ponteiro e anéis                  |
| NPCs (`#npcs`)           | `enigma`  | Ponto de interrogação em 3D                                 |
| Regulamento              | `dust`    | Galáxia em espiral, como fundo para a leitura               |
| Programação e mentores   | `terrain` | Terreno em grade, com montanhas e sol                       |
| Grande final (`#final`)  | `stage`   | Palco com telão, estrutura e canhões de luz                 |
| Prêmios (`#premios`)     | `trophy`  | Troféu                                                      |
| Patrocinadores e FAQ     | `dust`    | Galáxia em espiral, como fundo para a leitura               |
| Inscrição (`#inscricao`) | `core`    | O globo de volta, girando devagar, com um pulso leve de luz |

A cena `map` (mapa das missões, com plataforma, rota em espiral e oito marcadores) continua no código e volta junto com
a seção de missões, que está escondida por enquanto.

A fonte Orbitron, usada nos títulos, teve o til redesenhado com fontTools: no arquivo original, "NÃO" parecia "NÀO" em
tamanhos grandes.

## Tecnologias

| Camada     | Tecnologias                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base       | [Astro 7](https://astro.build) (site estático), TypeScript 6 (strictest), Vite                                                                               |
| 3D         | [Three.js](https://threejs.org) r186, shaders GLSL próprios, EffectComposer, UnrealBloomPass e um passe de pós-processamento próprio (desligados por padrão) |
| Animação   | [GSAP](https://gsap.com) 3.15 (ScrollTrigger) e [Lenis](https://lenis.darkroom.engineering) 1.3                                                              |
| Estilo     | CSS (custom properties, cascade layers, `clamp()`, `content-visibility`) e design tokens                                                                     |
| Fontes     | Orbitron, Montserrat e JetBrains Mono, hospedadas no próprio site, só com os caracteres latinos                                                              |
| Imagens    | Otimização do Astro (`astro:assets`) para as logos e a imagem de compartilhamento, e CDN de imagens do Google para as insígnias das equipes                  |
| Backend    | Google Apps Script, Google Sheets (abas Inscritos, Equipes, Resumo, Mentores e Resumo Mentores) e Google Drive (insígnias das equipes)                       |
| Qualidade  | Vitest, ESLint, Prettier, Astro Check, Playwright e Lighthouse                                                                                               |
| Fluxo      | Husky, lint-staged, commitlint (Conventional Commits) e GitHub Actions                                                                                       |
| Hospedagem | Cloudflare Pages, com o domínio `hackarun.com.br` e o DNS na Cloudflare                                                                                      |

## Arquitetura

O código segue Clean Architecture, com DDD no domínio e MVVM na interface. As dependências sempre apontam para o
domínio, e o ESLint ([`eslint.config.js`](eslint.config.js)) acusa um import entre camadas que quebre essa regra.

```mermaid
flowchart TB
  subgraph PRES["Presentation"]
    SEC["Seções Astro"]
    MVVM["ViewModels e Views"]
    XP["Cena 3D"]
    MOT["Animações"]
  end
  subgraph APP["Application"]
    UC["Casos de uso"]
    PORTS["Portas"]
  end
  subgraph DOM["Domain"]
    ENT["Entidades e value objects"]
    REPO["Interfaces de repositório"]
  end
  subgraph INFRA["Infrastructure"]
    JSON["Repositórios JSON"]
    GAS["Gateway Apps Script"]
    ADP["Storage e relógio"]
  end
  COMP(["Composition roots"])

  COMP -- liga --> PRES
  COMP -- liga --> INFRA
  PRES --> APP
  APP --> DOM
  INFRA -. implementa .-> PORTS
  INFRA -. implementa .-> REPO
```

- **Domínio:** não importa outras camadas nem bibliotecas de interface (`three`, `gsap`, `lenis`, `astro`).
- **Aplicação:** depende só do domínio.
- **Apresentação:** usa as portas da aplicação e nunca importa a infraestrutura; os adapters são ligados em
  `src/composition`.
- **Shared** (`EventBus`, `Observable`, `Ticker`): usado pelas outras camadas e não importa nenhuma delas.

O domínio tem dois aggregates (`HackathonEvent` e `ParticipantRegistration`, a inscrição individual), value objects
como `FullName`, `StudentId`, `Email`, `Phone`, `ParticipantProfile`, `Slots` e `TimeSlot`, e o serviço
`RegistrationPolicy`, que define se as inscrições estão em breve, abertas, encerrando ou encerradas. Na interface, os ViewModels guardam o estado em `Observable` e não acessam o DOM; as Views só
fazem a ligação com a página. Os módulos se comunicam por um `EventBus` tipado
([`AppEvents.ts`](src/presentation/app/AppEvents.ts)).

O carregamento no navegador segue esta ordem, sem atrasar o primeiro conteúdo na tela:

```mermaid
flowchart TB
  P["Primeiro conteúdo na tela (PaintGate)"] --> B["BootQueue: animações, views e controladores"]
  B --> Z["Seção perto da tela (LazyMount): equipes e trilho das missões, quando visíveis"]
  B --> L(["load + navegador ocioso"])
  L --> X["Chunk do three.js"]
  L --> W["Formas no Web Worker"]
  L --> F["Contexto WebGL (FrameSettle)"]
  F --> S["Shaders em paralelo"]
  X --> S
  W --> R["Primeiro frame 3D"]
  S --> R
```

As páginas `/inscricao`, `/seja-mentor`, `/equipes`, `/privacidade` e `/autorizacao` usam um carregamento à parte
([`LightApp`](src/presentation/app/LightApp.ts)), sem 3D, GSAP e Lenis.

<details>
<summary><b>Padrões de projeto e onde estão</b></summary>

| Padrão                  | Onde                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy                | [`ShapeStrategy`](src/presentation/experience/shapes/ShapeStrategy.ts) (8 objetos no código), [`RenderPipeline`](src/presentation/experience/post/RenderPipeline.ts), `QualityProfile`, `ScrollDriver`            |
| Factory + registry      | [`ShapeFactory`](src/presentation/experience/shapes/ShapeFactory.ts), [`BoltFactory`](src/presentation/motion/animators/hero/lightning/BoltFactory.ts)                                                            |
| Registry                | [`AnimatorRegistry`](src/presentation/motion/animators/AnimatorRegistry.ts)                                                                                                                                       |
| Template Method         | [`SectionAnimator`](src/presentation/motion/animators/SectionAnimator.ts)                                                                                                                                         |
| Adapter                 | [`SmoothScroll`](src/presentation/motion/core/SmoothScroll.ts) (Lenis), [`AppsScriptRegistrationGateway`](src/infrastructure/registration/AppsScriptRegistrationGateway.ts)                                       |
| Decorator               | [`RetryingRegistrationGateway`](src/infrastructure/registration/RetryingRegistrationGateway.ts): 3 tentativas, com espera crescente entre elas                                                                    |
| Proxy com fallback      | [`FallbackTeamRepository`](src/infrastructure/repositories/FallbackTeamRepository.ts): lista ao vivo da planilha, com a lista do build como reserva                                                               |
| Null Object             | [`UnavailableRegistrationGateway`](src/infrastructure/registration/UnavailableRegistrationGateway.ts): sem endpoint, todo envio responde "encerrada"                                                              |
| Observer                | [`Observable`](src/shared/core/Observable.ts), [`EventBus`](src/shared/core/EventBus.ts)                                                                                                                          |
| Singleton               | [`Ticker.shared`](src/shared/core/Ticker.ts) (um único `requestAnimationFrame` no site), [`serverContainer()`](src/composition/server.ts)                                                                         |
| Facade                  | [`GetLandingPage`](src/application/use-cases/GetLandingPage.ts), [`ExperienceStage`](src/presentation/experience/ExperienceStage.ts)                                                                              |
| Composite               | [`strokes.ts`](src/presentation/experience/shapes/strokes.ts): uma forma é uma lista de traços                                                                                                                    |
| Builder                 | [`PointBrush`](src/presentation/experience/shapes/PointBrush.ts), [`BoltBuilder`](src/presentation/motion/animators/hero/lightning/BoltBuilder.ts), [`StageBuilder`](src/presentation/experience/StageBuilder.ts) |
| Repository + Mapper     | [`StaticListRepository`](src/infrastructure/repositories/StaticListRepository.ts), [`EventMapper`](src/infrastructure/mappers/EventMapper.ts)                                                                     |
| Inversão de dependência | [`BootSteps`](src/presentation/app/BootQueue.ts), a interface que o carregamento enxerga                                                                                                                          |

</details>

## Performance

Lighthouse mobile no site de produção, mediana de 5 execuções, com o script de [`scripts/qa/`](scripts/qa/README.md)
(Chrome com GPU, CPU 4x mais lenta e rede simulada de celular):

| Métrica                  | Antes das otimizações | 12/10/2026 | 22/10/2026 |
| ------------------------ | --------------------- | ---------- | ---------- |
| Performance              | 66                    | 98         | 95         |
| Total Blocking Time      | 1.600 ms              | 98 ms      | 169 ms     |
| Largest Contentful Paint | 2,9 s                 | 2,2 s      | 2,3 s      |
| Cumulative Layout Shift  | –                     | 0,001      | 0,001      |
| Acessibilidade           | 100                   | 100        | 100        |
| Boas práticas            | 100                   | 100        | 100        |
| SEO                      | 100                   | 100        | 100        |

As principais medidas:

- O HTML sai pronto do build, e o CSS crítico vai junto na página.
- O JavaScript da página só carrega depois que o primeiro conteúdo aparece na tela
  ([`PaintGate`](src/presentation/app/PaintGate.ts)), e a inicialização é dividida em passos curtos
  ([`BootQueue`](src/presentation/app/BootQueue.ts)).
- O three.js fica num arquivo separado, carregado depois do `load`. As formas são geradas num Web Worker, e os shaders
  são compilados em paralelo.
- A quantidade de partículas (9, 22 ou 42 mil) depende da placa de vídeo. Se a taxa de quadros ficar abaixo de 45 por
  alguns segundos, a qualidade cai sozinha: primeiro os efeitos, depois a resolução e por fim o nível de partículas.
- As seções longe do topo usam `content-visibility: auto`.
- As animações em CSS que repetem para sempre só mexem em `transform` e `opacity` e ficam pausadas quando a seção
  está longe da tela ([`OffscreenMotionController`](src/presentation/controllers/OffscreenMotionController.ts)), para
  não repintar a página inteira a cada quadro no celular.
- O 3D para quando a aba fica em segundo plano.

## Acessibilidade

A meta é a **WCAG 2.2 AA**.

- Link para pular ao conteúdo e foco sempre visível, inclusive no modo de alto contraste do Windows.
- Com `prefers-reduced-motion`, o scroll é nativo e as animações de entrada não acontecem.
- Botão **Pausar animações** no cabeçalho e no menu do celular, que congela o 3D e as animações em CSS.
- Programação em abas no padrão WAI-ARIA, navegável pelo teclado. Sem JavaScript, os quatro dias aparecem em sequência.
- Formulário com campos rotulados, resumo dos erros, `aria-invalid`, `aria-describedby` e avisos para leitores de
  tela.
- Todo o conteúdo funciona sem JavaScript e sem WebGL.

## Segurança e LGPD

- **Cabeçalhos de segurança** em [`public/_headers`](public/_headers): Content Security Policy sem script inline,
  `X-Frame-Options: DENY`, `nosniff` e Referrer-Policy.
- **Só os dados necessários:** nome completo, e-mail, WhatsApp, o perfil (curso, período, instituição, matrícula só
  quando a pessoa informa, e a área de interesse) e se tem 18 anos ou mais. Não há CPF, documentos, fotos nem dado
  sensível, e a data de nascimento não é pedida.
- **Controlador dos dados:** a LAES. O aviso de privacidade fica em [`/privacidade`](src/pages/privacidade.astro) e
  cada inscrição grava a versão do aviso aceita (hoje `2026-10-v5`) e a data do aceite. Quem tem menos de 18 anos
  entrega, no credenciamento, a autorização do responsável (modelo em `/autorizacao`).
- **Sem cookies de rastreamento.** A contagem de visitas é a Web Analytics da Cloudflare, que não usa cookies.
- **Uma inscrição por pessoa:** e-mail, WhatsApp e matrícula já usados são recusados, e um reenvio não gera uma linha
  nova na planilha.
- **Validação no servidor:** o Apps Script confere tudo de novo, com as mesmas regras do site (um teste compara os
  dois lados), e grava textos que começam com `=`, `+`, `-` ou `@` como texto, para evitar fórmula injetada.
- **Proteção contra spam:** campo isca, tempo mínimo de preenchimento e limite de envios.
- **Pouca informação pública:** a página de equipes, escondida até o sorteio, mostra o nome da equipe, a insígnia, a
  quantidade e o nome dos integrantes (para os competidores saberem com quem vão trabalhar), e só depois que a
  organização confirma. E-mail, WhatsApp e matrícula nunca aparecem no site.

## Qualidade

| Item           | Situação                                                                             |
| -------------- | ------------------------------------------------------------------------------------ |
| Testes         | Mais de mil testes (Vitest), por camada, com o código real do Apps Script rodando    |
| Lint e tipos   | ESLint sem erros e TypeScript no modo mais rígido, com Astro Check                   |
| Formatação     | Prettier em todo o repositório                                                       |
| CI             | GitHub Actions em todo push na `main` e em todo PR: lint, formatação, testes e build |
| Commits        | Conventional Commits, conferidos pelo commitlint                                     |
| Testes visuais | [`scripts/qa/`](scripts/qa/README.md): capturas, âncoras, overflow e Lighthouse      |

---

## Como rodar no seu PC

**1. Instale as ferramentas**

| Ferramenta      | Versão                | Uso                                              |
| --------------- | --------------------- | ------------------------------------------------ |
| Git             | recente               | Clonar o projeto e abrir PRs                     |
| Node.js         | 24 LTS (mínimo 22.18) | Rodar, testar e gerar o build                    |
| npm             | o que vem com o Node  | Dependências e scripts                           |
| Brave ou Chrome | atual                 | Opcional: scripts de testes visuais              |
| Python          | 3.11 ou mais novo     | Opcional: só para gerar de novo a fonte Orbitron |

A versão do Node usada na CI está no arquivo `.nvmrc`.

**2. Clone o projeto**

Quem é da equipe entra como colaborador e clona o repositório original. Assim, cada PR ganha uma prévia na
Cloudflare. O passo a passo está no [CONTRIBUTING.md](CONTRIBUTING.md#fluxo-de-trabalho-da-equipe).

```bash
git clone https://github.com/hackarun-unicatolica/lp-hackarun.git
cd lp-hackarun
```

Quem é de fora da equipe faz um fork no GitHub e clona o próprio fork.

**3. Prepare o projeto**

```bash
npm run setup
```

O comando confere a versão do Node, instala as dependências e cria o arquivo `.env` a partir do `.env.example`. Para
fazer à mão:

```bash
npm ci
cp .env.example .env
```

**4. Rode o site**

```bash
npm run dev
```

Abra `http://localhost:4321`. O formulário fica em `http://localhost:4321/inscricao`. No ambiente local, a inscrição
roda em **modo simulado**: nada é enviado e nenhuma planilha é alterada.

**5. Confira antes de abrir o PR**

```bash
npm run validate
npm run format:check
```

O `npm run validate` roda o lint, os testes e o build, como a CI.

**6. Testar o envio de verdade (opcional)**

Use uma planilha sua, nunca a oficial. Siga o [`apps-script/README.md`](apps-script/README.md) para criar o Apps
Script e publicá-lo como App da Web. Depois, coloque a URL que termina em `/exec` no seu `.env`, na variável
`PUBLIC_REGISTRATION_ENDPOINT`, e rode o `npm run dev` de novo. O `.env` não vai para o Git.

<details>
<summary><b>Problemas comuns</b></summary>

| Sintoma                                   | O que fazer                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| O `npm run setup` recusa a versão do Node | Instale o Node 24 LTS e abra um terminal novo. `node -v` mostra a versão em uso.                |
| `npm warn EBADENGINE` no `npm ci`         | É só um aviso. Atualizar o Node 24 para a última versão resolve.                                |
| A porta 4321 está ocupada                 | O Astro usa a próxima porta livre e mostra o endereço no terminal.                              |
| `&&` dá erro no PowerShell                | O Windows PowerShell 5.1 não aceita `&&`: rode um comando por linha.                            |
| O commit é recusado                       | Confira o formato `tipo(escopo): descrição` e os erros do ESLint. Não use `--no-verify`.        |
| Mudei o `.env` e nada mudou               | As variáveis são lidas na partida: pare o `npm run dev` e rode de novo.                         |
| O formulário volta preenchido             | É o rascunho salvo na aba. Use "Limpar rascunho" ou feche a aba.                                |
| O 3D não aparece                          | Confira se o navegador tem WebGL2 ou teste com `?quality=low`. Sem 3D, a página funciona igual. |

</details>

### Scripts

| Comando                           | Descrição                                                  |
| --------------------------------- | ---------------------------------------------------------- |
| `npm run setup`                   | Prepara o projeto: confere o Node, instala e cria o `.env` |
| `npm run dev`                     | Servidor de desenvolvimento em `http://localhost:4321`     |
| `npm run build`                   | Checagem de tipos e build de produção em `dist/`           |
| `npm run preview`                 | Serve o build localmente                                   |
| `npm test`                        | Testes                                                     |
| `npm run lint` / `lint:fix`       | ESLint / com correção automática                           |
| `npm run format` / `format:check` | Prettier: formata / confere                                |
| `npm run validate`                | Lint, testes e build                                       |

Os scripts de testes visuais ficam em [`scripts/qa/`](scripts/qa/README.md) e têm instalação própria
(`npm run setup -- --qa`).

### Estrutura do projeto

<details>
<summary><b>Pastas</b></summary>

```text
src/
├── domain/          # entidades, value objects, aggregates e interfaces de repositório
├── application/     # casos de uso, DTOs e portas
├── infrastructure/  # conteúdo em JSON, mappers, repositórios, Apps Script, imagem e storage
├── presentation/    # páginas, seções, componentes, view-models, views, animações e cena 3D
├── shared/          # EventBus, Observable, Ticker e utilitários
├── composition/     # onde as camadas são ligadas
├── assets/          # logos oficiais e a fonte Orbitron
└── pages/           # inicio, inscricao, seja-mentor, equipes, privacidade, autorizacao e 404
apps-script/         # código do Google Apps Script e o passo a passo de instalação
public/              # imagem de compartilhamento, favicon, regulamento em PDF e _headers
scripts/             # setup, ajuste da fonte e testes visuais (qa/)
tests/               # testes por camada
docs/                # guia do projeto, decisões de arquitetura (ADR) e as imagens deste README (media/)
```

</details>

### Conteúdo e inscrições

- **Conteúdo** (evento e programação, perguntas frequentes, prêmios, mentores, estações dos NPCs e parceiros) fica em
  `src/infrastructure/content/*.json`. Um dado inválido interrompe o build.
- **Inscrições** são **individuais**: cada pessoa informa nome completo, e-mail, WhatsApp, o perfil (curso, período,
  instituição e matrícula, conforme o caso) e a área de interesse. O Apps Script grava uma linha por pessoa na aba
  **Inscritos** e os totais na aba **Resumo**. Depois do sorteio de 12/11, a organização preenche a equipe de cada
  pessoa na própria planilha.
- **Equipes no site:** uma equipe aparece em `/equipes` quando a organização cria a equipe na aba **Equipes** e muda o
  Status para `confirmado`. Os detalhes estão no [`apps-script/README.md`](apps-script/README.md).
- **Mentores:** egressos e profissionais se cadastram em `/seja-mentor` (nome, contato, área de atuação, se é egresso
  e os dias do evento em que pode acompanhar as equipes, sempre presencial). O Apps Script grava na aba **Mentores** e nos totais da aba **Resumo
  Mentores**, separadas das inscrições. O cadastro tem o aviso de privacidade próprio (seção "Cadastro de mentores"
  de `/privacidade`).

## Contribuindo

O fluxo completo está no [CONTRIBUTING.md](CONTRIBUTING.md). Em resumo:

1. Crie uma branch a partir da `main`: `git switch -c feat/<assunto>` (ou `fix/`, `docs/`, `refactor/`).
2. Faça commits em **Conventional Commits**, em inglês, por exemplo `feat(sections): add day tabs to the schedule`. Os
   escopos aceitos estão no [`commitlint.config.js`](commitlint.config.js).
3. Rode `npm run validate` e `npm run format:check`.
4. Envie a branch e abra um Pull Request para a `main`. A CI precisa passar, a prévia da Cloudflare aparece no PR e um
   dos responsáveis ([CODEOWNERS](.github/CODEOWNERS)) aprova.
5. O merge é feito com **Squash and merge**, e o site oficial é atualizado em seguida.

## Deploy

O site está na **Cloudflare Pages**, no plano gratuito, em **[hackarun.com.br](https://hackarun.com.br)**. O DNS do
domínio fica na Cloudflare e o `www.hackarun.com.br` redireciona para o endereço principal. O `hackarun.pages.dev`
continua no ar, com o mesmo conteúdo e sem redirecionar, porque esse link já foi muito compartilhado; o endereço
canônico das duas versões aponta para `hackarun.com.br`, então os buscadores indexam só o domínio próprio.

- Cada merge na `main` publica uma nova versão em 1 a 2 minutos.
- Cada PR ganha um endereço de prévia, comentado pela Cloudflare no próprio PR. Na prévia, a inscrição é simulada e
  nada é gravado na planilha.
- As inscrições do site oficial estão ligadas pela variável `PUBLIC_REGISTRATION_ENDPOINT` (a URL do Apps Script) no
  ambiente de produção da Cloudflare. O endereço público do site vem de `PUBLIC_SITE_URL`; sem ela, vale o padrão do
  código, `https://hackarun.com.br`.

### Sorteio das equipes (`/sorteio`)

As telas `/sorteio` e `/sorteio/nomes` são da organização: fora do menu e do sitemap, com `noindex`, e só abrem com o
login. Quem confere o login é uma Cloudflare Pages Function (`functions/_middleware.ts`, lógica em
`src/server/sorteio`), que roda só nesses caminhos (`public/_routes.json`). Ela repassa as ações ao Apps Script
(`apps-script/Draw.gs`) com uma chave que nunca chega ao navegador. Sessão de 12 horas em cookie assinado; 10 senhas
erradas seguidas travam o login daquele IP por 15 minutos.

Em **Workers & Pages → hackarun → Settings → Variables and Secrets**, ambiente **Production**:

| Nome                   | Tipo   | Valor                                                                      |
| ---------------------- | ------ | -------------------------------------------------------------------------- |
| `SORTEIO_ATIVO`        | Text   | `sim` liga as telas; qualquer outro valor (ou sem a variável) dá 404       |
| `SORTEIO_USUARIO`      | Text   | login da organização                                                       |
| `SORTEIO_SENHA`        | Secret | senha da organização                                                       |
| `SORTEIO_TOKEN`        | Secret | chave longa (48 caracteres aleatórios), igual à propriedade do Apps Script |
| `SORTEIO_PLANILHA_URL` | Text   | opcional: URL `/exec` do Apps Script (sem ela, vale a da inscrição)        |

Variável nova ou alterada só vale depois de um novo deploy (**Deployments → … → Retry deployment**). Para testar no PC
sem a planilha real: `npm run build`, um `.dev.vars` com as variáveis acima apontando para a cópia de teste e
`npx wrangler pages dev dist`.

Para publicar um fork na sua própria conta: na Cloudflare, abra **Workers & Pages → Create application → Pages →
Connect to Git**, escolha o repositório e use o comando de build `npm run build` com a pasta de saída `dist`.

## Roadmap

- [x] Arquitetura, domínio e conteúdo oficial
- [x] Cena 3D guiada pelo scroll, com oito objetos
- [x] Segunda versão do design, com a identidade oficial do evento
- [x] Botão para pausar as animações
- [x] Programação oficial, com as duas frentes e as abas por dia
- [x] Publicação na Cloudflare Pages, com deploy automático e prévia em cada PR
- [x] Regulamento publicado, com o PDF para baixar
- [x] Inscrição individual em página própria, com a planilha organizada em três abas
- [x] Aviso de privacidade (LGPD) e modelo de autorização do responsável
- [x] Inscrições abertas (19/10), sem limite de vagas por enquanto
- [x] Domínio próprio, `hackarun.com.br`
- [ ] Sorteio das equipes (12/11) e página `/equipes` no ar
- [ ] Prêmios, mentores e banca, divulgados pela organização
- [ ] Evento, de 11 a 14 de novembro

## Créditos

- **Design da página e desenvolvimento:** [Marcos Vinicius Muniz Arruda](https://github.com/Marcos-Codfy)
- **Identidade visual:** Eduarda Victória (Liga Acadêmica)
- **Realização:** UniCatólica
- **Organização:** LAES · Liga Acadêmica de Engenharia de Software e Inteligência Artificial
- **Parceria:** Capim Dourado Shopping
- **Fontes:** Orbitron, Montserrat e JetBrains Mono (SIL Open Font License)

<sub>HackaRun, UniCatólica, LAES, Capim Dourado Shopping e os respectivos logos são marcas de seus titulares e aparecem
aqui apenas para identificar o evento.</sub>

---

<div align="center">

<sub>Design da página e desenvolvimento por <a href="https://github.com/Marcos-Codfy">Marcos Vinicius Muniz Arruda</a> ·
Palmas-TO · 2026</sub>

<!-- LINKEDIN: troque pelo link do perfil quando quiser exibi-lo aqui. -->

</div>
