import React, { useState, useMemo } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Produto, Plataforma, CustoAdicional, CustoPadrao, Categoria } from '../types';

interface ProdutosProps {
  telaAtiva: string;
  setTelaAtiva: (tela: string) => void;
  produtos: Produto[];
  plataformas: Plataforma[];
  custosPadrao: CustoPadrao[];
  categorias: Categoria[];
}

export default function Produtos({ telaAtiva, setTelaAtiva, produtos, plataformas, custosPadrao, categorias }: ProdutosProps) {
  const [buscaProduto, setBuscaProduto] = useState('');
  const [filtroPlataforma, setFiltroPlataforma] = useState('todas');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  
  // Garantindo que sempre tenha uma categoria para selecionar no formulário
  const listaCategorias = categorias.length > 0 ? categorias.map(c => c.nome).sort() : ['Geral'];

  const [idProdEdicao, setIdProdEdicao] = useState<string | null>(null);
  const [fotoProd, setFotoProd] = useState('');
  const [tituloProd, setTituloProd] = useState('');
  const [categoriaProd, setCategoriaProd] = useState(listaCategorias[0]);
  const [custoBaseProd, setCustoBaseProd] = useState('');
  const [custoAdsProd, setCustoAdsProd] = useState('0');
  const [custosAdicionais, setCustosAdicionais] = useState<CustoAdicional[]>([]);
  const [tipoLucro, setTipoLucro] = useState<'porcentagem' | 'reais'>('reais');
  const [valorLucro, setValorLucro] = useState('');

  const adicionarCustoExtra = () => setCustosAdicionais([...custosAdicionais, { id: Date.now().toString(), nome: '', valor: 0 }]);
  
  const adicionarCustoRapido = (padrao: CustoPadrao) => {
    setCustosAdicionais([...custosAdicionais, { id: Date.now().toString() + Math.random().toString(), nome: padrao.nome, valor: padrao.valor }]);
  };

  const atualizarCustoExtra = (id: string, campo: 'nome' | 'valor', novoValor: string) => {
    setCustosAdicionais(custosAdicionais.map(c => c.id === id ? { ...c, [campo]: campo === 'valor' ? parseFloat(novoValor) || 0 : novoValor } : c));
  };
  const removerCustoExtra = (id: string) => setCustosAdicionais(custosAdicionais.filter(c => c.id !== id));

  const calcularCustoTotalAoVivo = () => {
    const base = parseFloat(custoBaseProd) || 0;
    const extras = custosAdicionais.reduce((acc, curr) => acc + (parseFloat(curr.valor.toString()) || 0), 0);
    return base + extras;
  };

  const lidarSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloProd || !custoBaseProd || !valorLucro) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    const baseFormatada = parseFloat(custoBaseProd);
    const extrasFormatados: CustoAdicional[] = custosAdicionais.filter(c => c.nome.trim() !== '').map(c => ({ id: c.id, nome: c.nome, valor: parseFloat(c.valor.toString()) || 0 }));
    const total = baseFormatada + extrasFormatados.reduce((acc, curr) => acc + curr.valor, 0);

    const dadosProduto: Partial<Produto> = {
      foto: fotoProd || `https://ui-avatars.com/api/?name=${encodeURIComponent(tituloProd)}&background=e2e8f0&color=475569&size=150`,
      titulo: tituloProd,
      categoria: categoriaProd,
      custoBase: baseFormatada,
      custosAdicionais: extrasFormatados,
      custoAds: parseFloat(custoAdsProd) || 0,
      custoTotal: total,
      tipoLucro,
      valorLucro: parseFloat(valorLucro)
    };

    try {
      if (idProdEdicao) await setDoc(doc(db, 'usuarios', userId, 'produtos', idProdEdicao as string), dadosProduto);
      else await addDoc(collection(db, 'usuarios', userId, 'produtos'), dadosProduto);
      limparFormProduto();
      setTelaAtiva('produtos_lista');
    } catch (error) { console.error(error); }
  };

  const iniciarEdicaoProduto = (prod: Produto) => {
    setIdProdEdicao(prod.id);
    setFotoProd(prod.foto.includes('ui-avatars') ? '' : prod.foto);
    setTituloProd(prod.titulo);
    setCategoriaProd(prod.categoria || listaCategorias[0]);
    setCustoBaseProd(prod.custoBase.toString());
    setCustoAdsProd(prod.custoAds?.toString() || '0');
    setCustosAdicionais(prod.custosAdicionais || []);
    setTipoLucro(prod.tipoLucro);
    setValorLucro(prod.valorLucro.toString());
    setTelaAtiva('produto_cadastro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicarProduto = async (prod: Produto) => {
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;
    const { id, ...dadosSemId } = prod;
    await addDoc(collection(db, 'usuarios', userId, 'produtos'), { ...dadosSemId, titulo: `${prod.titulo} (Cópia)` });
  };

  const limparFormProduto = () => {
    setIdProdEdicao(null); setFotoProd(''); setTituloProd(''); setCategoriaProd(listaCategorias[0]); 
    setCustoBaseProd(''); setCustoAdsProd('0'); setCustosAdicionais([]); setTipoLucro('reais'); setValorLucro('');
  };

  const lidarExcluirProduto = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Excluir este produto?")) await deleteDoc(doc(db, 'usuarios', userId, 'produtos', id));
  };

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = p.titulo.toLowerCase().includes(buscaProduto.toLowerCase());
      const matchCategoria = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
      return matchBusca && matchCategoria;
    });
  }, [produtos, buscaProduto, filtroCategoria]);

  const plataformasFiltradas = useMemo(() => filtroPlataforma === 'todas' ? plataformas : plataformas.filter(p => p.id === filtroPlataforma), [plataformas, filtroPlataforma]);

  const calcularPrecoVenda = (produto: Produto, plat: Plataforma) => {
    const C = produto.custoTotal + (produto.custoAds || 0) + plat.taxaFixa + plat.freteFixo;
    const P_taxas = (plat.comissao + plat.comissaoAfiliado) / 100;
    if (produto.tipoLucro === 'reais') {
      const divisor = 1 - P_taxas;
      return divisor <= 0 ? null : (C + produto.valorLucro) / divisor;
    } else {
      const divisor = 1 - P_taxas - (produto.valorLucro / 100);
      return divisor <= 0 ? null : C / divisor;
    }
  };

  if (telaAtiva === 'produto_cadastro') {
    return (
      <div className="animate-fade-in max-w-4xl mx-auto">
        <header className="mb-6 md:mb-10"><h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{idProdEdicao ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h2></header>
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={lidarSalvarProduto} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Título do Produto</label>
                <input type="text" required value={tituloProd} onChange={(e) => setTituloProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Categoria</label>
                <select value={categoriaProd} onChange={(e) => setCategoriaProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-700">
                  {listaCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">URL da Foto (Opcional)</label>
                <input type="url" value={fotoProd} onChange={(e) => setFotoProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5">
              <h4 className="text-base font-black text-slate-800 flex items-center gap-2"><span>🏭</span> Estrutura de Custos</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Custo Base (R$)</label><input type="number" required step="0.01" value={custoBaseProd} onChange={(e) => setCustoBaseProd(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-lg text-slate-700" placeholder="0.00" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Custo de Ads/Venda (R$)</label><input type="number" step="0.01" value={custoAdsProd} onChange={(e) => setCustoAdsProd(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-lg text-slate-700" placeholder="0.00" /></div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <label className="block text-sm font-bold text-slate-700">Custos Variáveis</label>
                  <button type="button" onClick={adicionarCustoExtra} className="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold hover:bg-blue-200 shadow-sm">+ Custo Manual</button>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-5">
                  {custosPadrao.length === 0 ? <span className="text-xs text-slate-400 italic">Nenhum atalho criado.</span> : (
                    custosPadrao.map((padrao) => (
                      <button key={padrao.id} type="button" onClick={() => adicionarCustoRapido(padrao)} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-1.5 shadow-sm">
                        <span>{padrao.icone}</span> {padrao.nome} (+R$ {padrao.valor.toFixed(2)})
                      </button>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  {custosAdicionais.map((custo) => (
                    <div key={custo.id} className="flex gap-3 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                      <input type="text" placeholder="Nome do custo" value={custo.nome} onChange={(e) => atualizarCustoExtra(custo.id, 'nome', e.target.value)} className="flex-1 px-3 py-2 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none" />
                      <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                        <span className="text-slate-400 font-bold text-sm">R$</span>
                        <input type="number" step="0.01" value={custo.valor} onChange={(e) => atualizarCustoExtra(custo.id, 'valor', e.target.value)} className="w-24 px-2 py-2 bg-transparent border-none focus:ring-0 text-sm font-bold outline-none" />
                      </div>
                      <button type="button" onClick={() => removerCustoExtra(custo.id)} className="w-8 h-8 bg-rose-50 text-rose-500 rounded-lg font-bold hover:bg-rose-100">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center bg-slate-900 p-5 rounded-xl shadow-inner"><span className="text-sm font-bold text-slate-300 uppercase tracking-widest">Custo Total:</span><span className="text-2xl font-black text-white">R$ {calcularCustoTotalAoVivo().toFixed(2)}</span></div>
            </div>

            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-4">
              <h4 className="text-base font-black text-emerald-800 flex items-center gap-2"><span>🎯</span> Meta de Lucro</h4>
              <div className="flex gap-3">
                <select value={tipoLucro} onChange={(e) => setTipoLucro(e.target.value as any)} className="w-1/3 px-4 py-3 border border-emerald-200 rounded-xl bg-white text-emerald-900 font-bold outline-none"><option value="reais">Lucro em (R$)</option><option value="porcentagem">Margem em (%)</option></select>
                <input type="number" required step="0.01" value={valorLucro} onChange={(e) => setValorLucro(e.target.value)} className="w-2/3 px-4 py-3 border border-emerald-200 rounded-xl bg-white font-black text-lg text-emerald-900 outline-none" placeholder={tipoLucro === 'reais' ? 'Ex: 25.00' : 'Ex: 15'} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button type="submit" className="flex-1 text-white py-4 rounded-xl font-black text-lg bg-blue-600 hover:bg-blue-700 shadow-lg transition-all">Salvar Estratégia</button>
              <button type="button" onClick={() => { limparFormProduto(); setTelaAtiva('produtos_lista'); }} className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-10">
        <div><h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Meus Produtos</h2></div>
        <button onClick={() => { setTelaAtiva('produto_cadastro'); limparFormProduto(); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2"><span>➕</span> Novo Produto</button>
      </header>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span><input type="text" placeholder="Buscar por título..." value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm" /></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative min-w-[200px]"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">📂</span><select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none font-bold text-sm text-slate-700 appearance-none"><option value="todas">Todas as Categorias</option>{listaCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
          <div className="relative min-w-[200px]"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🛍️</span><select value={filtroPlataforma} onChange={(e) => setFiltroPlataforma(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none font-bold text-sm text-slate-700 appearance-none"><option value="todas">Ver todas plataformas</option>{plataformas.map(p => <option key={p.id} value={p.id}>Apenas {p.nome}</option>)}</select></div>
        </div>
      </div>

      {produtosFiltrados.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl text-center border border-dashed border-slate-300"><div className="text-4xl mb-4">📦</div><h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum produto encontrado</h3></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {produtosFiltrados.map((prod) => (
            <div key={prod.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-4 right-4 z-10"><span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-full">{prod.categoria || 'Sem categoria'}</span></div>
              
              <div className="flex justify-between items-start mb-5 pb-5 border-b border-slate-100 mt-2">
                <div className="flex gap-4 items-center w-full pr-12">
                  <img src={prod.foto} alt="" onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(prod.titulo)}&background=e2e8f0`} className="w-20 h-20 rounded-xl object-cover bg-slate-50 border border-slate-200 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-800 text-lg leading-tight mb-2 truncate" title={prod.titulo}>{prod.titulo}</h4>
                    
                    {/* BAdges Principais */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-bold">Custo Base: R$ {prod.custoTotal.toFixed(2)}</span>
                      {(prod.custoAds || 0) > 0 && <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md font-bold">Ads: R$ {(prod.custoAds || 0).toFixed(2)}</span>}
                      <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md font-black">Meta: {prod.tipoLucro === 'reais' ? `R$ ${prod.valorLucro.toFixed(2)}` : `${prod.valorLucro}%`}</span>
                    </div>

                    {/* VIZUALIZAÇÃO DOS CUSTOS VARIÁVEIS (O que você pediu!) */}
                    {prod.custosAdicionais && prod.custosAdicionais.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                        {prod.custosAdicionais.map((c, i) => (
                          <span key={i} className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            {c.nome}: <strong className="text-slate-700">R$ {c.valor.toFixed(2)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mb-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button onClick={() => iniciarEdicaoProduto(prod)} className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100">✏️ Editar Detalhes</button>
                <button onClick={() => duplicarProduto(prod)} className="w-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100">📄</button>
                <button onClick={() => lidarExcluirProduto(prod.id)} className="w-10 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl border border-rose-100 hover:bg-rose-100">🗑️</button>
              </div>

              <div className="mt-auto bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl border-t border-slate-100">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Preço Sugerido por Marketplace:</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {plataformasFiltradas.map(plat => {
                    const precoVenda = calcularPrecoVenda(prod, plat);
                    return (
                      <div key={plat.id} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300">
                        <div className="flex items-center gap-2 mb-2"><img src={plat.logo} alt="" className="w-5 h-5 rounded-full border border-slate-100" /><span className="text-xs font-bold text-slate-700 truncate">{plat.nome}</span></div>
                        {precoVenda === null ? <div className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1.5 rounded-lg border border-rose-100 text-center">Inviável</div> : <div className="text-lg font-black text-emerald-600">R$ {precoVenda.toFixed(2)}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}