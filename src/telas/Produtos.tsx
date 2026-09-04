import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Save, 
  RefreshCw, 
  DollarSign, 
  Package, 
  Tag, 
  X, 
  TrendingUp, 
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../supabase'; // Instância do cliente Supabase

// --- Interfaces de Tipagem ---
export interface CustoAdicional {
  nome: string;
  valor: number;
}

export interface Produto {
  id: string;
  user_id?: string;
  foto: string;
  titulo: string;
  codigo: string;
  categoria?: string;
  custoBase: number;
  custosAdicionais: CustoAdicional[];
  custoTotal: number;
  tipoLucro: 'porcentagem' | 'reais';
  valorLucro: number;
  estoque: number;
}

// Simulador de Taxas Globais das Plataformas
const PLATAFORMAS_MOCK = [
  { id: 'ml_classico', nome: 'Mercado Livre (Clássico)', comissao: 12, taxaFixa: 6 },
  { id: 'ml_premium', nome: 'Mercado Livre (Premium)', comissao: 16.5, taxaFixa: 6 },
  { id: 'shopee', nome: 'Shopee', comissao: 14, taxaFixa: 4 },
  { id: 'nuvemshop', nome: 'Nuvemshop Direct', comissao: 2, taxaFixa: 0 },
];

export const Produtos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busca, setBusca] = useState<string>('');
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);

  // Estado temporário para edições rápidas de margem diretamente nos cards
  const [edicoesCard, setEdicoesCard] = useState<{ [id: string]: { tipoLucro: 'porcentagem' | 'reais'; valorLucro: number } }>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  // Estado do Formulário (Novo / Edição)
  const [form, setForm] = useState<{
    foto: string;
    titulo: string;
    codigo: string;
    categoria: string;
    custoBase: number;
    custosAdicionais: CustoAdicional[];
    tipoLucro: 'porcentagem' | 'reais';
    valorLucro: number;
    estoque: number;
  }>({
    foto: '',
    titulo: '',
    codigo: '',
    categoria: '',
    custoBase: 0,
    custosAdicionais: [],
    tipoLucro: 'porcentagem',
    valorLucro: 20,
    estoque: 0,
  });

  // 1. CARREGAR PRODUTOS DO SUPABASE
  const carregarProdutos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Mapeia de snake_case (banco) para camelCase (React)
        const produtosFormatados: Produto[] = data.map((item) => ({
          id: item.id,
          user_id: item.user_id,
          foto: item.foto || '',
          titulo: item.titulo,
          codigo: item.codigo,
          categoria: item.categoria || '',
          custoBase: Number(item.custo_base || 0),
          custosAdicionais: item.custos_adicionais || [],
          custoTotal: Number(item.custo_total || 0),
          tipoLucro: item.tipo_lucro as 'porcentagem' | 'reais',
          valorLucro: Number(item.valor_lucro || 0),
          estoque: Number(item.estoque || 0),
        }));

        setProdutos(produtosFormatados);
      }
    } catch (err: any) {
      console.error('Erro ao carregar produtos do Supabase:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, []);

  // 2. CÁLCULOS AUXILIARES
  const calcularCustoTotal = (base: number, adicionais: CustoAdicional[]) => {
    const somaAdicionais = adicionais.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    return Number(base) + somaAdicionais;
  };

  const calcularPrecoSugerido = (custoTotal: number, tipoLucro: 'porcentagem' | 'reais', valorLucro: number, comissaoPct: number, taxaFixa: number) => {
    const lucroDesejado = tipoLucro === 'porcentagem' ? custoTotal * (valorLucro / 100) : valorLucro;
    const margemDisponivel = 1 - comissaoPct / 100;
    
    if (margemDisponivel <= 0) return 0;
    
    const precoSugerido = (custoTotal + lucroDesejado + taxaFixa) / margemDisponivel;
    return precoSugerido;
  };

  // 3. SALVAR / EDITAR RÁPIDO NO CARD (SUPABASE UPDATE)
  const handleAlterarLucroCard = (id: string, tipoLucro: 'porcentagem' | 'reais', valorLucro: number) => {
    setEdicoesCard(prev => ({
      ...prev,
      [id]: { tipoLucro, valorLucro }
    }));
  };

  const salvarEdicaoRapida = async (produto: Produto) => {
    const alteracao = edicoesCard[produto.id];
    if (!alteracao) return;

    setSalvandoId(produto.id);
    try {
      const { error } = await supabase
        .from('produtos')
        .update({
          tipo_lucro: alteracao.tipoLucro,
          valor_lucro: Number(alteracao.valorLucro),
        })
        .eq('id', produto.id);

      if (error) throw error;

      // Atualiza o estado local para sincronizar
      setProdutos(prev => prev.map(p => p.id === produto.id ? {
        ...p,
        tipoLucro: alteracao.tipoLucro,
        valorLucro: Number(alteracao.valorLucro)
      } : p));

      // Limpa do estado de edições temporárias
      setEdicoesCard(prev => {
        const cop = { ...prev };
        delete cop[produto.id];
        return cop;
      });
    } catch (err: any) {
      alert('Erro ao salvar alteração: ' + err.message);
    } finally {
      setSalvandoId(null);
    }
  };

  // 4. DELETAR PRODUTO (SUPABASE DELETE)
  const deletarProduto = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProdutos(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Erro ao deletar: ' + err.message);
    }
  };

  // 5. SALVAR FORMULÁRIO COMPLETO (SUPABASE INSERT / UPDATE)
  const handleSalvarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const custoTotalCalc = calcularCustoTotal(form.custoBase, form.custosAdicionais);

    // Obtém o usuário logado para associar ao RLS
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      ...(user ? { user_id: user.id } : {}),
      foto: form.foto,
      titulo: form.titulo,
      codigo: form.codigo,
      categoria: form.categoria,
      custo_base: Number(form.custoBase),
      custos_adicionais: form.custosAdicionais,
      custo_total: custoTotalCalc,
      tipo_lucro: form.tipoLucro,
      valor_lucro: Number(form.valorLucro),
      estoque: Number(form.estoque),
    };

    try {
      if (produtoEditando) {
        // Atualizar produto existente
        const { error } = await supabase
          .from('produtos')
          .update(payload)
          .eq('id', produtoEditando.id);

        if (error) throw error;
      } else {
        // Inserir novo produto
        const { error } = await supabase
          .from('produtos')
          .insert([payload]);

        if (error) throw error;
      }

      setModalAberto(false);
      resetForm();
      carregarProdutos();
    } catch (err: any) {
      alert('Erro ao salvar produto: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalEdicao = (produto: Produto) => {
    setProdutoEditando(produto);
    setForm({
      foto: produto.foto,
      titulo: produto.titulo,
      codigo: produto.codigo,
      categoria: produto.categoria || '',
      custoBase: produto.custoBase,
      custosAdicionais: produto.custosAdicionais,
      tipoLucro: produto.tipoLucro,
      valorLucro: produto.valorLucro,
      estoque: produto.estoque,
    });
    setModalAberto(true);
  };

  const resetForm = () => {
    setProdutoEditando(null);
    setForm({
      foto: '',
      titulo: '',
      codigo: '',
      categoria: '',
      custoBase: 0,
      custosAdicionais: [],
      tipoLucro: 'porcentagem',
      valorLucro: 20,
      estoque: 0,
    });
  };

  // Filtro de Busca por Título ou Código
  const produtosFiltrados = produtos.filter(p => 
    p.titulo.toLowerCase().includes(busca.toLowerCase()) || 
    p.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">
            Gestão de Produtos & Precificação
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Simulação dinâmica em tempo real para marketplaces via Supabase
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setModalAberto(true); }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Novo Produto
        </button>
      </div>

      {/* BARRA DE PESQUISA & ESTATÍSTICAS RÁPIDAS */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por título ou SKU/Código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-2xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
          />
        </div>
        <button
          onClick={carregarProdutos}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 rounded-2xl text-slate-300 transition-all"
          title="Recarregar dados"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* LISTAGEM DE CARDS DE PRODUTOS */}
      {loading && produtos.length === 0 ? (
        <div className="text-center py-20 text-slate-500 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
          <p>Conectando ao Supabase e calculando margens...</p>
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60 p-8">
          <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">Nenhum produto encontrado</h3>
          <p className="text-sm text-slate-500 mt-1">Cadastre um novo item para ativar o simulador dinâmico.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {produtosFiltrados.map((produto) => {
            const alteracao = edicoesCard[produto.id];
            const tipoLucroAtual = alteracao ? alteracao.tipoLucro : produto.tipoLucro;
            const valorLucroAtual = alteracao ? alteracao.valorLucro : produto.valorLucro;
            const temAlteracaoPendente = !!alteracao;

            return (
              <div 
                key={produto.id}
                className="bg-slate-900/80 rounded-3xl border border-slate-800/80 p-6 space-y-5 hover:border-slate-700/60 transition-all shadow-xl backdrop-blur-md relative overflow-hidden group"
              >
                {/* TOPO DO CARD: FOTO + TÍTULO + AÇÕES */}
                <div className="flex gap-4 items-start">
                  <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                    {produto.foto ? (
                      <img src={produto.foto} alt={produto.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-700" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {produto.codigo}
                      </span>
                      {produto.categoria && (
                        <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-lg">
                          {produto.categoria}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-100 truncate mt-1">{produto.titulo}</h3>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>Estoque: <strong className="text-slate-200">{produto.estoque} un</strong></span>
                      <span>Custo Base: <strong className="text-slate-200">R$ {produto.custoBase.toFixed(2)}</strong></span>
                      <span>Custo Total: <strong className="text-amber-400">R$ {produto.custoTotal.toFixed(2)}</strong></span>
                    </div>
                  </div>

                  {/* AÇÕES (EDITAR / EXCLUIR) */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirModalEdicao(produto)}
                      className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-amber-400 transition-colors"
                      title="Editar Detalhes"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deletarProduto(produto.id)}
                      className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-colors"
                      title="Excluir Produto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* PAINEL DE MARGEM / META LIMPA (EDIÇÃO RÁPIDA VIVA) */}
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-slate-300">Meta Limpa (Lucro):</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* TOGGLE % OU R$ */}
                    <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => handleAlterarLucroCard(produto.id, 'porcentagem', valorLucroAtual)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                          tipoLucroAtual === 'porcentagem' 
                            ? 'bg-amber-500 text-slate-950 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAlterarLucroCard(produto.id, 'reais', valorLucroAtual)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                          tipoLucroAtual === 'reais' 
                            ? 'bg-amber-500 text-slate-950 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        R$
                      </button>
                    </div>

                    {/* INPUT DO VALOR DA META */}
                    <input
                      type="number"
                      value={valorLucroAtual}
                      onChange={(e) => handleAlterarLucroCard(produto.id, tipoLucroAtual, Number(e.target.value))}
                      className="w-20 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs font-bold text-amber-300 text-center focus:outline-none focus:border-amber-400"
                    />

                    {/* BOTÃO SALVAR RÁPIDO (SÓ APARECE SE MODIFICADO) */}
                    {temAlteracaoPendente && (
                      <button
                        onClick={() => salvarEdicaoRapida(produto)}
                        disabled={salvandoId === produto.id}
                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1 rounded-xl text-xs shadow-md transition-all animate-pulse"
                      >
                        {salvandoId === produto.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Salvar
                      </button>
                    )}
                  </div>
                </div>

                {/* GRADE DE PREÇOS SUGERIDOS EM TEMPO REAL */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Preço Sugerido por Plataforma
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {PLATAFORMAS_MOCK.map((plat) => {
                      const precoFinal = calcularPrecoSugerido(
                        produto.custoTotal,
                        tipoLucroAtual,
                        valorLucroAtual,
                        plat.comissao,
                        plat.taxaFixa
                      );

                      return (
                        <div 
                          key={plat.id}
                          className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-2.5 flex flex-col justify-between"
                        >
                          <span className="text-[11px] text-slate-400 font-medium truncate">{plat.nome}</span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-xs text-slate-500">{plat.comissao}%</span>
                            <span className="text-sm font-bold text-slate-100">
                              R$ {precoFinal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PRODUTO */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-amber-400">
                {produtoEditando ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h2>
              <button 
                onClick={() => setModalAberto(false)}
                className="p-1 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarFormulario} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Título do Produto *</label>
                  <input
                    type="text"
                    required
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="Ex: Tênis Streetwear Black Oversized"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Código / SKU *</label>
                  <input
                    type="text"
                    required
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="Ex: TS-BLK-40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Categoria</label>
                  <input
                    type="text"
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="Ex: Calçados"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">URL da Imagem (ImgBB)</label>
                  <input
                    type="url"
                    value={form.foto}
                    onChange={(e) => setForm({ ...form, foto: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="https://i.ibb.co/..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Custo Base (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.custoBase}
                    onChange={(e) => setForm({ ...form, custoBase: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    value={form.estoque}
                    onChange={(e) => setForm({ ...form, estoque: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

              </div>

              {/* SEÇÃO DE MARGEM DE LUCRO */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Meta de Lucro Inicial</span>
                <div className="flex gap-4 items-center">
                  <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tipoLucro: 'porcentagem' })}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg ${form.tipoLucro === 'porcentagem' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      Porcentagem (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tipoLucro: 'reais' })}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg ${form.tipoLucro === 'reais' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    value={form.valorLucro}
                    onChange={(e) => setForm({ ...form, valorLucro: Number(e.target.value) })}
                    className="w-32 bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-amber-300 font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* RODAPÉ DO MODAL */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20"
                >
                  {loading ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};