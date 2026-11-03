import type { ImageMetadata } from 'astro';
import unicatolicaLogo from '../../../assets/brand/unicatolica-white.png';
import capimLogo from '../../../assets/brand/capim-dourado-white.png';
import prontoLogo from '../../../assets/brand/pronto-fibra-white.png';
import toHostLogo from '../../../assets/brand/tohost-white.png';
import wpiLogo from '../../../assets/brand/wpi-white.png';
import playerLogo from '../../../assets/brand/player-contabilidade.png';
import pontoAgilLogo from '../../../assets/brand/ponto-agil-white.png';
import impostogramaLogo from '../../../assets/brand/impostograma.png';
import brInfoLogo from '../../../assets/brand/br-info-white.png';
import maxdataLogo from '../../../assets/brand/maxdata.png';
import quantumLogo from '../../../assets/brand/quantum-white.png';

// patrocinadores na ordem da seção: os 3 em destaque (featured) primeiro, depois as placas médias.
// Novo patrocinador: logo sem fundo (versão clara) em src/assets/brand e mais um item aqui. height = altura da logo no desktop em rem (marca larga pede menos, quadrada pede mais);
// accent = cor da marca usada no brilho da placa e no painel "Sobre"
export interface Sponsor {
  id: string;
  name: string;
  logo: ImageMetadata;
  height: number;
  accent: string;
  url: string;
  // texto do "Sobre", um item por parágrafo
  about: string[];
  // destaque = placa grande na primeira fileira; o resto entra nas placas médias
  featured?: boolean;
  caption?: string;
}

export const SPONSORS: readonly Sponsor[] = [
  {
    id: 'capim-dourado',
    featured: true,
    name: 'Capim Dourado Shopping',
    logo: capimLogo,
    height: 5.5,
    accent: '#ffc24a',
    url: 'https://www.capimdouradosc.com.br/shopping/',
    caption: 'Palco da grande final',
    about: [
      'Inaugurado em 2010, o Capim Dourado Shopping deu início a um novo capítulo na história de Palmas e do Tocantins. O Capim, como é chamado por aqui, possui espaços que proporcionam novos e marcantes momentos, além de um mix de lojas completo com: serviços, moda, gastronomia e entretenimento.',
      'O empreendimento traz um conceito inspirado nos grandes centros comerciais do país, oferecendo uma experiência que reúne não só compras e lazer, mas também eventos que valorizam a cultura local. Tudo isso, o torna o local favorito dos tocantinenses e de turistas que chegam para apreciar as belezas do nosso estado.',
    ],
  },
  {
    id: 'pronto-fibra',
    featured: true,
    name: 'Pronto Fibra',
    logo: prontoLogo,
    height: 4,
    accent: '#f5b82a',
    url: 'https://prontofibra.com.br/',
    about: [
      'A Pronto Fibra é uma empresa de telecomunicações sediada em Palmas, Tocantins, especializada em oferecer soluções de conectividade por meio de internet de fibra óptica. Com atuação no mercado desde 2016, a empresa vem ampliando sua presença na região, levando tecnologia, velocidade e conexão para residências e empresas.',
      'Com foco em qualidade, inovação e atendimento próximo ao cliente, a Pronto Fibra investe em infraestrutura de ponta, oferecendo planos de alta velocidade, conexão simétrica e suporte técnico especializado 24 horas por dia. Seu compromisso é proporcionar uma experiência de conectividade eficiente e confiável, acompanhando as necessidades de um mundo cada vez mais digital.',
    ],
  },
  {
    id: 'unicatolica',
    featured: true,
    name: 'UniCatólica',
    logo: unicatolicaLogo,
    height: 5.5,
    accent: '#3b82f6',
    url: 'https://to.catolica.edu.br/portal/',
    about: [
      'Criada dia 25 de novembro de 1999, pela 56ª Assembleia Geral da União Brasileira de Educação Católica, a Católica do Tocantins, teve em Reunião Extraordinária da Diretoria da UBEC, em 04 de abril 2002, provisoriamente, nomeados, como Diretora Geral, a Prof.ª Débora Pinto Niquini, como Vice-Diretor Administrativo, o Prof. José Cardoso de Sousa, como Vice-Diretor de Planejamento e Desenvolvimento, o Prof. Bruno de Azevedo Costa e como Vice-Diretor de Ensino, Pesquisa e Extensão, o Prof. Pe. Duile de Assis Castro. Na 193ª Reunião da Diretoria da UBEC, do dia 16 e 17 de dezembro de 2002, foram nomeados, em definitivo, respectivamente, como Diretor Geral e Vice-Diretor administrativo, o Prof. Luiz Antônio Hunold de Oliveira Damas, e o Prof. Rocco Procida.',
      'Em 2019 o Ministro da Educação, Abraham Weintraub, assinou no dia 31 de maio, o documento que credencia a Católica do Tocantins como Centro Universitário. Com a publicação da portaria no Diário Oficial da União a Católica do Tocantins passa a se chamar UniCatólica – Centro Universitário Católica do Tocantins.',
    ],
  },
  {
    id: 'player',
    name: 'Player Contabilidade',
    logo: playerLogo,
    height: 3.6,
    accent: '#e9a91b',
    url: 'https://playercontabilidade.com/',
    about: [
      'A Player Contabilidade é uma das maiores referências em soluções contábeis do Centro-Norte do Brasil. Com mais de 1.600 clientes e 120 colaboradores, oferecemos muito mais que contabilidade: atuamos de forma estratégica nas áreas tributária, financeira e de gestão empresarial, ajudando empresas a crescer com segurança, organização e inteligência. Nosso compromisso é transformar a contabilidade em uma ferramenta de crescimento para os negócios.',
    ],
  },
  {
    id: 'ponto-agil',
    name: 'Ponto Ágil',
    logo: pontoAgilLogo,
    height: 4.8,
    accent: '#5cc84a',
    url: 'https://portal.pontoagil.com.br/',
    about: [
      'A Ponto Ágil é uma solução de controle de ponto e gestão da jornada que ajuda empresas a organizar melhor a rotina do RH, reduzir retrabalho e acompanhar informações como horários, banco de horas, horas extras e escalas de forma simples e centralizada. Mais do que registrar ponto, a Ponto Ágil transforma dados da jornada em mais controle para a empresa e mais agilidade para a gestão.',
    ],
  },
  {
    id: 'impostograma',
    name: 'Impostograma',
    logo: impostogramaLogo,
    height: 3,
    accent: '#7b5cff',
    url: 'https://impostograma.com/',
    about: [
      'O Impostograma é uma plataforma de gestão, automação e produtividade para escritórios contábeis. Ela centraliza clientes, processos, documentos, prazos, financeiro e automações fiscais e contábeis em um único ambiente, ajudando as equipes a reduzir tarefas manuais, ganhar mais controle da operação e trabalhar com mais eficiência e previsibilidade.',
    ],
  },
  {
    id: 'tohost',
    name: 'TO Host',
    logo: toHostLogo,
    height: 3.6,
    accent: '#5dbb63',
    url: 'https://tohost.com.br/',
    about: [
      'O primeiro data center Rated 3 do Tocantins.',
      'Somos o parceiro estratégico que assegura segurança, performance e escalabilidade para a infraestrutura digital de empresas e instituições do Norte do Brasil.',
    ],
  },
  {
    id: 'wpi',
    name: 'WPI Soluções',
    logo: wpiLogo,
    height: 4.4,
    accent: '#3fb058',
    url: 'https://wpisolucoes.com.br/sobre',
    about: [
      'Empresa tocantinense, com atuação em todo o Brasil.',
      'Transformamos desafios em oportunidades por meio da tecnologia, da infraestrutura de TIC a soluções personalizadas para a transformação digital.',
    ],
  },
  {
    id: 'br-informatica',
    name: 'BR Informática',
    logo: brInfoLogo,
    height: 2.2,
    accent: '#1fb554',
    url: 'https://www.lojabrinformatica.com.br/',
    about: [
      'A BR Informática é uma empresa de tecnologia sediada em Palmas, Tocantins, especializada no fornecimento de equipamentos, produtos e acessórios de informática. Com atuação voltada ao mercado regional, oferece soluções que abrangem desde computadores, hardware e periféricos até equipamentos de redes, impressão, telefonia e tecnologia gamer.',
      'Além da comercialização de produtos, atua nos segmentos de segurança residencial e predial, manutenção e suporte técnico em TI empresarial, atendendo às diferentes necessidades de clientes e organizações. Com foco em inovação, variedade e qualidade no atendimento, a BR Informática busca aproximar pessoas e empresas das soluções tecnológicas, contribuindo para o desenvolvimento e a transformação digital da região.',
    ],
  },
  {
    id: 'maxdata',
    name: 'MaxData',
    logo: maxdataLogo,
    height: 3.2,
    accent: '#e0262c',
    url: 'https://maxdata.com.br/',
    about: [
      'A MaxData Sistemas é uma empresa brasileira de tecnologia com sede em Palmas (TO) e atuação nacional, especializada no desenvolvimento de sistemas de gestão empresarial integrados (softwares ERP). Fundada em 2002, a empresa atua prestando suporte tecnológico e soluções de automação comercial focadas em otimizar e simplificar a operação de pequenas e médias empresas em diversos segmentos de mercado.',
      'Formalmente registrada no setor de tecnologia, a atividade principal da MaxData envolve o desenvolvimento, suporte técnico, comercialização e implantação de softwares de gestão empresarial (ERP).',
      'A atuação central da empresa baseia-se em:',
      'Automação de Processos Comerciais: fornecimento de ferramentas para faturamento, controle de estoque, frente de caixa (PDV) e gestão financeira.',
      'Conformidade Fiscal: emissão de documentos fiscais eletrônicos (NF-e, NFC-e, NFS-e, CT-e, MDF-e, SAT) e integração com exigências regulatórias, como o SNGPC (para farmácias) e obrigações acessórias (EFD ICMS/IPI, EFD Contribuições).',
      'Consultoria e Diagnóstico Personalizado: avaliação das necessidades operacionais de cada cliente para alinhar a implementação do software às metas do negócio.',
    ],
  },
  {
    id: 'quantum',
    name: 'Quantum',
    logo: quantumLogo,
    height: 3.4,
    accent: '#3b82f6',
    url: 'https://home.quantumsistemas.com.br/',
    about: [
      'A Quantum é uma empresa de tecnologia fundada em Palmas, Tocantins, especializada no desenvolvimento de soluções de software para gestão empresarial. Com mais de 20 anos de experiência no mercado, a empresa tem como propósito simplificar a rotina dos negócios por meio da tecnologia, oferecendo ferramentas que tornam a administração mais prática, eficiente e segura.',
      'Seu principal produto é um sistema de gestão empresarial (ERP) que integra diferentes setores de uma empresa, como vendas, estoque, financeiro e fiscal, reunindo informações em uma única plataforma. A solução atende a diversos segmentos do comércio e serviços, adaptando-se às necessidades de cada negócio.',
      'Além da tecnologia, ela valoriza o atendimento próximo aos clientes, oferecendo suporte especializado, implantação e treinamento. Seu compromisso é utilizar a inovação para otimizar processos, facilitar a tomada de decisões e contribuir para o crescimento das empresas.',
    ],
  },
];

// "https://www.lojabrinformatica.com.br/" -> "lojabrinformatica.com.br" (rótulo curto do botão do site)
export const siteLabel = (url: string): string =>
  url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? url;

export const FEATURED_SPONSORS = SPONSORS.filter((sponsor) => sponsor.featured);
export const OTHER_SPONSORS = SPONSORS.filter((sponsor) => !sponsor.featured);
