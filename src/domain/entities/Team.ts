import { Entity } from '../shared/Entity';
import type { TeamName } from '../value-objects/TeamName';

export type TeamStatus = 'confirmed' | 'pending';

// só https (Drive), data:image (simulação do dev) ou a arte local de um Pokémon (/pokemon/6.webp, logo do sorteio dos
// nomes): nada de javascript: ou http solto no src da foto
const SAFE_IMAGE_URL = /^(?:https:\/\/|data:image\/(?:png|jpeg|webp);base64,|\/pokemon\/\d{1,4}\.webp$)/;

// mascote da equipe: o Pokémon sorteado no sorteio dos nomes (número da Pokédex e os tipos, que dão a cor do card)
export interface TeamMascot {
  pokemonId: number;
  types: readonly string[];
}

const MAX_MEMBERS_SHOWN = 8;

const validMascot = (m: TeamMascot | null | undefined): TeamMascot | null =>
  m && Number.isInteger(m.pokemonId) && m.pokemonId > 0 && m.pokemonId < 10000
    ? { pokemonId: m.pokemonId, types: m.types.filter((t) => /^[a-z]{2,12}$/.test(t)).slice(0, 2) }
    : null;

// equipe pública: só o que o site mostra (nome, quantidade e nomes dos integrantes e a foto). Contato de pessoa,
// matrícula e e-mail ficam na planilha
export interface TeamProps {
  id: string;
  name: TeamName;
  memberCount?: number;
  status: TeamStatus;
  // foto ou logo pública (só aparece depois da confirmação)
  imageUrl?: string | null;
  mascot?: TeamMascot | null;
  // nomes de quem está na equipe (só o nome; a página /equipes é dos competidores)
  members?: readonly string[];
}

export class Team extends Entity {
  readonly name: TeamName;
  readonly size: number;
  readonly status: TeamStatus;
  readonly imageUrl: string | null;
  readonly mascot: TeamMascot | null;
  readonly members: readonly string[];

  private constructor(props: TeamProps) {
    super(props.id);
    this.name = props.name;
    const count = props.memberCount ?? 0;
    this.size = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
    this.status = props.status;
    this.imageUrl = props.imageUrl && SAFE_IMAGE_URL.test(props.imageUrl) ? props.imageUrl : null;
    this.mascot = validMascot(props.mascot);
    // texto puro, sem vazio nem repetido, com limite (nome torto na planilha não derruba o card)
    this.members = [
      ...new Set((props.members ?? []).map((m) => String(m).trim().slice(0, 80)).filter(Boolean)),
    ].slice(0, MAX_MEMBERS_SHOWN);
  }

  static create(props: TeamProps): Team {
    return new Team(props);
  }

  get isConfirmed(): boolean {
    return this.status === 'confirmed';
  }

  matches(normalizedQuery: string): boolean {
    if (!normalizedQuery) return true;
    return this.name.searchKey.includes(normalizedQuery);
  }
}
