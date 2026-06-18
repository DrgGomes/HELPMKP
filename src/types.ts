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

export interface CustoPadrao {
  id: string;
  nome: string;
  valor: number;
  icone: string;
}

export interface Categoria {
  id: string;
  nome: string;
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

// NOVAS REGRAS: FORNECEDORES E COMPRAS (FLUXO DE CAIXA)
export interface Fornecedor {
  id: string;
  nome: string;
  contato: string;
  categoriaInsumo: string; // Ex: Couro, Borracha, Peças Metálicas, Embalagens
}

export interface ItemCompra {
  produtoId: string;
  nome: string;
  quantidade: number;
  custoUnitario: number;
  subtotal: number;
}

export interface Compra {
  id: string;
  fornecedorId: string;
  fornecedorNome: string;
  dataCompra: string;
  itens: ItemCompra[];
  valorTotal: number;
  statusPagamento: 'pago' | 'pendente';
}