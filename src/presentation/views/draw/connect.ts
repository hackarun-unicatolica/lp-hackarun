import { createDrawServices, type DrawServices } from '@composition/draw';
import { mustFind } from './dom';

// o que o servidor do `npm run sorteio` diz sobre a cópia de teste
interface LocalConfig {
  label: string;
}

// "1" só no `npm run sorteio` (a integração local define no Vite); no site publicado é sempre a planilha real
const LOCAL = import.meta.env.SORTEIO_LOCAL === '1';

// faixa no topo: na cópia local e nas planilhas de ensaio avisa "CÓPIA DE TESTE"; na planilha oficial não mostra nada
export function showSource(services: DrawServices, testLabel: string | null = null): void {
  const badge = mustFind<HTMLElement>('[data-source]');
  const local = services.source.mode === 'local';
  const label = local ? services.source.label : testLabel;
  badge.hidden = label === null;
  badge.textContent = label === null ? '' : `CÓPIA DE TESTE · ${label}`;
  badge.dataset['mode'] = 'test';
}

// botões que só existem no teste (cópia local): "Recomeçar teste" (equipes e nomes) e "Sortear nomes de novo". Na
// planilha real o serviço nem oferece essas ações, então os botões ficam escondidos
function setupTestButton(
  selector: string,
  action: (() => Promise<void>) | null,
  goTo: string,
  busyLabel: string,
): void {
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button || !action) return;
  const label = button.textContent ?? '';
  button.hidden = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = busyLabel;
    try {
      await action();
      location.href = goTo;
    } catch (error) {
      button.disabled = false;
      button.textContent = label;
      window.alert(error instanceof Error ? error.message : 'Não consegui recomeçar o teste.');
    }
  });
}

// conecta na cópia de teste (npm run sorteio) ou na planilha real (site, pela função da Cloudflare) e confere que ela
// responde. Devolve os serviços prontos
export async function connect(): Promise<DrawServices> {
  if (LOCAL) {
    const config = (await (await fetch('/__sorteio/config')).json()) as LocalConfig;
    const services = createDrawServices({ mode: 'local', label: config.label });
    showSource(services);
    setupTestButton('[data-reset]', services.resetTest, '/sorteio', 'Recomeçando…');
    setupTestButton('[data-reset-names]', services.resetTestNames, '/sorteio/nomes', 'Voltando…');
    return services;
  }
  const services = createDrawServices({ mode: 'site', label: 'planilha do HackaRun' });
  // a faixa só aparece depois de saber qual planilha é (não mostra "oficial" nem "cópia" antes da hora)
  mustFind<HTMLElement>('[data-source]').hidden = true;
  const status = await services.status.execute();
  showSource(services, status.testLabel ?? null);
  return services;
}
