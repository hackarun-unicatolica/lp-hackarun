import type { RegistrationDTO } from '@application/index';
import {
  registrationHref,
  type RegistrationOrigin,
} from '@presentation/view-models/registration/registrationOrigin';

type Status = RegistrationDTO['status'];

export interface CtaCopy {
  label: string;
  href: string;
  // false = inscrição encerrada, o botão vira só navegação
  isRegistration: boolean;
}

// texto dos CTAs e da linha de status conforme o momento da inscrição (individual: as equipes saem do sorteio).
// Todo CTA de inscrição leva pra página /inscricao com a origem no endereço (a planilha guarda de onde cada
// inscrito veio). Encerrada, o CTA vira "Ver equipes": as equipes já saíram do sorteio e a lista está no ar
const TEAMS_HREF = '/equipes';

export class RegistrationCopy {
  cta(status: Status, origin: RegistrationOrigin): CtaCopy {
    if (status === 'closed') return { label: 'Ver equipes', href: TEAMS_HREF, isRegistration: false };
    const href = registrationHref(origin);
    if (status === 'soon') return { label: 'Quero participar', href, isRegistration: true };
    return { label: 'Garantir minha vaga', href, isRegistration: true };
  }

  // rótulo longo dos CTAs de inscrição no corpo da página (fim da LP, seção de equipes, 404). Em breve convida
  // em vez de prometer o envio: a página de inscrição mostra o que preparar e quando abre
  actionLabel(status: Status): string {
    if (status === 'closed') return 'Ver equipes';
    if (status === 'soon') return 'Quero participar';
    return 'Fazer minha inscrição';
  }

  // versão curta pro header, que não tem espaço
  headerLabel(status: Status): string {
    if (status === 'closed') return 'Ver equipes';
    if (status === 'soon') return 'Participar';
    return 'Inscrever';
  }

  // a inscrição é individual; o tamanho das equipes é o que o sorteio monta
  statusLine(registration: RegistrationDTO): string {
    const how = `Individual · Equipes de até ${registration.teamSize.max} por sorteio`;
    switch (registration.status) {
      case 'soon':
        return `Inscrições abrem em breve · ${how}`;
      case 'open':
        return `Inscrições abertas · ${how}`;
      case 'closing':
        return `Últimas horas de inscrição · ${how}`;
      case 'closed':
        return 'Inscrições encerradas · nos vemos na final';
    }
  }

  // rótulo curto do selo de status da página de inscrição
  statusBadge(status: Status): string {
    switch (status) {
      case 'soon':
        return 'Em breve';
      case 'open':
        return 'Abertas';
      case 'closing':
        return 'Encerrando';
      case 'closed':
        return 'Encerradas';
    }
  }

  isUrgent(status: Status): boolean {
    return status === 'closing';
  }
}
