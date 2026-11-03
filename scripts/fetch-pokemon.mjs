// baixa uma vez os Pokémon da 1ª e 2ª geração da PokeAPI (https://pokeapi.co): nome, tipos e a arte oficial, que vira um
// WebP pequeno em public/pokemon/<número>.webp. O sorteio dos nomes das equipes e a página /equipes usam só os arquivos
// locais (nada de chamar a PokeAPI ao vivo: o evento não depende de internet de terceiros e quem visita o site não
// manda o IP pra outro servidor). Rodar de novo só se a lista mudar: node scripts/fetch-pokemon.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// 100 Pokémon das gerações 1 e 2 com cara de equipe de competição (sem os fofinhos, como Igglybuff e Celebi):
// número da Pokédex -> nome como aparece na tela
const POKEMON = {
  1: 'Bulbasaur',
  2: 'Ivysaur',
  3: 'Venusaur',
  4: 'Charmander',
  5: 'Charmeleon',
  6: 'Charizard',
  7: 'Squirtle',
  8: 'Wartortle',
  9: 'Blastoise',
  15: 'Beedrill',
  16: 'Pidgey',
  18: 'Pidgeot',
  22: 'Fearow',
  24: 'Arbok',
  26: 'Raichu',
  28: 'Sandslash',
  31: 'Nidoqueen',
  34: 'Nidoking',
  38: 'Ninetales',
  42: 'Golbat',
  52: 'Meowth',
  53: 'Persian',
  55: 'Golduck',
  57: 'Primeape',
  58: 'Growlithe',
  59: 'Arcanine',
  62: 'Poliwrath',
  64: 'Kadabra',
  65: 'Alakazam',
  66: 'Machop',
  68: 'Machamp',
  73: 'Tentacruel',
  74: 'Geodude',
  76: 'Golem',
  78: 'Rapidash',
  82: 'Magneton',
  91: 'Cloyster',
  92: 'Gastly',
  95: 'Onix',
  99: 'Kingler',
  105: 'Marowak',
  106: 'Hitmonlee',
  107: 'Hitmonchan',
  110: 'Weezing',
  112: 'Rhydon',
  115: 'Kangaskhan',
  116: 'Horsea',
  121: 'Starmie',
  123: 'Scyther',
  125: 'Electabuzz',
  126: 'Magmar',
  127: 'Pinsir',
  128: 'Tauros',
  129: 'Magikarp',
  130: 'Gyarados',
  131: 'Lapras',
  134: 'Vaporeon',
  135: 'Jolteon',
  136: 'Flareon',
  137: 'Porygon',
  141: 'Kabutops',
  142: 'Aerodactyl',
  143: 'Snorlax',
  144: 'Articuno',
  145: 'Zapdos',
  146: 'Moltres',
  148: 'Dragonair',
  149: 'Dragonite',
  150: 'Mewtwo',
  154: 'Meganium',
  155: 'Cyndaquil',
  156: 'Quilava',
  157: 'Typhlosion',
  158: 'Totodile',
  159: 'Croconaw',
  160: 'Feraligatr',
  168: 'Ariados',
  169: 'Crobat',
  181: 'Ampharos',
  195: 'Quagsire',
  196: 'Espeon',
  197: 'Umbreon',
  202: 'Wobbuffet',
  207: 'Gligar',
  208: 'Steelix',
  212: 'Scizor',
  214: 'Heracross',
  217: 'Ursaring',
  227: 'Skarmory',
  228: 'Houndour',
  229: 'Houndoom',
  230: 'Kingdra',
  232: 'Donphan',
  237: 'Hitmontop',
  243: 'Raikou',
  244: 'Entei',
  245: 'Suicune',
  248: 'Tyranitar',
  249: 'Lugia',
  250: 'Ho-Oh',
};

const API = 'https://pokeapi.co/api/v2/pokemon';
const OUT_IMAGES = new URL('../public/pokemon/', import.meta.url);
const OUT_CATALOG = new URL('../src/infrastructure/content/pokemon.json', import.meta.url);
const SIZE = 256;

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function fetchOne(id) {
  const data = await getJson(`${API}/${id}`);
  const art = data.sprites?.other?.['official-artwork']?.front_default;
  if (!art) throw new Error(`#${id}: sem arte oficial`);
  const image = await fetch(art);
  if (!image.ok) throw new Error(`#${id}: imagem HTTP ${image.status}`);
  const webp = await sharp(Buffer.from(await image.arrayBuffer()))
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  await writeFile(new URL(`${id}.webp`, OUT_IMAGES), webp);
  return { id, name: POKEMON[id], types: data.types.map((t) => t.type.name), bytes: webp.length };
}

await mkdir(OUT_IMAGES, { recursive: true });
const ids = Object.keys(POKEMON).map(Number);
const catalog = [];
// poucos pedidos de cada vez: a PokeAPI pede uso moderado
for (let i = 0; i < ids.length; i += 5) {
  const batch = await Promise.all(ids.slice(i, i + 5).map(fetchOne));
  catalog.push(...batch);
  process.stdout.write(`${catalog.length}/${ids.length}\r`);
}
const total = catalog.reduce((sum, p) => sum + p.bytes, 0);
await writeFile(
  OUT_CATALOG,
  `${JSON.stringify(
    catalog.map(({ id, name, types }) => ({ id, name, types })),
    null,
    2,
  )}\n`,
);
console.log(`\n${catalog.length} Pokémon, ${(total / 1024).toFixed(0)} KB de imagens em public/pokemon/`);
