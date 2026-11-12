<div align="center">

<sub>[Português](README.md) · **English**</sub>

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="https://raw.githubusercontent.com/hackarun-unicatolica/lp-hackarun/main/docs/media/scroll-preview-poster.jpg" />
  <img src="docs/media/scroll-preview.webp" width="960" alt="Animation of the HackaRun page scroll: at each section the 3D particles form a different object (globe, stopwatch, question mark, terrain, stage, trophy and galaxy) and, at the end, they form the globe again behind the registration call to action." />
</picture>

# HackaRun

**Desvende. Programe. Conquiste.** <sub>(Uncover. Code. Conquer.)</sub>

Landing page for the 1st HackaRun, UniCatólica's technology, innovation and entrepreneurship event. The site
presents the event, the rules, the schedule, the mentors and the prizes, and takes individual registrations, which are
saved to a Google Sheet. In the background, a WebGL 3D scene changes shape at each section as the page scrolls.

[![CI](https://github.com/hackarun-unicatolica/lp-hackarun/actions/workflows/ci.yml/badge.svg)](https://github.com/hackarun-unicatolica/lp-hackarun/actions/workflows/ci.yml)
![Astro](https://img.shields.io/badge/Astro-7-FF5D01?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strictest-3178C6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r186-049EF4?logo=threedotjs&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-3.15-88CE02?logo=greensock&logoColor=white)
[![Lighthouse mobile: performance 95, accessibility 100, best practices 100 and SEO 100](https://img.shields.io/badge/Lighthouse%20mobile-95%20%C2%B7%20100%20%C2%B7%20100%20%C2%B7%20100-0CCE6B?logo=lighthouse&logoColor=white)](#performance)

**[See the site → hackarun.com.br](https://hackarun.com.br)**

[Contributing (pt-BR)](CONTRIBUTING.md) · [Changelog (pt-BR)](CHANGELOG.md)

</div>

---

**Contents:** [Overview](#overview) · [Screens](#screens) · [3D scenes](#3d-scenes-by-section) ·
[Stack](#stack) · [Architecture](#architecture) · [Performance](#performance) · [Accessibility](#accessibility) ·
[Security and LGPD](#security-and-lgpd) · [Running locally](#running-it-locally) · [Contributing](#contributing) ·
[Deploy](#deploy) · [Roadmap](#roadmap) · [Credits](#credits)

## Overview

- **The event:** the 1st HackaRun, from November 11 to 14, 2026, in Palmas, Tocantins, Brazil. It is held by
  UniCatólica, organized by LAES (the university's Software Engineering and Artificial Intelligence student league),
  and Capim Dourado Shopping is the awards partner and hosts the final. It runs for four days: workshops, the official
  opening, development and the grand final. The hackathon is open to students from UniCatólica and other institutions,
  professionals and technology enthusiasts.
- **Registration:** it is **individual**, from October 19 to November 8, and has no cap on spots for now. Teams (4
  people, 5 at most) are formed in an in-person draw on November 12.
- **The site:** a home page with the event, the rules (with the PDF to download), the schedule in tabs by day, the
  mentors, the grand final, the prizes, the sponsors and the FAQ; the registration page (`/inscricao`); the mentor sign-up page (`/seja-mentor`); the privacy
  notice (`/privacidade`); the guardian authorization form for people under 18 (`/autorizacao`); and the teams page
  (`/equipes`), which stays hidden until the draw.
- **3D scene:** seven objects generated in code appear on the page (globe, stopwatch, question mark, terrain, stage,
  trophy and galaxy), with 9,000 to 42,000 particles. There are no 3D models or videos. Post-processing (bloom,
  vignette and chromatic aberration) exists in the code but is switched off to keep the particles sharp.
- **Performance:** Lighthouse mobile scores 95 for Performance and 100 for Accessibility, Best Practices and
  SEO (measured on 10/22/2026, detailed in [Performance](#performance)).
- **Accessibility:** the content works without JavaScript or WebGL, the page respects `prefers-reduced-motion`, and a
  button pauses the animations.
- **Registration without a server of its own:** the form sends the data to a Google Apps Script, which saves each
  registration to Google Sheets (Inscritos, Equipes, Resumo, Mentores and Resumo Mentores tabs).

## Screens

The site is in Portuguese.

<p align="center">
  <img src="docs/media/sections-desktop.jpg" width="960" alt="Nine sections of the page on desktop: the hero, with the HackaRun logo and the countdown; the event, with the stopwatch; the NPCs, with the question mark; the rules, with the competition rules and the scoring weights; the schedule, with the day tabs; the mentors; the final at Capim Dourado Shopping; the prizes, with the trophy; and the closing registration call to action, with the globe." />
  <br /><sub>Nine sections of the page on desktop.</sub>
</p>

<p align="center">
  <img src="docs/media/mobile.jpg" width="960" alt="Five screens of the mobile version: the hero with the countdown, the NPCs, the rules, the schedule with the tabs for the four days and the closing registration call to action." />
  <br /><sub>The same page on a phone (390 px).</sub>
</p>

<p align="center">
  <img src="docs/media/teams-page.jpg" width="720" alt="The teams page on desktop: the menu with Back to the event and Registration, the counter of six confirmed teams, the search by name and six cards, each with the team's logo and number of members." />
  <br /><sub>The <code>/equipes</code> page, hidden until the draw. The teams and images in this screenshot are fictional.</sub>
</p>

<p align="center">
  <img src="docs/media/registration.jpg" width="960" alt="The registration page on desktop and on a phone: the individual form, with full name, e-mail, WhatsApp, age and profile, and beside it the registration status, what to have at hand and the steps." />
  <br /><sub>The <code>/inscricao</code> page, with fictional data and simulated submission.</sub>
</p>

## 3D scenes by section

Each section of the page has a scene (`data-scene`). While scrolling, the particles move from one shape to the next,
and the camera follows the transition ([`FlightPath`](src/presentation/experience/camera/FlightPath.ts)). The shapes
are generated in a Web Worker and share the same spatial order (a Morton curve), which keeps the change from one shape
to another continuous.

| Section                     | Scene     | Object                                                   |
| --------------------------- | --------- | -------------------------------------------------------- |
| Hero (`#inicio`)            | `core`    | Globe made of particle bands                             |
| The event (`#sobre`)        | `orbit`   | Stopwatch with dial, hand and rings                      |
| NPCs (`#npcs`)              | `enigma`  | 3D question mark                                         |
| Rules                       | `dust`    | Spiral galaxy, as a background for reading               |
| Schedule and mentors        | `terrain` | Grid terrain with mountains and a sun                    |
| Final (`#final`)            | `stage`   | Stage with an LED wall, truss and light beams            |
| Prizes (`#premios`)         | `trophy`  | Trophy                                                   |
| Sponsors and FAQ            | `dust`    | Spiral galaxy, as a background for reading               |
| Registration (`#inscricao`) | `core`    | The globe again, turning slowly, with a soft light pulse |

The `map` scene (the mission map, with a platform, a spiral route and eight markers) is still in the code and comes
back with the missions section, which is hidden for now.

The tilde of the Orbitron font, used in the headings, was redrawn with fontTools: in the original file, "NÃO" looked
like "NÀO" at large sizes.

## Stack

| Layer     | Technologies                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Base      | [Astro 7](https://astro.build) (static site), TypeScript 6 (strictest), Vite                                                                  |
| 3D        | [Three.js](https://threejs.org) r186, custom GLSL shaders, EffectComposer, UnrealBloomPass and a custom post-processing pass (off by default) |
| Animation | [GSAP](https://gsap.com) 3.15 (ScrollTrigger) and [Lenis](https://lenis.darkroom.engineering) 1.3                                             |
| Styling   | CSS (custom properties, cascade layers, `clamp()`, `content-visibility`) and design tokens                                                    |
| Fonts     | Orbitron, Montserrat and JetBrains Mono, self-hosted, with Latin characters only                                                              |
| Images    | Astro's image optimization (`astro:assets`) for the logos and the share image, and Google's image CDN for the team badges                     |
| Backend   | Google Apps Script, Google Sheets (Inscritos, Equipes, Resumo, Mentores and Resumo Mentores tabs) and Google Drive (team badges)              |
| Quality   | Vitest, ESLint, Prettier, Astro Check, Playwright and Lighthouse                                                                              |
| Workflow  | Husky, lint-staged, commitlint (Conventional Commits) and GitHub Actions                                                                      |
| Hosting   | Cloudflare Pages, with the `hackarun.com.br` domain and DNS on Cloudflare                                                                     |

## Architecture

The code follows Clean Architecture, with DDD in the domain and MVVM in the interface. Dependencies always point to
the domain, and ESLint ([`eslint.config.js`](eslint.config.js)) flags any import between layers that breaks this rule.

```mermaid
flowchart TB
  subgraph PRES["Presentation"]
    SEC["Astro sections"]
    MVVM["ViewModels and Views"]
    XP["3D scene"]
    MOT["Animations"]
  end
  subgraph APP["Application"]
    UC["Use cases"]
    PORTS["Ports"]
  end
  subgraph DOM["Domain"]
    ENT["Entities and value objects"]
    REPO["Repository interfaces"]
  end
  subgraph INFRA["Infrastructure"]
    JSON["JSON repositories"]
    GAS["Apps Script gateway"]
    ADP["Storage and clock"]
  end
  COMP(["Composition roots"])

  COMP -- wires --> PRES
  COMP -- wires --> INFRA
  PRES --> APP
  APP --> DOM
  INFRA -. implements .-> PORTS
  INFRA -. implements .-> REPO
```

- **Domain:** does not import other layers or UI libraries (`three`, `gsap`, `lenis`, `astro`).
- **Application:** depends only on the domain.
- **Presentation:** uses the application ports and never imports the infrastructure; adapters are wired in
  `src/composition`.
- **Shared** (`EventBus`, `Observable`, `Ticker`): used by the other layers and imports none of them.

The domain has two aggregates (`HackathonEvent` and `ParticipantRegistration`, the individual registration), value
objects such as `FullName`, `StudentId`, `Email`, `Phone`, `ParticipantProfile`, `Slots` and `TimeSlot`, and the
`RegistrationPolicy` service, which decides whether registration is coming soon, open, closing or closed. In the interface, ViewModels keep state in `Observable` and do not touch the DOM; Views
only connect them to the page. Modules communicate through a typed `EventBus`
([`AppEvents.ts`](src/presentation/app/AppEvents.ts)).

Loading in the browser follows this order, without delaying the first content on screen:

```mermaid
flowchart TB
  P["First content on screen (PaintGate)"] --> B["BootQueue: animations, views and controllers"]
  B --> Z["Section near the viewport (LazyMount): teams and mission track, when visible"]
  B --> L(["load + browser idle"])
  L --> X["three.js chunk"]
  L --> W["Shapes in a Web Worker"]
  L --> F["WebGL context (FrameSettle)"]
  F --> S["Shaders in parallel"]
  X --> S
  W --> R["First 3D frame"]
  S --> R
```

The `/inscricao`, `/seja-mentor`, `/equipes`, `/privacidade` and `/autorizacao` pages use a separate entry point
([`LightApp`](src/presentation/app/LightApp.ts)), without 3D, GSAP or Lenis.

<details>
<summary><b>Design patterns and where they are</b></summary>

| Pattern              | Where                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy             | [`ShapeStrategy`](src/presentation/experience/shapes/ShapeStrategy.ts) (8 objects in the code), [`RenderPipeline`](src/presentation/experience/post/RenderPipeline.ts), `QualityProfile`, `ScrollDriver`          |
| Factory + registry   | [`ShapeFactory`](src/presentation/experience/shapes/ShapeFactory.ts), [`BoltFactory`](src/presentation/motion/animators/hero/lightning/BoltFactory.ts)                                                            |
| Registry             | [`AnimatorRegistry`](src/presentation/motion/animators/AnimatorRegistry.ts)                                                                                                                                       |
| Template Method      | [`SectionAnimator`](src/presentation/motion/animators/SectionAnimator.ts)                                                                                                                                         |
| Adapter              | [`SmoothScroll`](src/presentation/motion/core/SmoothScroll.ts) (Lenis), [`AppsScriptRegistrationGateway`](src/infrastructure/registration/AppsScriptRegistrationGateway.ts)                                       |
| Decorator            | [`RetryingRegistrationGateway`](src/infrastructure/registration/RetryingRegistrationGateway.ts): 3 attempts, with increasing waits between them                                                                   |
| Proxy with fallback  | [`FallbackTeamRepository`](src/infrastructure/repositories/FallbackTeamRepository.ts): live list from the sheet, with the build-time list as a backup                                                             |
| Null Object          | [`UnavailableRegistrationGateway`](src/infrastructure/registration/UnavailableRegistrationGateway.ts): without an endpoint, every submission answers "closed"                                                     |
| Observer             | [`Observable`](src/shared/core/Observable.ts), [`EventBus`](src/shared/core/EventBus.ts)                                                                                                                          |
| Singleton            | [`Ticker.shared`](src/shared/core/Ticker.ts) (a single `requestAnimationFrame` for the site), [`serverContainer()`](src/composition/server.ts)                                                                    |
| Facade               | [`GetLandingPage`](src/application/use-cases/GetLandingPage.ts), [`ExperienceStage`](src/presentation/experience/ExperienceStage.ts)                                                                              |
| Composite            | [`strokes.ts`](src/presentation/experience/shapes/strokes.ts): a shape is a list of strokes                                                                                                                       |
| Builder              | [`PointBrush`](src/presentation/experience/shapes/PointBrush.ts), [`BoltBuilder`](src/presentation/motion/animators/hero/lightning/BoltBuilder.ts), [`StageBuilder`](src/presentation/experience/StageBuilder.ts) |
| Repository + Mapper  | [`StaticListRepository`](src/infrastructure/repositories/StaticListRepository.ts), [`EventMapper`](src/infrastructure/mappers/EventMapper.ts)                                                                     |
| Dependency inversion | [`BootSteps`](src/presentation/app/BootQueue.ts), the interface the boot sequence sees                                                                                                                            |

</details>

## Performance

Lighthouse mobile on the production site, median of 5 runs, with the [`scripts/qa/`](scripts/qa/README.md) script
(Chrome with GPU, 4x slower CPU and simulated mobile network):

| Metric                   | Before optimizing | 10/12/2026 | 10/22/2026 |
| ------------------------ | ----------------- | ---------- | ---------- |
| Performance              | 66                | 98         | 95         |
| Total Blocking Time      | 1,600 ms          | 98 ms      | 169 ms     |
| Largest Contentful Paint | 2.9 s             | 2.2 s      | 2.3 s      |
| Cumulative Layout Shift  | –                 | 0.001      | 0.001      |
| Accessibility            | 100               | 100        | 100        |
| Best Practices           | 100               | 100        | 100        |
| SEO                      | 100               | 100        | 100        |

The main measures:

- The HTML is ready at build time, and the critical CSS ships with the page.
- The page's JavaScript only loads after the first content appears on screen
  ([`PaintGate`](src/presentation/app/PaintGate.ts)), and startup is split into short steps
  ([`BootQueue`](src/presentation/app/BootQueue.ts)).
- three.js is in a separate file, loaded after `load`. The shapes are generated in a Web Worker, and the shaders are
  compiled in parallel.
- The particle count (9,000, 22,000 or 42,000) depends on the GPU. If the frame rate stays below 45 for a few
  seconds, quality drops on its own: first the effects, then the resolution and finally the particle tier.
- Sections far from the top use `content-visibility: auto`.
- CSS animations that loop forever only touch `transform` and `opacity` and are paused while their section is far from
  the screen ([`OffscreenMotionController`](src/presentation/controllers/OffscreenMotionController.ts)), so the
  whole page is not repainted on every frame on phones.
- The 3D stops when the tab is in the background.

## Accessibility

The target is **WCAG 2.2 AA**.

- Skip link and always-visible focus, including in Windows high-contrast mode.
- With `prefers-reduced-motion`, scrolling is native and entrance animations do not run.
- A **Pause animations** button in the header and in the mobile menu, which freezes the 3D and the CSS animations.
- Schedule in tabs following the WAI-ARIA pattern, keyboard navigable. Without JavaScript, the four days are shown in
  sequence.
- Form with labelled fields, an error summary, `aria-invalid`, `aria-describedby` and screen reader announcements.
- All content works without JavaScript or WebGL.

## Security and LGPD

- **Security headers** in [`public/_headers`](public/_headers): a Content Security Policy without inline scripts,
  `X-Frame-Options: DENY`, `nosniff` and Referrer-Policy.
- **Only the data needed:** full name, e-mail, WhatsApp, the profile (course, term, institution, and the student ID
  only when the person provides it, plus the area of interest) and whether the person is 18 or older. There is no
  tax ID, no documents, no photos and no sensitive data, and the date of birth is not asked for.
- **Data controller:** LAES. The privacy notice is at [`/privacidade`](src/pages/privacidade.astro) and each
  registration stores the notice version accepted (currently `2026-10-v5`) and the date of acceptance. People under
  18 hand in a guardian authorization at check-in (template at `/autorizacao`).
- **No tracking cookies.** Visits are counted by Cloudflare Web Analytics, which does not use cookies.
- **One registration per person:** an e-mail, WhatsApp number or student ID already used is rejected, and a
  resubmission does not create a new row in the sheet.
- **Server-side validation:** the Apps Script checks everything again with the same rules as the site (a test
  compares both sides) and saves text that starts with `=`, `+`, `-` or `@` as plain text, to prevent injected
  formulas.
- **Spam protection:** a honeypot field, a minimum fill time and a submission limit.
- **Little public information:** the teams page, hidden until the draw, shows only the team name, the number of
  members and the badge, and only after the organizers confirm it. No person's name, e-mail or WhatsApp ever appears
  on the site.

## Quality

| Item           | Status                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| Tests          | Over a thousand tests (Vitest), per layer, with the real Apps Script code running      |
| Lint and types | ESLint with no errors and TypeScript in its strictest mode, with Astro Check           |
| Formatting     | Prettier across the repository                                                         |
| CI             | GitHub Actions on every push to `main` and every PR: lint, formatting, tests and build |
| Commits        | Conventional Commits, checked by commitlint                                            |
| Visual tests   | [`scripts/qa/`](scripts/qa/README.md): screenshots, anchors, overflow and Lighthouse   |

---

## Running it locally

**1. Install the tools**

| Tool            | Version                      | Used for                                    |
| --------------- | ---------------------------- | ------------------------------------------- |
| Git             | recent                       | Cloning the project and opening PRs         |
| Node.js         | 24 LTS (minimum 22.18)       | Running, testing and building               |
| npm             | the one that ships with Node | Dependencies and scripts                    |
| Brave or Chrome | current                      | Optional: visual test scripts               |
| Python          | 3.11 or newer                | Optional: only to rebuild the Orbitron font |

The Node version used in CI is in the `.nvmrc` file.

**2. Clone the project**

Team members join as collaborators and clone the original repository, so each PR gets a Cloudflare preview. The steps
are in [CONTRIBUTING.md](CONTRIBUTING.md#fluxo-de-trabalho-da-equipe) (pt-BR).

```bash
git clone https://github.com/hackarun-unicatolica/lp-hackarun.git
cd lp-hackarun
```

People outside the team fork the repository on GitHub and clone their fork.

**3. Set up the project**

```bash
npm run setup
```

The command checks the Node version, installs the dependencies and creates the `.env` file from `.env.example`. To do
it by hand:

```bash
npm ci
cp .env.example .env
```

**4. Run the site**

```bash
npm run dev
```

Open `http://localhost:4321`. The form is at `http://localhost:4321/inscricao`. Locally, registration runs in
**simulated mode**: nothing is sent and no sheet is changed.

**5. Check before opening a PR**

```bash
npm run validate
npm run format:check
```

`npm run validate` runs lint, tests and the build, like CI.

**6. Test real submissions (optional)**

Use your own sheet, never the official one. Follow [`apps-script/README.md`](apps-script/README.md) (pt-BR) to create
the Apps Script and deploy it as a Web App. Then put the URL ending in `/exec` in your `.env`, in the
`PUBLIC_REGISTRATION_ENDPOINT` variable, and run `npm run dev` again. The `.env` file is not committed.

<details>
<summary><b>Common problems</b></summary>

| Symptom                                  | What to do                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run setup` rejects the Node version | Install Node 24 LTS and open a new terminal. `node -v` shows the version in use.                |
| `npm warn EBADENGINE` during `npm ci`    | It is only a warning. Updating Node 24 to the latest release fixes it.                          |
| Port 4321 is busy                        | Astro uses the next free port and prints the address in the terminal.                           |
| `&&` fails in PowerShell                 | Windows PowerShell 5.1 does not accept `&&`: run one command per line.                          |
| The commit is rejected                   | Check the `type(scope): description` format and the ESLint errors. Do not use `--no-verify`.    |
| I changed `.env` and nothing happened    | Variables are read at startup: stop `npm run dev` and run it again.                             |
| The form comes back filled in            | It is the draft saved in the tab. Use "Limpar rascunho" (clear draft) or close the tab.         |
| The 3D does not show up                  | Check that the browser supports WebGL2 or try `?quality=low`. Without 3D, the page still works. |

</details>

### Scripts

| Command                           | Description                                                   |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run setup`                   | Sets up the project: checks Node, installs and creates `.env` |
| `npm run dev`                     | Development server at `http://localhost:4321`                 |
| `npm run build`                   | Type check and production build in `dist/`                    |
| `npm run preview`                 | Serves the build locally                                      |
| `npm test`                        | Tests                                                         |
| `npm run lint` / `lint:fix`       | ESLint / with automatic fixes                                 |
| `npm run format` / `format:check` | Prettier: format / check                                      |
| `npm run validate`                | Lint, tests and build                                         |

The visual test scripts are in [`scripts/qa/`](scripts/qa/README.md) and have their own install
(`npm run setup -- --qa`).

### Project structure

<details>
<summary><b>Folders</b></summary>

```text
src/
├── domain/          # entities, value objects, aggregates and repository interfaces
├── application/     # use cases, DTOs and ports
├── infrastructure/  # JSON content, mappers, repositories, Apps Script, image and storage
├── presentation/    # pages, sections, components, view-models, views, animations and 3D scene
├── shared/          # EventBus, Observable, Ticker and utilities
├── composition/     # where the layers are wired together
├── assets/          # official logos and the Orbitron font
└── pages/           # inicio, inscricao, seja-mentor, equipes, privacidade, autorizacao and 404
apps-script/         # Google Apps Script code and setup steps
public/              # share image, favicon, rules PDF and _headers
scripts/             # setup, font patch and visual tests (qa/)
tests/               # tests per layer
docs/                # project guide, architecture decisions (ADR) and the images used in this README (media/)
```

</details>

### Content and registration

- **Content** (event and schedule, FAQ, prizes, mentors, NPC stations and partners) lives in
  `src/infrastructure/content/*.json`. Invalid data stops the build.
- **Registration** is **individual**: each person gives a full name, e-mail, WhatsApp, the profile (course, term,
  institution and student ID, as applicable) and the area of interest. The Apps Script saves one row per person in
  the **Inscritos** tab and the totals in the **Resumo** tab. After the November 12 draw, the organizers fill in each
  person's team in the sheet itself.
- **Teams on the site:** a team appears at `/equipes` when the organizers create it in the **Equipes** tab and change
  its Status to `confirmado`. Details are in [`apps-script/README.md`](apps-script/README.md) (pt-BR).
- **Mentors:** alumni and professionals sign up at `/seja-mentor` (name, contact, area of expertise, alumni or
  not, and the event days they can follow the teams on, always in person). Apps Script writes to the **Mentores** tab and the totals
  to the **Resumo Mentores** tab, separate from the registrations. The sign-up has its own privacy notice (the
  "Cadastro de mentores" section of `/privacidade`).

## Contributing

The full workflow is in [CONTRIBUTING.md](CONTRIBUTING.md) (pt-BR). In short:

1. Create a branch from `main`: `git switch -c feat/<topic>` (or `fix/`, `docs/`, `refactor/`).
2. Write commits in **Conventional Commits**, in English, for example `feat(sections): add day tabs to the schedule`.
   The accepted scopes are in [`commitlint.config.js`](commitlint.config.js).
3. Run `npm run validate` and `npm run format:check`.
4. Push the branch and open a Pull Request to `main`. CI must pass, the Cloudflare preview shows up on the PR and one
   of the owners ([CODEOWNERS](.github/CODEOWNERS)) approves it.
5. The merge uses **Squash and merge**, and the official site is updated right after.

## Deploy

The site runs on **Cloudflare Pages**, on the free plan, at **[hackarun.com.br](https://hackarun.com.br)**. The domain's
DNS is on Cloudflare and `www.hackarun.com.br` redirects to the main address. `hackarun.pages.dev` stays up with the same
content and no redirect, because that link was widely shared; the canonical address of both versions points to
`hackarun.com.br`, so search engines index only the custom domain.

- Each merge to `main` publishes a new version in 1 to 2 minutes.
- Each PR gets a preview address, posted by Cloudflare on the PR itself. In the preview, registration is simulated and
  nothing is saved to the sheet.
- Registration on the official site is switched on by the `PUBLIC_REGISTRATION_ENDPOINT` variable (the Apps Script
  URL) in the Cloudflare production environment. The site's public address comes from `PUBLIC_SITE_URL`; without it,
  the default in the code, `https://hackarun.com.br`, applies.

### Technology roulette (`/roleta`)

A screen for the TV used in the 12 November mission. The wheel has five categories (planning and design, frontend,
backend and data, infrastructure and security, testing and launch) and a catalogue of 50 tools and practices in
`src/infrastructure/content/tools.json`. Each team spins up to three times, always landing on a different category,
and picks one of the drawn tools to use in its project; once confirmed, the choice cannot be changed.

The page is static: no login, nothing is saved, and it stays out of the menu and the sitemap. The organisers record
the team and its tool. Keyboard shortcuts for whoever runs the laptop: Space spins, 1 to 3 select a card and F
toggles full screen.

To publish a fork on your own account: in Cloudflare, open **Workers & Pages → Create application → Pages → Connect to
Git**, choose the repository and use `npm run build` as the build command with `dist` as the output folder.

## Roadmap

- [x] Architecture, domain and official content
- [x] Scroll-driven 3D scene with eight objects
- [x] Second version of the design, with the event's official identity
- [x] Button to pause the animations
- [x] Official schedule, with both parts of the event and day tabs
- [x] Publishing on Cloudflare Pages, with automatic deploys and a preview on every PR
- [x] Rules published, with the PDF to download
- [x] Individual registration on its own page, with the sheet organized in three tabs
- [x] Privacy notice (LGPD) and guardian authorization form
- [x] Registration open (October 19), with no cap on spots for now
- [x] Custom domain, `hackarun.com.br`
- [ ] Team draw (November 12) and the `/equipes` page live
- [ ] Prizes, mentors and judges, announced by the organizers
- [ ] The event, November 11 to 14

## Credits

- **Page design and development:** [Marcos Vinicius Muniz Arruda](https://github.com/Marcos-Codfy)
- **Visual identity:** Eduarda Victória (Liga Acadêmica)
- **Held by:** UniCatólica
- **Organized by:** LAES · Liga Acadêmica de Engenharia de Software e Inteligência Artificial
- **Partner:** Capim Dourado Shopping
- **Fonts:** Orbitron, Montserrat and JetBrains Mono (SIL Open Font License)

<sub>HackaRun, UniCatólica, LAES, Capim Dourado Shopping and their logos are trademarks of their respective owners and
appear here only to identify the event.</sub>

---

<div align="center">

<sub>Page design and development by <a href="https://github.com/Marcos-Codfy">Marcos Vinicius Muniz Arruda</a> ·
Palmas, Brazil · 2026</sub>

<!-- LINKEDIN: replace with the profile link when you want to show it here. -->

</div>
