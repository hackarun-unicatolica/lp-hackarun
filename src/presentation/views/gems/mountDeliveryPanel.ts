import type { GemsDeviceStore, GemsGateway } from '@application/gems/GemsPorts';
import {
  DeliverySession,
  type DeliveryScreen,
  type DeliverySync,
  type TeamSync,
} from '@presentation/view-models/gems/DeliverySession';
import { clockTime, deliveryView, matchPending } from '@presentation/view-models/gems/deliveryView';

// entrega final: quem confere as 3 fichas (azul, amarela e vermelha) marca a equipe aqui. A marcação aparece na hora e
// vai para a planilha em segundo plano; dá para já procurar a próxima equipe. Marcou errado? "Desfazer" no aviso ou
// "Desmarcar" na lista de quem completou

const TOAST_MS = 6_000;

const SYNC_TEXT: Record<DeliverySync, string> = {
  saved: 'Tudo salvo na planilha.',
  saving: 'Salvando na planilha…',
  waiting:
    'Sem conexão: as marcações estão guardadas neste aparelho e vão para a planilha quando a internet voltar.',
  login: 'A sessão venceu: recarregue a página e entre de novo para enviar o que está guardado.',
};

const BADGE: Record<TeamSync, string> = {
  saved: '✓ salvo',
  saving: 'salvando…',
  waiting: 'aguardando conexão',
};

function find<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Elemento ${selector} não encontrado`);
  return el;
}

export interface DeliveryPanel {
  open(): void;
}

export function mountDeliveryPanel(
  gateway: GemsGateway,
  store: GemsDeviceStore,
  root: ParentNode = document,
): DeliveryPanel {
  const count = find<HTMLElement>(root, '[data-delivery-count]');
  const form = find<HTMLFormElement>(root, '[data-delivery-form]');
  const input = find<HTMLInputElement>(root, '[data-delivery-input]');
  const options = find<HTMLDataListElement>(root, '[data-delivery-options]');
  const status = find<HTMLElement>(root, '[data-delivery-status]');
  const doneList = find<HTMLOListElement>(root, '[data-delivery-done]');
  const pendingList = find<HTMLUListElement>(root, '[data-delivery-pending]');
  const refresh = find<HTMLButtonElement>(root, '[data-delivery-refresh]');
  const toast = find<HTMLElement>(root, '[data-toast]');
  const toastText = find<HTMLElement>(root, '[data-toast-text]');
  const toastUndo = find<HTMLButtonElement>(root, '[data-toast-undo]');

  let screen: DeliveryScreen | null = null;
  let toastTimer: number | null = null;
  let toastAction: (() => void) | null = null;

  const showToast = (text: string, undo: () => void) => {
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastText.textContent = text;
    toastAction = undo;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      toastAction = null;
    }, TOAST_MS);
  };

  const render = (next: DeliveryScreen) => {
    screen = next;
    const view = deliveryView(next, clockTime);
    count.textContent = next.loaded
      ? `${view.count} de ${view.total} equipes completaram as 3 insígnias`
      : next.loadMessage || 'Carregando as equipes…';
    status.textContent =
      next.rejected || (next.pendingCount > 0 || next.sync !== 'saved' ? SYNC_TEXT[next.sync] : '');
    status.dataset['tone'] =
      next.rejected || next.sync === 'waiting' || next.sync === 'login' ? 'error' : 'info';
    options.replaceChildren(
      ...view.pending.map((team) => {
        const option = document.createElement('option');
        option.value = team;
        return option;
      }),
    );
    doneList.replaceChildren(
      ...view.done.map((d) => {
        const item = document.createElement('li');
        item.className = 'gems__done';
        const label = document.createElement('span');
        label.className = 'gems__done-team';
        label.textContent = `${d.position}º · ${d.team}`;
        const meta = document.createElement('span');
        meta.className = 'gems__done-meta';
        const time = document.createElement('span');
        time.textContent = d.time;
        const badge = document.createElement('span');
        badge.className = 'gems__sync-badge';
        badge.dataset['sync'] = d.sync;
        badge.textContent = BADGE[d.sync];
        meta.append(time, badge);
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'gems__btn gems__btn--ghost gems__btn--small';
        undo.dataset['undo'] = d.team;
        undo.textContent = 'Desmarcar';
        undo.setAttribute('aria-label', `Desmarcar ${d.team}`);
        item.append(label, meta, undo);
        return item;
      }),
    );
    if (view.done.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'gems__empty';
      empty.textContent = 'Nenhuma equipe completou ainda.';
      doneList.append(empty);
    }
    pendingList.replaceChildren(
      ...view.pending.map((team) => {
        const item = document.createElement('li');
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'gems__chip';
        chip.dataset['mark'] = team;
        chip.textContent = team;
        chip.setAttribute('aria-label', `Marcar ${team} como completa`);
        item.append(chip);
        return item;
      }),
    );
  };

  const session = new DeliverySession(
    gateway,
    store,
    {
      now: () => Date.now(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: (id) => window.clearTimeout(id as number),
      newId: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    },
    render,
  );

  const mark = (team: string) => {
    if (!session.mark(team)) return;
    showToast(`${team} marcada.`, () => session.unmark(team));
  };

  const unmark = (team: string) => {
    if (!session.unmark(team)) return;
    showToast(`${team} desmarcada.`, () => session.mark(team));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!screen) return;
    const team = matchPending(deliveryView(screen, clockTime), input.value);
    if (!team) {
      status.textContent = 'Escolha uma equipe da lista (as que ainda não completaram).';
      status.dataset['tone'] = 'error';
      return;
    }
    mark(team);
    input.value = '';
    input.focus();
  });
  pendingList.addEventListener('click', (event) => {
    const team = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mark]')?.dataset['mark'];
    if (team) mark(team);
  });
  doneList.addEventListener('click', (event) => {
    const team = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-undo]')?.dataset['undo'];
    if (team) unmark(team);
  });
  toastUndo.addEventListener('click', () => {
    toastAction?.();
    toastAction = null;
    toast.hidden = true;
  });
  refresh.addEventListener('click', () => void session.refresh());
  window.addEventListener('online', () => session.retryNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') session.retryNow();
  });

  // marcações que ficaram na fila (aparelho fechado sem internet): manda já, mesmo antes de abrir a entrega
  if (store.deliveryData().queue.length > 0) void session.flush();

  return {
    open() {
      void session.open();
    },
  };
}
