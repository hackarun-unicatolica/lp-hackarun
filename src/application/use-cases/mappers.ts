// entidade -> DTO; fica aqui pra todos os casos de uso falarem a mesma língua
import type {
  Activity,
  EventDay,
  FaqItem,
  Milestone,
  Partner,
  Prize,
  RegistrationStatus,
  RegistrationWindow,
  ScoringRule,
  Session,
  Speaker,
  Station,
  Team,
  TimeSlot,
  Venue,
} from '@domain/index';
import type {
  ActivityDTO,
  EventDayDTO,
  FaqItemDTO,
  MilestoneDTO,
  PartnerDTO,
  PrizeDTO,
  RegistrationDTO,
  ScoringDTO,
  SessionDTO,
  SpeakerDTO,
  StationDTO,
  TeamDTO,
  TimeRangeDTO,
  VenueDTO,
} from '../dto';

export const toVenueDTO = (v: Venue): VenueDTO => ({
  id: v.id,
  name: v.name,
  shortName: v.shortName,
  city: v.city,
  role: v.role,
  mapUrl: v.mapUrl,
});

const toTimeRangeDTO = (slot: TimeSlot): TimeRangeDTO => ({
  start: slot.start,
  end: slot.end,
  startHint: slot.startHint,
});

export const toActivityDTO = (a: Activity): ActivityDTO => ({
  id: a.id,
  title: a.title,
  kind: a.kind,
  ...toTimeRangeDTO(a.slot),
  summary: a.summary,
  details: a.details,
  track: a.track,
  flags: [...a.flags],
  parts: a.parts.map((p) => ({ label: p.label, ...toTimeRangeDTO(p.slot) })),
  checklist: [...a.checklist],
  speaker: a.speaker ? { ...a.speaker } : null,
});

export const toSessionDTO = (s: Session, venue: Venue): SessionDTO => ({
  id: s.id,
  title: s.title,
  kind: s.kind,
  ...toTimeRangeDTO(s.slot),
  venue: toVenueDTO(venue),
  place: s.place,
  audience: s.audience,
  audienceNote: s.audienceNote,
  description: s.description,
  note: s.note,
  activities: s.activities.map(toActivityDTO),
});

export const toEventDayDTO = (d: EventDay, venueOf: (id: string) => Venue): EventDayDTO => ({
  id: d.id,
  date: d.date,
  stage: d.stage,
  label: d.label,
  title: d.title,
  summary: d.summary,
  sessions: d.sessions.map((s) => toSessionDTO(s, venueOf(s.venueId))),
});

export const toMilestoneDTO = (m: Milestone): MilestoneDTO => ({
  key: m.key,
  label: m.label,
  at: m.at.toISOString(),
});

export const toRegistrationDTO = (w: RegistrationWindow, status: RegistrationStatus): RegistrationDTO => ({
  status,
  endpoint: w.endpoint,
  closesAt: w.closesAt?.toISOString() ?? null,
  slots: {
    capacity: w.slots.capacity,
    taken: w.slots.taken,
    remaining: w.slots.remaining,
    level: w.slots.level,
  },
  teamSize: w.teamSize,
});

export const toStationDTO = (s: Station): StationDTO => ({
  id: s.id,
  order: s.order,
  code: s.code,
  title: s.title,
  challenge: s.challenge,
  space: s.space,
  kind: s.kind,
  skills: [...s.skills],
});

export const toScoringDTO = (r: ScoringRule): ScoringDTO => ({
  maxPoints: r.maxPoints,
  criteria: r.criteria.map((c) => ({ ...c, share: r.shareOf(c.key) })),
});

export const toTeamDTO = (t: Team): TeamDTO => ({
  id: t.id,
  name: t.name.value,
  memberCount: t.size,
  status: t.status,
  imageUrl: t.imageUrl,
  mascot: t.mascot,
});

export const toSpeakerDTO = (s: Speaker): SpeakerDTO => ({
  id: s.id,
  name: s.name,
  role: s.role,
  headline: s.headline,
  topic: s.topic,
  avatarUrl: s.avatarUrl,
  bio: [...s.bio],
  roleLabel: s.roleLabel,
  linkedin: s.linkedin,
  revealed: s.isRevealed,
});

export const toPrizeDTO = (p: Prize): PrizeDTO => ({
  id: p.id,
  rank: p.rank,
  title: p.title,
  description: p.description,
  reward: p.reward,
  revealed: p.isRevealed,
});

export const toPartnerDTO = (p: Partner): PartnerDTO => ({
  id: p.id,
  name: p.name,
  fullName: p.fullName,
  role: p.role,
  url: p.url,
  logo: p.logo,
});

export const toFaqItemDTO = (f: FaqItem): FaqItemDTO => ({
  id: f.id,
  question: f.question,
  answer: f.answer,
  category: f.category,
});
