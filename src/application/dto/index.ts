// DTOs serializáveis: é o que sai da aplicação pra camada de apresentação
import type {
  ActivityFlag,
  ActivityKind,
  Audience,
  EventStage,
  FaqItem,
  MilestoneKey,
  PartnerRole,
  RegistrationStatus,
  SessionKind,
  SlotsLevel,
  SpeakerRole,
  StationKind,
  TeamStatus,
  VenueRole,
} from '@domain/index';

export interface VenueDTO {
  id: string;
  name: string;
  shortName: string;
  city: string;
  role: VenueRole;
  mapUrl: string | null;
}

export interface TimeRangeDTO {
  start: string | null;
  end: string | null;
  startHint: string | null;
}

export interface ActivitySpeakerDTO {
  name: string | null;
  photo: string | null;
  bio: string | null;
}

export interface ActivityDTO extends TimeRangeDTO {
  id: string;
  title: string;
  kind: ActivityKind;
  summary: string | null;
  details: string | null;
  track: Audience | null;
  flags: ActivityFlag[];
  parts: (TimeRangeDTO & { label: string })[];
  checklist: string[];
  speaker: ActivitySpeakerDTO | null;
}

export interface SessionDTO extends TimeRangeDTO {
  id: string;
  title: string;
  kind: SessionKind;
  venue: VenueDTO;
  place: string | null;
  audience: Audience;
  audienceNote: string | null;
  description: string;
  note: string | null;
  activities: ActivityDTO[];
}

export interface EventDayDTO {
  id: string;
  date: string;
  stage: EventStage;
  label: string;
  title: string;
  summary: string;
  sessions: SessionDTO[];
}

export interface MilestoneDTO {
  key: MilestoneKey;
  label: string;
  at: string;
}

export interface SlotsDTO {
  capacity: number | null;
  taken: number;
  remaining: number | null;
  level: SlotsLevel;
}

export interface RegistrationDTO {
  status: RegistrationStatus;
  endpoint: string | null;
  closesAt: string | null;
  slots: SlotsDTO;
  teamSize: { min: number; max: number };
}

export interface EventStatsDTO {
  days: number;
  stations: number;
  // oficinas da programação (cada horário avulso conta)
  workshops: number;
  // teto de estandes da exposição ("até 10"), null = não anunciado
  stands: number | null;
}

export interface EventOverviewDTO {
  name: string;
  edition: string;
  tagline: string;
  city: string;
  timezone: string;
  firstDate: string;
  lastDate: string;
  venues: VenueDTO[];
  milestones: MilestoneDTO[];
  registration: RegistrationDTO;
  stats: EventStatsDTO;
}

export interface StationDTO {
  id: string;
  order: number;
  code: string;
  title: string;
  challenge: string;
  space: string;
  kind: StationKind;
  skills: string[];
}

export interface ScoringCriterionDTO {
  key: string;
  label: string;
  points: number;
  share: number;
}

export interface ScoringDTO {
  maxPoints: number;
  criteria: ScoringCriterionDTO[];
}

export interface MissionsDTO {
  stations: StationDTO[];
  // null até o regulamento publicar a pontuação
  scoring: ScoringDTO | null;
}

// equipe pública: nunca nome de pessoa, matrícula ou e-mail
export interface TeamDTO {
  id: string;
  name: string;
  memberCount: number;
  status: TeamStatus;
  // url pública da foto/logo (Drive) ou null: a página mostra as iniciais
  imageUrl: string | null;
  // Pokémon do sorteio dos nomes (número e tipos) ou null
  mascot: { pokemonId: number; types: readonly string[] } | null;
}

export interface SpeakerDTO {
  id: string;
  name: string | null;
  role: SpeakerRole;
  headline: string;
  topic: string | null;
  avatarUrl: string | null;
  bio: string[];
  roleLabel: string | null;
  linkedin: string | null;
  revealed: boolean;
}

export interface PrizeDTO {
  id: string;
  rank: number | null;
  title: string;
  description: string;
  reward: string | null;
  revealed: boolean;
}

export interface PartnerDTO {
  id: string;
  name: string;
  fullName: string | null;
  role: PartnerRole;
  url: string | null;
  logo: string | null;
}

export type FaqItemDTO = Pick<FaqItem, 'id' | 'question' | 'answer' | 'category'>;

export interface CountdownDTO {
  key: MilestoneKey | null;
  label: string;
  target: string | null;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOver: boolean;
}

export interface LandingPageDTO {
  event: EventOverviewDTO;
  schedule: EventDayDTO[];
  missions: MissionsDTO;
  teams: TeamDTO[];
  speakers: SpeakerDTO[];
  prizes: PrizeDTO[];
  partners: PartnerDTO[];
  faq: FaqItemDTO[];
}
