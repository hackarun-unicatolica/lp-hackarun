import type { DeliveryState, GemsGateway, GemsResult } from '@application/gems/GemsPorts';
import {
  clockTime,
  deliveryView,
  matchPending,
  type DeliveryView,
} from '@presentation/view-models/gems/deliveryView';

// entrega final: quem confere as 3 fichas (azul, amarela e vermelha) marca a equipe aqui. Marcou errado? "Desmarcar"
// na lista de quem completou. Precisa de internet: cada marcação vai direto para a aba "Insígnias completas"

function find<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Elemento ${selector} não encontrado`);
  return el;
}

export interface DeliveryPanel {
  open(): void;
}

export function mountDeliveryPanel(gateway: GemsGateway, root: ParentNode = document): DeliveryPanel {
  const count = find<HTMLElement>(root, '[data-delivery-count]');
  const form = find<HTMLFormElement>(root, '[data-delivery-form]');
  const input = find<HTMLInputElement>(root, '[data-delivery-input]');
  const options = find<HTMLDataListElement>(root, '[data-delivery-options]');
  const submit = find<HTMLButtonElement>(root, '[data-delivery-submit]');
  const status = find<HTMLElement>(root, '[data-delivery-status]');
  const doneList = find<HTMLOListElement>(root, '[data-delivery-done]');
  const pendingList = find<HTMLUListElement>(root, '[data-delivery-pending]');
  const refresh = find<HTMLButtonElement>(root, '[data-delivery-refresh]');

  let view: DeliveryView | null = null;
  let busy = false;

  const say = (text: string, tone: 'info' | 'ok' | 'error' = 'info') => {
    status.textContent = text;
    status.dataset['tone'] = tone;
  };

  const setBusy = (value: boolean) => {
    busy = value;
    submit.disabled = value;
    refresh.disabled = value;
    root.querySelectorAll<HTMLButtonElement>('[data-undo]').forEach((b) => (b.disabled = value));
  };

  const render = (state: DeliveryState) => {
    view = deliveryView(state, clockTime);
    count.textContent = `${view.count} de ${view.total} equipes completaram as 3 insígnias`;
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
        label.textContent = `${d.position}º · ${d.team}`;
        const time = document.createElement('span');
        time.className = 'gems__done-time';
        time.textContent = d.time;
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'gems__btn gems__btn--ghost gems__btn--small';
        undo.dataset['undo'] = d.team;
        undo.textContent = 'Desmarcar';
        undo.setAttribute('aria-label', `Desmarcar ${d.team}`);
        item.append(label, time, undo);
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
        chip.textContent = team;
        chip.addEventListener('click', () => {
          input.value = team;
          input.focus();
        });
        item.append(chip);
        return item;
      }),
    );
  };

  const run = async (work: () => Promise<GemsResult<DeliveryState>>, done: string) => {
    if (busy) return;
    setBusy(true);
    say('Salvando na planilha…');
    const result = await work();
    setBusy(false);
    if (result.kind === 'ok') {
      render(result.value);
      say(done, 'ok');
    } else if (result.kind === 'login') say('A sessão venceu. Recarregue a página e entre de novo.', 'error');
    else say(result.message, 'error');
  };

  const load = () => run(() => gateway.delivery(), 'Lista atualizada.');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!view) return;
    const team = matchPending(view, input.value);
    if (!team) {
      say('Escolha uma equipe da lista (as que ainda não completaram).', 'error');
      return;
    }
    if (!window.confirm(`Confirmar: a ${team} mostrou as 3 fichas (azul, amarela e vermelha)?`)) return;
    void run(() => gateway.finish(team), `${team} marcada como completa.`).then(() => {
      if (status.dataset['tone'] === 'ok') input.value = '';
    });
  });
  doneList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-undo]');
    const team = button?.dataset['undo'];
    if (!team) return;
    if (!window.confirm(`Desmarcar a ${team}? Ela volta para a lista de quem falta.`)) return;
    void run(() => gateway.undo(team), `${team} desmarcada.`);
  });
  refresh.addEventListener('click', () => void load());

  return {
    open() {
      void load();
    },
  };
}
