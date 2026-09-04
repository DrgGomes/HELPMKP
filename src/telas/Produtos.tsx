import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit3, Save, RefreshCw, Package, X } from 'lucide-react';
import { supabase } from '../supabase';
import type { CustoPadrao, Categoria, CustoAdicional } from '../types';

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

const PLATAFORMAS_MOCK = [
  { id: 'ml_classico', nome: 'Mercado Livre (Clássico)', comissao: 12, taxaFixa: 6 },
  { id: 'ml_premium', nome: 'Mercado Livre (Premium)', comissao: 16.5, taxaFixa: 6 },
  { id: 'shopee', nome: 'Shopee', comissao: 14, taxaFixa: 4 },
  { id: 'nuvemshop', nome: 'Nuvemshop Direct', comissao: 2, taxaFixa: 0 },
];

interface ProdutosProps {
  custosPadrao: CustoPadrao[];
  categorias: Categoria[];
}

export const Produtos: React.FC<ProdutosProps> = ({ custosPadrao, categorias }) => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busca, setBusca] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [edicoesCard, setEdicoesCard] = useState<{ [id: string]: { tipoLucro: 'porcentagem' | 'reais'; valorLucro: number } }>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    foto: string; titulo: string; codigo: string; categoria: string;
    custoBase: number; custosAdicionais: CustoAdicional[];
    tipoLucro: 'porcentagem' | 'reais'; valorLucro: number; estoque: number;
  }>({
    foto: '', titulo: '', codigo: '', categoria: '', custoBase: 0,
    custosAdicionais: [], tipoLucro: 'porcentagem', valorLucro: 20, estoque: 0,
  });

  const carregarProdutos = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('produtos').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setProdutos(data.map((item: any) => ({
          id: item.id, user_id: item.user_id, foto: item.foto || '', titulo: item.titulo,
          codigo: item.codigo, categoria: item.categoria || '',
          custoBase: Number(item.custo_base || 0), custosAdicionais: item.custos_adicionais || [],
          custoTotal: Number(item.custo_total || 0), tipoLucro: item.tipo_lucro,
          valorLucro: Number(item.valor_lucro || 0), estoque: Number(item.estoque || 0),
        })));
      }
    } catch (err: any) { console.error('Erro ao carregar produtos:', err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregarProdutos(); }, []);

  const calcularCustoTotal = (base: number, adicionais: CustoAdicional[]) => {
    return Number(base) + adicionais.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  };

  const calcularPrecoSugerido = (custoTotal: number, tipoLucro: string, valorLucro: number, comissao: number, taxaFixa: number) => {
    let preco = 0;
    if (tipoLucro === 'porcentagem') {
      preco = (custoTotal / (1 - (comissao / 100))) * (1 + (valorLucro / 100)) + taxaFixa;
    } else {
      preco = (custoTotal + valorLucro) / (1 - (comissao / 100)) + taxaFixa;
    }
    return Math.max(preco, custoTotal + taxaFixa);
  };

  const toggleCustoAdicional = (custo: CustoPadrao) => {
    const existe = form.custosAdicionais.find(c => c.nome === custo.nome);
    if (existe) {
      setForm({ ...form, custosAdicionais: form.custosAdicionais.filter(c => c.nome !== custo.nome) });
    } else {
      setForm({ ...form, custosAdicionais: [...form.custosAdicionais, { id: custo.id, nome: custo.nome, valor: custo.valor }] });
    }
  };

  const handleSalvarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const custoTotalCalc = calcularCustoTotal(form.custoBase, form.custosAdicionais);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      ...(user ? { user_id: user.id } : {}),
      foto: form.foto, titulo: form.titulo, codigo: form.codigo, categoria: form.categoria,
      custo_base: Number(form.custoBase), custos_adicionais: form.custosAdicionais,
      custo_total: custoTotalCalc, tipo_lucro: form.tipoLucro, valor_lucro: Number(form.valorLucro),
      estoque: Number(form.estoque),
    };
    try {
      if (produtoEditando) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', produtoEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('produtos').insert([payload]);
        if (error) throw error;
      }
      setModalAberto(false); resetForm(); carregarProdutos();
    } catch (err: any) { alert('Erro ao salvar produto: ' + err.message); }
    finally { setLoading(false); }
  };

  const salvarEdicaoRapida = async (produto: Produto) => {
    const alteracao = edicoesCard[produto.id];
    if (!alteracao) return;
    setSalvandoId(produto.id);
    try {
      const { error } = await supabase.from('produtos').update({ tipo_lucro: alteracao.tipoLucro, valor_lucro: Number(alteracao.valorLucro) }).eq('id', produto.id);
      if (error) throw error;
      setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, tipoLucro: alteracao.tipoLucro, valorLucro: Number(alteracao.valorLucro) } : p));
      setEdicoesCard(prev => { const cop = { ...prev }; delete cop[produto.id]; return cop; });
    } catch (err: any) { alert('Erro ao salvar alteração: ' + err.message); }
    finally { setSalvandoId(null); }
  };

  const deletarProduto = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      const { error } = await supabase.from('produtos').delete().eq('id', id);
      if (error) throw error;
      setProdutos(prev => prev.filter(p => p.id !== id));
    } catch (err: any) { alert('Erro ao deletar: ' + err.message); }
  };

  const abrirModalEdicao = (produto: Produto) => {
    setProdutoEditando(produto);
    setForm({
      foto: produto.foto, titulo: produto.titulo, codigo: produto.codigo,
      categoria: produto.categoria || '', custoBase: produto.custoBase,
      custosAdicionais: produto.custosAdicionais, tipoLucro: produto.tipoLucro,
      valorLucro: produto.valorLucro, estoque: produto.estoque,
    });
    setModalAberto(true);
  };

  const resetForm = () => {
    setProdutoEditando(null);
    setForm({ foto: '', titulo: '', codigo: '', categoria: '', custoBase: 0, custosAdicionais: [], tipoLucro: 'porcentagem', valorLucro: 20, estoque: 0 });
  };

  const produtosFiltrados = produtos.filter(p => {
    const matchBusca = p.titulo.toLowerCase().includes(busca.toLowerCase()) || p.codigo.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = !filtroCategoria || p.categoria === filtroCategoria;
    return matchBusca && matchCategoria;
  });

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2"><span>📦</span> Gestão de Produtos</h2>
          <p className="text-slate-500 mt-1 text-sm">Simulação dinâmica de preços para marketplaces via Supabase</p>
        </div>
        <button onClick={() => { resetForm(); setModalAberto(true); }} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-3 rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95">
          <Plus className="w-5 h-5" /> Novo Produto
        </button>
      </div>

      {/* BARRA DE PESQUISA + FILTRO */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Buscar por título ou SKU/Código..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-all" />
        </div>
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-700 text-sm font-bold outline-none focus:border-amber-400">
          <option value="">Todas as Categorias</option>
          {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
        </select>
        <button onClick={carregarProdutos} className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:border-amber-300 rounded-2xl text-slate-500 transition-all">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* LISTAGEM */}
      {loading && produtos.length === 0 ? (
        <div className="text-center py-20 text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
          <p className="font-medium">Carregando produtos do Supabase...</p>
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-500">Nenhum produto encontrado</h3>
          <p className="text-sm text-slate-400 mt-1">Cadastre um novo item para ativar o simulador dinâmico.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {produtosFiltrados.map((produto) => {
            const alteracao = edicoesCard[produto.id];
            const tipoLucroAtual = alteracao ? alteracao.tipoLucro : produto.tipoLucro;
            const valorLucroAtual = alteracao ? alteracao.valorLucro : produto.valorLucro;
            return (
              <div key={produto.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow space-y-4">
                {/* TOP: foto + info + actions */}
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {produto.foto ? <img src={produto.foto} alt={produto.titulo} className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {produto.categoria && <span className="inline-block text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider mb-1">{produto.categoria}</span>}
                    <h3 className="text-lg font-black text-slate-800 truncate">{produto.titulo}</h3>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                      <span>Estoque: <strong className="text-slate-700">{produto.estoque} un</strong></span>
                      <span>Custo Total: <strong className="text-amber-600">R$ {produto.custoTotal.toFixed(2)}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirModalEdicao(produto)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => deletarProduto(produto.id)} className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* MARGEM RÁPIDA */}
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                    <button onClick={() => setEdicoesCard({ ...edicoesCard, [produto.id]: { tipoLucro: 'porcentagem', valorLucro: valorLucroAtual } })} className={`px-3 py-1.5 text-[11px] font-black rounded ${tipoLucroAtual === 'porcentagem' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>%</button>
                    <button onClick={() => setEdicoesCard({ ...edicoesCard, [produto.id]: { tipoLucro: 'reais', valorLucro: valorLucroAtual } })} className={`px-3 py-1.5 text-[11px] font-black rounded ${tipoLucroAtual === 'reais' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>R$</button>
                  </div>
                  <input type="number" step="0.01" value={valorLucroAtual} onChange={(e) => setEdicoesCard({ ...edicoesCard, [produto.id]: { tipoLucro: tipoLucroAtual, valorLucro: Number(e.target.value) } })} className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-black text-amber-600 text-center focus:outline-none focus:border-amber-400" />
                  {alteracao && <button onClick={() => salvarEdicaoRapida(produto)} disabled={salvandoId === produto.id} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all"><Save className="w-3 h-3" /> Salvar</button>}
                </div>

                {/* PREÇOS POR PLATAFORMA */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Preço Sugerido por Plataforma</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PLATAFORMAS_MOCK.map((plat) => {
                      const precoFinal = calcularPrecoSugerido(produto.custoTotal, tipoLucroAtual, valorLucroAtual, plat.comissao, plat.taxaFixa);
                      return (
                        <div key={plat.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-between">
                          <span className="text-[11px] text-slate-500 font-medium truncate">{plat.nome}</span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-[10px] text-slate-400 font-bold">{plat.comissao}%</span>
                            <span className="text-sm font-black text-slate-800">R$ {precoFinal.toFixed(2)}</span>
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

      {/* MODAL */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-800">{produtoEditando ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h2>
              <button onClick={() => setModalAberto(false)} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSalvarFormulario} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Título do Produto *</label><input type="text" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:outline-none focus:border-amber-400" placeholder="Ex: Tênis Streetwear Black" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Código / SKU *</label><input type="text" required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:outline-none focus:border-amber-400" placeholder="Ex: TS-BLK-40" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Categoria</label><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:outline-none focus:border-amber-400"><option value="">Sem categoria</option>{categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">URL da Imagem</label><input type="url" value={form.foto} onChange={(e) => setForm({ ...form, foto: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:outline-none focus:border-amber-400" placeholder="https://..." /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Custo Base (R$) *</label><input type="number" step="0.01" required value={form.custoBase} onChange={(e) => setForm({ ...form, custoBase: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:outline-none focus:border-amber-400" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estoque Inicial</label><input type="number" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 font-medium focus:outline-none focus:border-amber-400" /></div>
              </div>

              {/* CUSTOS DE EMBALAGEM */}
              {custosPadrao.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">📦 Custos de Embalagem (clique para adicionar)</span>
                    <span className="text-[10px] text-slate-500 font-bold">Total: R$ {calcularCustoTotal(form.custoBase, form.custosAdicionais).toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {custosPadrao.map(custo => {
                      const selecionado = form.custosAdicionais.find(c => c.nome === custo.nome);
                      return (
                        <button key={custo.id} type="button" onClick={() => toggleCustoAdicional(custo)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${selecionado ? 'bg-indigo-500 border-indigo-400 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                          <span className="text-base">{custo.icone}</span>
                          <span>{custo.nome}</span>
                          <span className={selecionado ? 'text-indigo-200' : 'text-indigo-400'}>R$ {custo.valor.toFixed(2)}</span>
                          {selecionado && <span className="text-emerald-400">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  {form.custosAdicionais.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                      {form.custosAdicionais.map((c, i) => (
                        <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100">{c.nome}: R$ {c.valor.toFixed(2)}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MARGEM DE LUCRO */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Meta de Lucro Inicial</span>
                <div className="flex gap-4 items-center">
                  <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                    <button type="button" onClick={() => setForm({ ...form, tipoLucro: 'porcentagem' })} className={`px-4 py-2 text-xs font-black rounded-lg ${form.tipoLucro === 'porcentagem' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>%</button>
                    <button type="button" onClick={() => setForm({ ...form, tipoLucro: 'reais' })} className={`px-4 py-2 text-xs font-black rounded-lg ${form.tipoLucro === 'reais' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>R$</button>
                  </div>
                  <input type="number" step="0.01" value={form.valorLucro} onChange={(e) => setForm({ ...form, valorLucro: Number(e.target.value) })} className="w-32 bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-amber-600 font-black focus:outline-none focus:border-amber-400" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalAberto(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black shadow-lg shadow-amber-500/20 disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar Produto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};