// roda os mappers sobre os JSONs reais: conteúdo quebrado derruba o CI antes do deploy
import { describe, expect, it } from 'vitest';
import eventData from '@infrastructure/content/event.json';
import stationsData from '@infrastructure/content/stations.json';
import teamsData from '@infrastructure/content/teams.json';
import speakersData from '@infrastructure/content/speakers.json';
import prizesData from '@infrastructure/content/prizes.json';
import partnersData from '@infrastructure/content/partners.json';
import faqData from '@infrastructure/content/faq.json';
import type {
  RawEvent,
  RawFaqItem,
  RawPartner,
  RawPrize,
  RawSpeaker,
  RawStations,
  RawTeam,
} from '@infrastructure/content/schema';
import { EventMapper } from '@infrastructure/mappers/EventMapper';
import { ContentMapper } from '@infrastructure/mappers/ContentMapper';
import { DomainError } from '@domain/index';

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe('EventMapper (event.json real)', () => {
  const event = EventMapper.toDomain(eventData as RawEvent);

  it('monta o aggregate sem erro', () => {
    expect(event.name).toBe('HackaRun');
    expect(event.days.length).toBeGreaterThan(0);
    expect(event.venues.length).toBeGreaterThan(0);
  });

  it('tem os três marcos do contador em ordem', () => {
    expect(event.milestones.map((m) => m.key)).toEqual(['kickoff', 'submission', 'ceremony']);
  });

  it('ids de dias e sessões são únicos', () => {
    expect(unique(event.days.map((d) => d.id))).toBe(true);
    expect(unique(event.days.flatMap((d) => d.sessions.map((s) => s.id)))).toBe(true);
  });

  it('a regra de tamanho de equipe é coerente', () => {
    const { min, max } = event.registration.teamSize;
    expect(min).toBeGreaterThanOrEqual(1);
    expect(max).toBeGreaterThanOrEqual(min);
  });

  it('tem um local de abertura e um da final', () => {
    expect(event.venueByRole('host')).toBeDefined();
    expect(event.venueByRole('final')).toBeDefined();
  });
});

describe('ContentMapper (JSONs reais)', () => {
  it('estações: ordem única; pontuação só depois do regulamento, e fechando com o máximo', () => {
    const raw = stationsData as RawStations;
    const stations = ContentMapper.toStations(raw);
    expect(unique(stations.map((s) => s.id))).toBe(true);
    expect(new Set(stations.map((s) => s.order)).size).toBe(stations.length);
    // o regulamento (12/11) é quem publica a pontuação: até lá fica null
    expect(ContentMapper.toScoring(raw)).toBeNull();
    const published = { maxPoints: 100, criteria: [{ key: 'a', label: 'A', points: 60 }] };
    expect(() => ContentMapper.toScoring({ ...raw, scoring: published })).toThrow(DomainError);
    published.criteria.push({ key: 'b', label: 'B', points: 40 });
    expect(ContentMapper.toScoring({ ...raw, scoring: published })?.maxPoints).toBe(100);
  });

  it('equipes, mentores, prêmios, parceiros e FAQ mapeiam sem erro', () => {
    const teams = (teamsData as RawTeam[]).map(ContentMapper.toTeam);
    const speakers = (speakersData as RawSpeaker[]).map(ContentMapper.toSpeaker);
    const prizes = (prizesData as RawPrize[]).map(ContentMapper.toPrize);
    const partners = (partnersData as RawPartner[]).map(ContentMapper.toPartner);
    const faq = (faqData as RawFaqItem[]).map(ContentMapper.toFaqItem);
    for (const list of [teams, speakers, prizes, partners, faq]) {
      expect(unique(list.map((item) => item.id))).toBe(true);
    }
    expect(faq.length).toBeGreaterThan(0);
  });

  it('nome de equipe inválido quebra o mapeamento (fail fast)', () => {
    expect(() => ContentMapper.toTeam({ id: 't0', name: ' x ' })).toThrow(DomainError);
  });

  it('equipe pública guarda só nome, quantidade de integrantes, status, foto e o Pokémon (nada pessoal)', () => {
    const team = ContentMapper.toTeam({ id: 't1', name: 'Os Brabos', memberCount: 4 });
    expect(team.size).toBe(4);
    expect(team.isConfirmed).toBe(true);
    expect(Object.keys(team).sort()).toEqual(['id', 'imageUrl', 'mascot', 'name', 'size', 'status']);
  });
});
