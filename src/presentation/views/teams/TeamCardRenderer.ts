import { qs } from '@shared/utils/dom';
import type { PublicTeam } from '@presentation/view-models/teams/TeamsViewModel';
import { memberCountLabel, teamImageAlt, teamInitials } from '@presentation/formatters/TeamLabels';
import { softHyphenate } from '@presentation/formatters/SoftHyphens';
import { typeColor } from '@presentation/formatters/pokemonTypes';
import { personName } from '@presentation/formatters/personName';

const MISSING = 'is-image-missing';
// mesma largura que o driveImageUrl pede ao Google (=w600): reserva o espaço e evita pulo de layout
const IMAGE_SIDE = 600;

function setText(root: ParentNode, selector: string, text: string): void {
  const el = qs(selector, root);
  if (el && el.textContent !== text) el.textContent = text;
}

function photo(src: string, alt: string, className: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = className;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = IMAGE_SIDE;
  img.height = IMAGE_SIDE;
  img.src = src;
  return img;
}

// foto que não carrega (link sem permissão pública, arquivo apagado) vira as iniciais
export function watchTeamImage(card: HTMLElement): void {
  const img = qs<HTMLImageElement>('[data-team-img]', card);
  if (!img?.getAttribute('src')) {
    card.classList.add(MISSING);
    return;
  }
  img.addEventListener('load', () => card.classList.remove(MISSING), { once: true });
  // card recém-montado, fora da página: o "complete" ainda não diz nada, quem decide é o load/error
  if (img.isConnected && img.complete && img.naturalWidth === 0) card.classList.add(MISSING);
  else img.addEventListener('error', () => card.classList.add(MISSING), { once: true });
}

// foto por cima de uma cópia borrada dela mesma: logo não corta e foto não fica com tarja preta
function setImage(card: HTMLElement, team: PublicTeam): void {
  const frame = qs('[data-team-frame]', card);
  if (!frame) return;
  frame.querySelectorAll('img').forEach((img) => img.remove());
  card.classList.toggle(MISSING, !team.imageUrl);
  if (!team.imageUrl) return;
  const backdrop = photo(team.imageUrl, '', 'team-card__backdrop');
  backdrop.setAttribute('aria-hidden', 'true');
  const main = photo(team.imageUrl, teamImageAlt(team.name), 'team-card__img');
  main.dataset['teamImg'] = '';
  frame.append(backdrop, main);
  watchTeamImage(card);
}

// card clonado do <template> do TeamCard.astro; tudo via textContent (nada da planilha vira HTML)
export function fillTeamCard(card: HTMLElement, team: PublicTeam): void {
  // hífen opcional nas palavras longas: no card estreito o nome quebra na sílaba, não no meio dela
  setText(card, '[data-team-name]', softHyphenate(team.name));
  setText(card, '[data-team-count]', memberCountLabel(team.memberCount));
  setText(card, '[data-team-initials]', teamInitials(team.name));
  qs('[data-team-pips]', card)?.style.setProperty('--count', String(team.memberCount));
  setImage(card, { ...team, imageUrl: team.imageUrl ?? null });
  setMascot(card, team.mascot ?? null);
  setPeople(card, team.members ?? []);
}

// nomes de quem está na equipe: um <li> por pessoa, sempre como texto
function setPeople(card: HTMLElement, members: readonly string[]): void {
  const list = qs<HTMLElement>('[data-team-people]', card);
  if (!list) return;
  list.replaceChildren(
    ...members.map((name) => {
      const li = document.createElement('li');
      li.textContent = personName(name);
      return li;
    }),
  );
  list.hidden = members.length === 0;
}

// equipe do sorteio dos nomes: círculo com a cor do tipo (o CSS do TeamCard faz o resto)
function setMascot(card: HTMLElement, mascot: PublicTeam['mascot']): void {
  card.classList.toggle('is-mascot', mascot !== null);
  if (mascot) card.style.setProperty('--type', typeColor(mascot.types));
  else card.style.removeProperty('--type');
}
