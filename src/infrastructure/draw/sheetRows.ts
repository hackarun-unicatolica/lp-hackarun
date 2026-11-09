import {
  institutionOf,
  levelOf,
  normalizeText,
  type DrawParticipant,
  type ParticipantProfile,
} from '@domain/index';

// uma pessoa credenciada como a planilha guarda: textos do jeito que aparecem nas células
export interface AccreditedRow {
  protocol: string;
  name: string;
  profile: string;
  institution: string;
  period: string;
  team: string;
  female?: boolean;
  review?: boolean;
}

// o rótulo da coluna Perfil ("Estuda na UniCatólica") de volta para o perfil do domínio
export function profileFromLabel(label: string): ParticipantProfile | null {
  const text = normalizeText(label);
  if (text.includes('unicatolica')) return 'unicatolica';
  if (text.includes('outra institu')) return 'other-institution';
  if (text.includes('formou')) return 'graduate';
  if (text.includes('conta propria')) return 'self-taught';
  return null;
}

// "2º" -> 2; vazio ou texto sem número -> null
export function periodFromCell(cell: string): number | null {
  const match = /\d+/.exec(cell);
  return match ? Number(match[0]) : null;
}

export function toParticipant(row: AccreditedRow): DrawParticipant {
  const profile = profileFromLabel(row.profile);
  return {
    id: row.protocol,
    name: row.name,
    level: levelOf(profile, periodFromCell(row.period)),
    institution: institutionOf(profile, row.institution),
    ...(row.female === true ? { female: true } : {}),
    ...(row.review === true ? { review: true } : {}),
  };
}
