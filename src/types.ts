export interface Plataforma {
  id: string;
  nome: string;
  comissao: number;
  comissaoAfiliado: number;
  taxaFixa: number;
  freteFixo: number;
  logo: string;
  cor?: string;
  textoCor?: string;
}

export interface CustoAdicional {
  id: string;
  nome: string;
  valor: number;
}

// NOVA REGRA: Modelo para salvar os custos globais no banco
export interface CustoPadrao {
  id: string;
  nome: string;
  valor: number;
  icone: string;
}

export interface Produto {
  id: string;
  foto: string;
  titulo: string;
  categoria?: string;
  custoAds?: number;
  custoBase: number;
  custosAdicionais: CustoAdicional[];
  custoTotal: number;
  tipoLucro: 'porcentagem' | 'reais';
  valorLucro: number;
  isKit?: boolean;
}