import type { Colleague, FeedbackDay, FeedbackGateway } from '@application/feedback/FeedbackGateway';
import {
  LOW_STARS,
  REASON_MIN,
  STARS_MAX,
  STARS_MIN,
  cleanReason,
  needsReason,
  ratingProblem,
  type RatingProblem,
} from '@domain/value-objects/PeerReview';
import { untilText, whenText } from '@presentation/formatters/feedbackTime';
import { personName } from '@presentation/formatters/personName';
import {
  PeerFeedbackViewModel,
  type FeedbackOutcome,
  type PeerFeedbackState,
} from '@presentation/view-models/feedback/PeerFeedbackViewModel';
import { h, mustFind } from '../dom';

const PROBLEM_TEXT: Record<RatingProblem, string> = {
  score: 'Escolha de 1 a 5 estrelas ou marque que não compareceu.',
  'reason-short': `Conte o motivo com pelo menos ${REASON_MIN} caracteres.`,
  'reason-long': 'O texto ficou longo demais. Resuma um pouco.',
};

const OUTCOME_TITLE: Record<FeedbackOutcome, string> = {
  sent: 'Avaliação enviada',
  already: 'Você já avaliou hoje',
  closed: 'A avaliação não está aberta agora',
  alone: 'Não há colegas para avaliar',
};

const nextText = (next: FeedbackDay | null): string =>
  next ? `A próxima avaliação abre ${whenText(next.opens)}.` : 'Não há outra avaliação programada.';

const OUTCOME_TEXT: Record<FeedbackOutcome, (next: FeedbackDay | null) => string> = {
  sent: (next) => `Obrigado por contribuir. ${nextText(next)}`,
  already: (next) => `Sua avaliação de hoje já está registrada e não pode ser alterada. ${nextText(next)}`,
  closed: nextText,
  alone: () => 'Sua equipe não tem outros integrantes. Se isso estiver errado, fale com a organização.',
};

interface CardRefs {
  root: HTMLElement;
  labels: HTMLElement[];
  radios: HTMLInputElement[];
  absent: HTMLInputElement;
  reasonBox: HTMLElement;
  reasonLabel: HTMLElement;
  reason: HTMLTextAreaElement;
  counter: HTMLElement;
  error: HTMLElement;
}

// tela pública de avaliação entre colegas. Os cards são montados uma vez por entrada (redesenhar a cada tecla tiraria o
// foco do campo de texto); depois disso só muda o que depende do estado
export function mountFeedback(gateway: FeedbackGateway, root: ParentNode = document): PeerFeedbackViewModel {
  const vm = new PeerFeedbackViewModel(gateway);
  const screens = {
    identify: mustFind<HTMLElement>('[data-screen="identify"]', root),
    rate: mustFind<HTMLElement>('[data-screen="rate"]', root),
    finished: mustFind<HTMLElement>('[data-screen="finished"]', root),
  };
  const form = mustFind<HTMLFormElement>('[data-identify-form]', root);
  const enterButton = mustFind<HTMLButtonElement>('[data-enter]', root);
  const identifyError = mustFind<HTMLElement>('[data-identify-error]', root);
  const greeting = mustFind<HTMLElement>('[data-greeting]', root);
  const context = mustFind<HTMLElement>('[data-context]', root);
  const progress = mustFind<HTMLElement>('[data-progress]', root);
  const list = mustFind<HTMLElement>('[data-colleagues]', root);
  const submit = mustFind<HTMLButtonElement>('[data-submit]', root);
  const rateError = mustFind<HTMLElement>('[data-rate-error]', root);
  const outcomeTitle = mustFind<HTMLElement>('[data-outcome-title]', root);
  const outcomeText = mustFind<HTMLElement>('[data-outcome-text]', root);

  const cards = new Map<string, CardRefs>();
  let builtFor: readonly Colleague[] = [];

  const buildCard = (colleague: Colleague): CardRefs => {
    const groupName = `estrelas-${colleague.id}`;
    const labels: HTMLElement[] = [];
    const radios: HTMLInputElement[] = [];
    for (let value = STARS_MIN; value <= STARS_MAX; value++) {
      const input = h('input', {
        type: 'radio',
        name: groupName,
        value: String(value),
        'aria-label': value === 1 ? '1 estrela' : `${value} estrelas`,
      });
      input.addEventListener('change', () => vm.setStars(colleague.id, value));
      const label = h('label', { class: 'stars__star' }, input, h('span', { 'aria-hidden': 'true' }, '★'));
      radios.push(input);
      labels.push(label);
    }
    const absent = h('input', { type: 'checkbox' });
    absent.addEventListener('change', () => {
      radios.forEach((radio) => (radio.checked = false));
      vm.setAbsent(colleague.id, absent.checked);
    });
    const reasonLabel = h('span', { class: 'field__label' });
    const reason = h('textarea', { rows: '3', maxlength: '600' });
    reason.addEventListener('input', () => vm.setReason(colleague.id, reason.value));
    const counter = h('small', { class: 'field__hint' });
    const reasonBox = h('label', { class: 'field', hidden: true }, reasonLabel, reason, counter);
    const error = h('p', { class: 'card__error', role: 'alert', hidden: true });
    const card = h(
      'fieldset',
      { class: 'card' },
      h('legend', { class: 'card__name' }, personName(colleague.name)),
      h('div', { class: 'stars' }, ...labels),
      h('label', { class: 'absent' }, absent, h('span', {}, 'Não compareceu hoje')),
      reasonBox,
      error,
    );
    return { root: card, labels, radios, absent, reasonBox, reasonLabel, reason, counter, error };
  };

  const updateCard = (id: string, refs: CardRefs, state: PeerFeedbackState) => {
    const rating = state.ratings[id];
    if (!rating) return;
    refs.labels.forEach((label, i) => label.toggleAttribute('data-on', (rating.stars ?? 0) > i));
    refs.radios.forEach((radio) => (radio.disabled = rating.absent || state.busy));
    refs.absent.disabled = state.busy;
    refs.reason.disabled = state.busy;
    refs.root.toggleAttribute('data-absent', rating.absent);
    const show = needsReason(rating);
    refs.reasonBox.hidden = !show;
    refs.reasonLabel.textContent = rating.absent
      ? 'O que aconteceu?'
      : `Por que ${rating.stars === 1 ? '1 estrela' : `${rating.stars ?? LOW_STARS} estrelas`}?`;
    const length = cleanReason(rating.reason).length;
    refs.counter.textContent =
      length >= REASON_MIN ? 'Pronto' : `Mínimo de ${REASON_MIN} caracteres (${length})`;
    const problem = state.problems[id];
    refs.error.hidden = !problem;
    refs.error.textContent = problem ? PROBLEM_TEXT[problem] : '';
    refs.root.toggleAttribute('data-invalid', Boolean(problem));
  };

  const buildCards = (state: PeerFeedbackState) => {
    if (builtFor === state.colleagues) return;
    builtFor = state.colleagues;
    cards.clear();
    list.replaceChildren(
      ...state.colleagues.map((colleague) => {
        const refs = buildCard(colleague);
        cards.set(colleague.id, refs);
        return refs.root;
      }),
    );
  };

  let previousProblems: PeerFeedbackState['problems'] = {};

  const render = (state: PeerFeedbackState) => {
    for (const [name, element] of Object.entries(screens)) element.hidden = name !== state.screen;
    enterButton.disabled = state.busy;
    enterButton.textContent = state.busy && state.screen === 'identify' ? 'Conferindo…' : 'Continuar';
    identifyError.textContent = state.screen === 'identify' ? (state.error ?? '') : '';

    if (state.screen === 'rate') {
      buildCards(state);
      greeting.textContent = `Olá, ${personName(state.person?.name ?? '')}`;
      context.textContent = `${state.person?.team ?? ''} · avaliação de ${state.day?.label ?? ''}, ${untilText(state.day?.closes ?? '')}`;
      const total = state.colleagues.length;
      const ready = state.colleagues.filter((c) => {
        const rating = state.ratings[c.id];
        return rating && ratingProblem(rating) === null;
      }).length;
      progress.textContent = `${ready} de ${total} ${total === 1 ? 'colega avaliado' : 'colegas avaliados'}`;
      cards.forEach((refs, id) => updateCard(id, refs, state));
      submit.disabled = state.busy;
      submit.textContent = state.busy ? 'Enviando…' : 'Enviar avaliação';
      rateError.textContent = state.error ?? '';
      // acabou de apontar o que falta: leva até o primeiro colega com problema
      const firstProblem = state.colleagues.find((c) => state.problems[c.id] && !previousProblems[c.id]);
      if (firstProblem)
        cards.get(firstProblem.id)?.root.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    previousProblems = state.problems;

    if (state.screen === 'finished' && state.outcome) {
      outcomeTitle.textContent = OUTCOME_TITLE[state.outcome];
      outcomeText.textContent = OUTCOME_TEXT[state.outcome](state.next);
    }
  };

  vm.state.subscribe(render);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    void vm.enter(String(data.get('email') ?? ''), String(data.get('whatsapp') ?? ''));
  });
  submit.addEventListener('click', () => void vm.submit());
  return vm;
}
