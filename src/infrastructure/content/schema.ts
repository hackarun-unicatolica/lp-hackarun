// formato cru dos JSONs de conteúdo (o que a equipe edita)
import type {
  ActivityFlag,
  ActivityKind,
  Audience,
  EventStage,
  MilestoneKey,
  PartnerRole,
  SessionKind,
  SpeakerRole,
  StationKind,
  TeamStatus,
  VenueRole,
} from '@domain/index';

export interface RawVenue {
  id: string;
  name: string;
  shortName: string;
  city: string;
  role: VenueRole;
  mapUrl?: string | null;
}

export interface RawTimeRange {
  start: string | null;
  end: string | null;
  startHint?: string | null;
}

export interface RawActivity extends RawTimeRange {
  id: string;
  title: string;
  kind: ActivityKind;
  summary?: string | null;
  details?: string | null;
  track?: Audience | null;
  flags?: ActivityFlag[];
  parts?: (RawTimeRange & { label: string })[];
  checklist?: string[];
  // palestrante/instrutor da atividade; campos em null mostram o espaço reservado
  speaker?: { name?: string | null; photo?: string | null; bio?: string | null } | null;
}

export interface RawSession extends RawTimeRange {
  id: string;
  title: string;
  kind: SessionKind;
  venueId: string;
  place?: string | null;
  audience: Audience;
  audienceNote?: string | null;
  description: string;
  note?: string | null;
  activities: RawActivity[];
}

export interface RawEventDay {
  id: string;
  date: string;
  stage: EventStage;
  label: string;
  title: string;
  summary: string;
  sessions: RawSession[];
}

export interface RawEvent {
  id: string;
  name: string;
  edition: string;
  tagline: string;
  city: string;
  timezone: string;
  venues: RawVenue[];
  milestones: { key: MilestoneKey; label: string; at: string }[];
  registration: {
    endpoint?: string | null;
    closesAt?: string | null;
    capacity?: number | null;
    teamSize?: { min: number; max: number } | null;
  };
  // teto de estandes da exposição
  maxStands?: number | null;
  days: RawEventDay[];
}

export interface RawStations {
  // null até o regulamento publicar a pontuação
  scoring: { maxPoints: number; criteria: { key: string; label: string; points: number }[] } | null;
  stations: {
    id: string;
    order: number;
    title: string;
    challenge: string;
    space: string;
    kind: StationKind;
    skills?: string[];
  }[];
}

// equipe pública: só nome, quantidade de integrantes e foto (nada pessoal)
export interface RawTeam {
  id: string;
  name: string;
  memberCount?: number;
  status?: TeamStatus;
  // url https da foto/logo (a lista ao vivo monta a partir do id do Drive)
  imageUrl?: string | null;
  // Pokémon do sorteio dos nomes (a lista ao vivo monta a partir do pokemonId da planilha)
  mascot?: { pokemonId: number; types: readonly string[] } | null;
  members?: readonly string[];
}

export interface RawSpeaker {
  id: string;
  name: string | null;
  role: SpeakerRole;
  headline: string;
  topic?: string | null;
  avatarUrl?: string | null;
  bio?: string[];
  roleLabel?: string | null;
  linkedin?: string | null;
}

export interface RawPrize {
  id: string;
  rank: number | null;
  title: string;
  description: string;
  reward?: string | null;
}

export interface RawPartner {
  id: string;
  name: string;
  // nome por extenso quando o name é sigla (ex.: LAES)
  fullName?: string | null;
  role: PartnerRole;
  url?: string | null;
  logo?: string | null;
}

export interface RawFaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}
