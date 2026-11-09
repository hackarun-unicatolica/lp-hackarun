import { describe, expect, it, vi } from 'vitest';
import type {
  EnterResult,
  FeedbackDay,
  FeedbackGateway,
  SubmitResult,
} from '@application/feedback/FeedbackGateway';
import { PeerFeedbackViewModel } from '@presentation/view-models/feedback/PeerFeedbackViewModel';

const DAY: FeedbackDay = {
  day: '2026-11-13',
  label: '13/11',
  opens: '2026-11-13T19:00:00-03:00',
  closes: '2026-11-13T23:59:59-03:00',
};
const person = { name: 'Ana', team: 'Mew' };
const OPEN: EnterResult = {
  kind: 'open',
  person,
  day: DAY,
  next: null,
  colleagues: [
    { id: 'b', name: 'Bruno' },
    { id: 'c', name: 'Caio' },
  ],
  ticket: 'comprovante',
};
const REASON = 'Não ajudou em nada hoje.';

function setup(enter: EnterResult = OPEN, ...replies: SubmitResult[]) {
  const queue = replies.length ? [...replies] : [{ kind: 'sent', next: null } as SubmitResult];
  const gateway: FeedbackGateway = {
    enter: vi.fn(() => Promise.resolve(enter)),
    submit: vi.fn(() =>
      Promise.resolve(queue.length > 1 ? (queue.shift() as SubmitResult) : (queue[0] as SubmitResult)),
    ),
  };
  const sleep = vi.fn(() => Promise.resolve());
  const vm = new PeerFeedbackViewModel(gateway, sleep);
  return { vm, gateway, sleep };
}

async function entered(...replies: SubmitResult[]) {
  const ctx = setup(OPEN, ...replies);
  await ctx.vm.enter('ana@exemplo.com', '(63) 99999-0101');
  return ctx;
}

describe('PeerFeedbackViewModel', () => {
  it('não chama o sistema com dados incompletos', async () => {
    const { vm, gateway } = setup();
    await vm.enter('sem-arroba', '123');
    expect(gateway.enter).not.toHaveBeenCalled();
    expect(vm.state.value.error).toContain('WhatsApp');
  });

  it('dados errados ficam na identificação com mensagem', async () => {
    const { vm } = setup({ kind: 'not-found' });
    await vm.enter('ana@exemplo.com', '(63) 99999-0101');
    expect(vm.state.value.screen).toBe('identify');
    expect(vm.state.value.error).toContain('Não encontramos');
  });

  it.each([
    [{ kind: 'done', person, day: DAY, next: null } as EnterResult, 'already'],
    [{ kind: 'closed', person, next: DAY } as EnterResult, 'closed'],
    [{ kind: 'alone', person, next: null } as EnterResult, 'alone'],
  ])('sem formulário: %j', async (result, outcome) => {
    const { vm } = setup(result);
    await vm.enter('ana@exemplo.com', '(63) 99999-0101');
    expect(vm.state.value).toMatchObject({ screen: 'finished', outcome });
  });

  it('não envia enquanto faltar colega e aponta quem falta', async () => {
    const { vm, gateway } = await entered();
    vm.setStars('b', 5);
    await vm.submit();
    expect(gateway.submit).not.toHaveBeenCalled();
    expect(vm.state.value.problems).toEqual({ c: 'score' });
  });

  it('nota baixa só passa com motivo; corrigir limpa o aviso daquele colega', async () => {
    const { vm, gateway } = await entered();
    vm.setStars('b', 5);
    vm.setStars('c', 3);
    await vm.submit();
    expect(vm.state.value.problems).toEqual({ c: 'reason-short' });
    vm.setReason('c', REASON);
    expect(vm.state.value.problems).toEqual({});
    await vm.submit();
    expect(gateway.submit).toHaveBeenCalledTimes(1);
    expect(vm.state.value).toMatchObject({ screen: 'finished', outcome: 'sent' });
  });

  it('marcar não compareceu tira as estrelas, e escolher estrela desmarca', async () => {
    const { vm } = await entered();
    vm.setStars('b', 4);
    vm.setAbsent('b', true);
    expect(vm.state.value.ratings['b']).toMatchObject({ stars: null, absent: true });
    vm.setStars('b', 2);
    expect(vm.state.value.ratings['b']).toMatchObject({ stars: 2, absent: false });
  });

  const fill = (vm: PeerFeedbackViewModel) => {
    vm.setStars('b', 5);
    vm.setAbsent('c', true);
    vm.setReason('c', `  ${REASON}  `);
  };

  it('envia com o comprovante e o texto limpo', async () => {
    const { vm, gateway } = await entered();
    fill(vm);
    await vm.submit();
    expect(gateway.submit).toHaveBeenCalledWith('comprovante', [
      { id: 'b', stars: 5, absent: false, reason: '' },
      { id: 'c', stars: null, absent: true, reason: REASON },
    ]);
  });

  it('planilha ocupada: tenta sozinho e termina quando passa', async () => {
    const { vm, gateway, sleep } = await entered(
      { kind: 'busy' },
      { kind: 'busy' },
      { kind: 'sent', next: null },
    );
    fill(vm);
    await vm.submit();
    expect(gateway.submit).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(vm.state.value.outcome).toBe('sent');
  });

  it('continuou ocupada: mantém as respostas para enviar de novo', async () => {
    const { vm } = await entered({ kind: 'busy' });
    fill(vm);
    await vm.submit();
    expect(vm.state.value).toMatchObject({ screen: 'rate', busy: false });
    expect(vm.state.value.ratings['b']?.stars).toBe(5);
    expect(vm.state.value.error).toContain('enviar de novo');
  });

  it('retentativa que encontra o envio já gravado termina como registrada', async () => {
    const { vm } = await entered({ kind: 'busy' }, { kind: 'already', next: null });
    fill(vm);
    await vm.submit();
    expect(vm.state.value.outcome).toBe('already');
  });

  it('sessão vencida volta para a identificação', async () => {
    const { vm } = await entered({ kind: 'expired' });
    fill(vm);
    await vm.submit();
    expect(vm.state.value).toMatchObject({ screen: 'identify', busy: false });
    expect(vm.state.value.error).toContain('expirou');
  });

  it('depois de enviar, as notas somem da memória da tela', async () => {
    const { vm } = await entered();
    fill(vm);
    await vm.submit();
    expect(vm.state.value.ratings).toEqual({});
  });

  it('clique duplo não envia duas vezes', async () => {
    const { vm, gateway } = await entered();
    fill(vm);
    await Promise.all([vm.submit(), vm.submit()]);
    expect(gateway.submit).toHaveBeenCalledTimes(1);
  });
});
