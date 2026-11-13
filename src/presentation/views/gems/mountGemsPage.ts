import { GEM_LETTERS, type GemColor, type GemQuestion } from '@domain/gems/GemQueue';
import type { GemsDeviceStore, GemsGateway } from '@application/gems/GemsPorts';
import { GemsSession, type GemsView, type SyncStatus } from '@presentation/view-models/gems/GemsSession';
import { GEM_TALKS } from './gemTalks';
import { LoadingMeter } from './LoadingMeter';

// tela /gemas: o NPC escolhe a cor uma vez (fica guardada no aparelho), sorteia e mostra a resposta para conferir.
// Nada de equipe: quem acerta recebe a ficha física da cor

const SYNC_TEXT: Record<SyncStatus, string> = {
  saved: 'Fila salva na planilha',
  sending: 'Salvando…',
  pending: 'Sem conexão: fila guardada neste aparelho, será enviada quando a internet voltar',
  login: 'A sessão venceu: entre de novo para enviar a fila guardada',
};

function find<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Elemento ${selector} não encontrado`);
  return el;
}

function renderQuestion(target: HTMLElement, question: GemQuestion | null, reveal: boolean): void {
  target.replaceChildren();
  if (!question) {
    const empty = document.createElement('p');
    empty.className = 'gems__empty';
    empty.textContent = 'Clique em "Sortear questão" quando a equipe chegar.';
    target.append(empty);
    return;
  }
  const number = document.createElement('p');
  number.className = 'gems__number';
  number.textContent = `Questão ${String(question.n).padStart(2, '0')}`;
  const text = document.createElement('h2');
  text.className = 'gems__question';
  text.textContent = question.question;
  const list = document.createElement('ol');
  list.className = 'gems__options';
  question.options.forEach((option, i) => {
    const letter = GEM_LETTERS[i] as string;
    const item = document.createElement('li');
    item.className = 'gems__option';
    if (reveal && letter === question.answer) item.classList.add('is-answer');
    const badge = document.createElement('span');
    badge.className = 'gems__letter';
    badge.textContent = letter;
    const label = document.createElement('span');
    label.textContent = option;
    item.append(badge, label);
    list.append(item);
  });
  target.append(number, text, list);
}

export function mountGemsPage(
  gateway: GemsGateway,
  store: GemsDeviceStore,
  root: ParentNode = document,
): void {
  const pick = find<HTMLElement>(root, '[data-pick]');
  const npc = find<HTMLElement>(root, '[data-npc]');
  const badge = find<HTMLElement>(root, '[data-color-badge]');
  const progress = find<HTMLElement>(root, '[data-progress]');
  const syncLine = find<HTMLElement>(root, '[data-sync]');
  const card = find<HTMLElement>(root, '[data-card]');
  const drawButton = find<HTMLButtonElement>(root, '[data-draw]');
  const revealButton = find<HTMLButtonElement>(root, '[data-reveal]');
  const changeButton = find<HTMLButtonElement>(root, '[data-change]');
  const loadLine = find<HTMLElement>(root, '[data-load]');
  const meter = new LoadingMeter({
    box: find<HTMLElement>(root, '[data-meter]'),
    fill: find<HTMLElement>(root, '[data-meter-fill]'),
    label: find<HTMLElement>(root, '[data-meter-label]'),
  });
  find<HTMLElement>(root, '[data-storage-warning]').hidden = store.available;

  let session: GemsSession | null = null;
  let reveal = false;
  let shownQuestion: number | null = null;

  const render = (view: GemsView) => {
    const talk = GEM_TALKS[view.color];
    badge.textContent = `NPC ${talk.label} · ${talk.talk}`;
    document.body.dataset['gem'] = view.color;
    if (view.question?.n !== shownQuestion) reveal = false;
    shownQuestion = view.question?.n ?? null;
    if (view.load === 'loading') meter.start();
    else meter.finish();
    loadLine.hidden = view.load === 'ready' || view.load === 'loading';
    loadLine.textContent =
      view.load === 'empty' ? 'A aba Questões da planilha não tem questões desta cor.' : view.loadMessage;
    progress.textContent =
      view.total > 0 ? `Rodada ${view.round} · faltam ${view.remaining} de ${view.total} questões` : '';
    syncLine.textContent = SYNC_TEXT[view.sync];
    syncLine.dataset['state'] = view.sync;
    drawButton.disabled = view.load !== 'ready';
    drawButton.textContent = view.question ? 'Próxima questão' : 'Sortear questão';
    revealButton.hidden = !view.question;
    revealButton.textContent = reveal ? 'Esconder resposta' : 'Mostrar resposta';
    revealButton.setAttribute('aria-pressed', String(reveal));
    renderQuestion(card, view.question, reveal);
  };

  const open = (color: GemColor) => {
    store.setColor(color);
    pick.hidden = true;
    npc.hidden = false;
    session = new GemsSession(
      color,
      gateway,
      store,
      {
        now: () => Date.now(),
        random: () => Math.random(),
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (id) => window.clearTimeout(id as number),
      },
      render,
    );
    void session.start();
  };

  root.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) => {
    button.addEventListener('click', () => {
      const color = button.dataset['color'] as GemColor;
      open(color);
    });
  });
  drawButton.addEventListener('click', () => {
    reveal = false;
    session?.draw();
  });
  revealButton.addEventListener('click', () => {
    reveal = !reveal;
    if (session) render(session.view());
  });
  changeButton.addEventListener('click', () => {
    meter.cancel();
    store.setColor(null);
    session = null;
    delete document.body.dataset['gem'];
    npc.hidden = true;
    pick.hidden = false;
  });
  window.addEventListener('online', () => session?.retryNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') session?.retryNow();
  });

  const saved = store.color();
  if (saved) open(saved);
  else pick.hidden = false;

  // fila de outra cor que ficou pendente neste aparelho (o NPC trocou de cor sem internet): envia em segundo plano
  for (const color of Object.keys(GEM_TALKS) as GemColor[]) {
    if (color === saved || !store.data(color)?.pending) continue;
    const background = new GemsSession(
      color,
      gateway,
      store,
      {
        now: () => Date.now(),
        random: () => Math.random(),
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (id) => window.clearTimeout(id as number),
      },
      () => {},
    );
    window.addEventListener('online', () => background.retryNow());
    void background.flush();
  }
}
