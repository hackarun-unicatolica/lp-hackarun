import {
  DomainError,
  FaqItem,
  Partner,
  Prize,
  ScoringRule,
  Speaker,
  Station,
  Team,
  TeamName,
} from '@domain/index';
import type { RawFaqItem, RawPartner, RawPrize, RawSpeaker, RawStations, RawTeam } from '../content/schema';

export class ContentMapper {
  static toStations(raw: RawStations): Station[] {
    return raw.stations.map((s) => Station.create({ ...s, skills: s.skills ?? [] }));
  }

  // null = pontuação ainda não publicada (sai no regulamento)
  static toScoring(raw: RawStations): ScoringRule | null {
    return raw.scoring ? ScoringRule.create(raw.scoring.maxPoints, raw.scoring.criteria) : null;
  }

  // nome inválido explode: no build quebra o deploy, na lista ao vivo a linha é descartada
  static toTeam(raw: RawTeam): Team {
    const name = TeamName.create(raw.name);
    if (!name.ok) throw new DomainError(`Team ${raw.id}: ${name.error}`);
    return Team.create({
      id: raw.id,
      name: name.value,
      ...(raw.memberCount !== undefined && { memberCount: raw.memberCount }),
      status: raw.status ?? 'confirmed',
      imageUrl: raw.imageUrl ?? null,
      mascot: raw.mascot ?? null,
    });
  }

  static toSpeaker(raw: RawSpeaker): Speaker {
    return Speaker.create({ ...raw, topic: raw.topic ?? null, avatarUrl: raw.avatarUrl ?? null });
  }

  static toPrize(raw: RawPrize): Prize {
    return Prize.create({ ...raw, reward: raw.reward ?? null });
  }

  static toPartner(raw: RawPartner): Partner {
    return Partner.create({
      ...raw,
      fullName: raw.fullName ?? null,
      url: raw.url ?? null,
      logo: raw.logo ?? null,
    });
  }

  static toFaqItem(raw: RawFaqItem): FaqItem {
    return FaqItem.create(raw);
  }
}
