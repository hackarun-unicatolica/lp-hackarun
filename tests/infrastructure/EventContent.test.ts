// conteúdo real x documento da coordenação (programação oficial): horário, local e público de cada bloco
import { describe, expect, it } from 'vitest';
import eventData from '@infrastructure/content/event.json';
import faqData from '@infrastructure/content/faq.json';
import partnersData from '@infrastructure/content/partners.json';
import speakersData from '@infrastructure/content/speakers.json';
import prizesData from '@infrastructure/content/prizes.json';
import type { RawEvent, RawFaqItem } from '@infrastructure/content/schema';
import { EventMapper } from '@infrastructure/mappers/EventMapper';

const event = EventMapper.toDomain(eventData as RawEvent);
const day = (date: string) => event.days.find((d) => d.date === date);
const activity = (id: string) =>
  event.days.flatMap((d) => d.sessions.flatMap((s) => s.activities)).find((a) => a.id === id);
const slot = (id: string) => {
  const found = activity(id);
  return found ? [found.slot.start, found.slot.end] : null;
};

describe('programação oficial (event.json)', () => {
  it('quatro dias, de 11 a 14/11, com rótulo curto pro seletor', () => {
    expect(event.days.map((d) => d.date)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
    expect(event.days.map((d) => d.label)).toEqual(['Oficinas', 'Abertura', 'Desenvolvimento', 'Final']);
  });

  it('marcos: largada 11/11 19h, fim do desenvolvimento 14/11 13h e a final a partir das 17h', () => {
    const at = Object.fromEntries(event.milestones.map((m) => [m.key, m.at.toISOString()]));
    expect(at).toEqual({
      kickoff: '2026-11-11T22:00:00.000Z',
      submission: '2026-11-14T16:00:00.000Z',
      ceremony: '2026-11-14T20:00:00.000Z',
    });
  });

  it('11/11: três oficinas abertas no Auditório do Bloco II', () => {
    const [block] = day('2026-11-11')?.sessions ?? [];
    expect(block?.place).toBe('Auditório do Bloco II');
    expect(block?.audience).toBe('open');
    expect(block?.activities.map((a) => [a.title, a.slot.start, a.slot.end])).toEqual([
      ['Ideação para Hackathons', '19:00', '19:50'],
      ['Do Commit ao Código: Git e GitHub na prática', '20:00', '20:50'],
      ['Hackeando ideias com IA', '21:00', '21:50'],
    ]);
    expect(block?.activities.every((a) => a.details)).toBe(true);
  });

  it('12/11: abertura aberta ao público, com equipes, regulamento e lançamento do hackathon', () => {
    const [block] = day('2026-11-12')?.sessions ?? [];
    expect([block?.slot.start, block?.slot.end, block?.place, block?.audience]).toEqual([
      '19:00',
      '22:00',
      'Bloco II',
      'open',
    ]);
    expect(slot('teams-and-mentors')).toEqual(['19:15', '19:35']);
    expect(slot('rulebook')).toEqual(['19:35', '19:55']);
    expect(slot('challenge-launch')).toEqual(['20:00', '20:15']);
    expect(['teams-and-mentors', 'rulebook', 'challenge-launch'].map((id) => activity(id)?.track)).toEqual([
      'hackathon',
      'hackathon',
      'hackathon',
    ]);
  });

  it('13/11: noite de desenvolvimento com a Hora do Código no Bloco II', () => {
    const [block] = day('2026-11-13')?.sessions ?? [];
    expect([block?.slot.start, block?.slot.end, block?.place, block?.audience]).toEqual([
      '19:00',
      '22:00',
      'Bloco II',
      'hackathon',
    ]);
    expect(block?.activities.map((a) => a.id)).toEqual(['market-workshops']);
    expect(slot('market-workshops')).toEqual(['19:00', '22:00']);
  });

  it('14/11: desenvolvimento só de equipes e mentores, depois a HackaRun Experience no shopping', () => {
    const [dev, experience] = day('2026-11-14')?.sessions ?? [];
    expect([dev?.slot.start, dev?.slot.end, dev?.venueId, dev?.audience]).toEqual([
      '10:00',
      '13:00',
      'unicatolica',
      'teams',
    ]);
    expect(dev?.note).toContain('Missões-surpresas');
    expect([experience?.slot.start, experience?.slot.end, experience?.venueId]).toEqual([
      '17:00',
      null,
      'capim-dourado',
    ]);
    expect(experience?.activities.map((a) => a.slot.start)).toEqual([
      '17:00',
      '17:30',
      '18:30',
      '19:00',
      '19:30',
    ]);
    expect(slot('awards')).toEqual(['19:00', '19:30']);
  });

  it('4 oficinas e até 10 estandes', () => {
    const workshops = event.days.flatMap((d) => d.sessions).reduce((acc, s) => acc + s.workshopCount, 0);
    expect(workshops).toBe(4);
    expect(event.maxStands).toBe(10);
  });
});

describe('FAQ e grafia', () => {
  const faq = faqData as RawFaqItem[];

  it('quatro grupos, nesta ordem', () => {
    expect([...new Set(faq.map((f) => f.category))]).toEqual([
      'Evento',
      'Programação aberta',
      'Hackathon',
      'Inscrição',
    ]);
  });

  it('o FAQ conta o horário do regulamento e o prazo da entrega como na programação', () => {
    const answer = (id: string) => faq.find((f) => f.id === id)?.answer ?? '';
    expect(answer('rulebook')).toContain('19h35');
    expect(answer('ai')).toContain('regulamento');
    expect(answer('delivery')).toContain('10h às 13h');
    expect(answer('delivery')).toContain('regulamento');
  });

  it('a instituição aparece como "UniCatólica" em todo o conteúdo', () => {
    const text = JSON.stringify([eventData, faqData, partnersData, speakersData, prizesData]);
    expect(text).not.toMatch(/Unicatólica/);
    expect(text).toMatch(/UniCatólica/);
  });
});
