// src/types.ts
export interface Plataforma {
  id: string;
  nome: string;
  comissao: number;
  comissaoAfiliado: number;
  taxaFixa: number;
  freteFixo: number;
  logo: string;
}

export interface Produto {
  id: string;
  nome: string;
  precoCusto: number;
  categoria: string; // Nova categoria
  plataformaId: string;
  precoVenda: number;
  custoAds?: number; // Simulador de Ads
  isKit?: boolean;
  produtosKit?: string[]; // IDs dos produtos que compõem o kit
}
