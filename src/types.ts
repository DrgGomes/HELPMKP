export interface Plataforma { id: string; nome: string; comissao: number; comissaoAfiliado: number; taxaFixa: number; freteFixo: number; logo: string; cor?: string; textoCor?: string; }
export interface CustoAdicional { id: string; nome: string; valor: number; }
export interface CustoPadrao { id: string; nome: string; valor: number; icone: string; }
export interface Categoria { id: string; nome: string; }
export interface Produto { id: string; foto: string; titulo: string; codigo: string; categoria?: string; custoAds?: number; custoBase: number; custosAdicionais: CustoAdicional[]; custoTotal: number; tipoLucro: 'porcentagem' | 'reais'; valorLucro: number; isKit?: boolean; estoque?: number; estoqueMinimo?: number; }
export interface Fornecedor { id: string; nome: string; contato: string; categoriaInsumo: string; }
export interface ItemCompra { produtoId: string; nome: string; quantidade: number; custoUnitario: number; subtotal: number; }
export interface Compra { id: string; codigoOrdem: string; statusChegada: 'aguardando' | 'recebido'; fornecedorId: string; fornecedorNome: string; dataCompra: string; dataPagamento?: string; numeroVale?: string; itens: ItemCompra[]; valorTotal: number; statusPagamento: 'pago' | 'pendente'; }

// ATUALIZADO: O Lançamento agora sabe exatamente de qual compra ele veio!
export interface LancamentoFinanceiro { 
  id: string; 
  tipo: 'receita' | 'despesa'; 
  descricao: string; 
  valor: number; 
  dataVencimento: string; 
  status: 'pago' | 'pendente'; 
  categoria: string;
  fornecedorId?: string; // NOVO: Pra filtrar devendo por fornecedor
  compraId?: string;     // NOVO: Pra abrir o Vale e ver os itens
}