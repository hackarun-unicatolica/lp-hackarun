import type { DrawParticipant, DrawResult } from '@domain/index';

// o nome sorteado de uma equipe
export interface TeamNameAssignment {
  number: number;
  name: string;
  pokemonId: number;
}

// uma equipe já gravada na planilha (aba Equipes + coluna Equipe da aba Inscritos)
export interface SavedTeam {
  // "Equipe 7" -> 7: a ordem do sorteio das equipes, que não muda quando a equipe ganha nome
  number: number;
  // nome atual: "Equipe 7" até o sorteio dos nomes, depois "Equipe Charizard"
  name: string;
  // Pokémon sorteado (número da Pokédex) ou null enquanto a equipe ainda é só "Equipe 7"
  pokemonId: number | null;
  // já aparece na página pública /equipes (status "confirmado" na aba Equipes)
  published: boolean;
  members: { id: string; name: string }[];
}

// porta de saída do sorteio: a planilha (Apps Script no dia, a cópia local da planilha nos testes). Quem usa não
// sabe qual é. Só a organização usa isto: nada daqui vai no site público
export interface DrawGateway {
  // credenciados (Status = credenciado) com o que o sorteio precisa; quem já tem equipe também vem (o caso de uso avisa)
  loadAccredited(): Promise<DrawParticipant[]>;
  loadSavedTeams(): Promise<SavedTeam[]>;
  // nome da planilha quando ela é de ensaio ("Cópia de Teste ..."); null na planilha oficial
  loadTestLabel(): Promise<string | null>;
  // grava Equipe N em cada pessoa e cria as equipes. replace = apaga antes o sorteio anterior (só se nenhuma equipe
  // já ganhou nome)
  saveTeams(result: DrawResult, options: { replace: boolean }): Promise<void>;
  // renomeia "Equipe N" para o nome sorteado, nas duas abas, e guarda o Pokémon (logo da equipe). Várias equipes vão num
  // pedido só (a planilha confere tudo e grava tudo, ou nada)
  saveTeamNames(items: readonly TeamNameAssignment[]): Promise<void>;
  // confirma as equipes do sorteio: elas passam a aparecer em /equipes, com o Pokémon de logo
  publishTeams(): Promise<void>;
}

export class DrawGatewayError extends Error {
  readonly kind: 'network' | 'unauthorized' | 'conflict' | 'server';

  constructor(kind: DrawGatewayError['kind'], message: string) {
    super(message);
    this.name = 'DrawGatewayError';
    this.kind = kind;
  }
}
