import type { GemsDeviceStore, GemsGateway } from '@application/gems/GemsPorts';
import { browserStorage, GemsStore } from '@infrastructure/gems/GemsStore';
import { SiteGemsGateway } from '@infrastructure/gems/SiteGemsGateway';

// tela /gemas: planilha pela função da Cloudflare e o armazenamento do navegador do aparelho
export function createGemsServices(): { gateway: GemsGateway; store: GemsDeviceStore } {
  return { gateway: new SiteGemsGateway(), store: new GemsStore(browserStorage()) };
}
