import React, { useState, useMemo } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Produto, Plataforma, CustoPadrao, Categoria, CustoAdicional } from '../types';

interface ProdutosProps {
  telaAtiva: string;
  setTelaAtiva: (tela: string) => void;
  produtos: Produto[];
  plataformas: Plataforma[];
  custosPadrao: CustoPadrao[];
  categorias: Categoria[];
}

// --- SUB-COMPONENTE: CARTÃO DE PRODUTO DINÂMICO ---
const CartaoProduto = ({ 
  produto, 
  plataformas, 
  aoEditar, 
  aoExcluir 
}: { 
  produto: Produto, 
  plataformas: Plataforma[], 
  aoEditar: (p: Produto) => void, 
  aoExcluir: (id: string) => void 
}) => {
  const [lucroSimulado, setLucroSimulado] = useState<number>(produto.valorLucro);
  const [salvando, setSalvando] = useState(false);

  const calcularPrecoVenda = (plat: Plataforma) => {
    const comissaoDecimal = (plat.comissao + (plat.comissaoAfiliado || 0)) / 100;
    if (comissaoDecimal >= 1) return 0;
    
    const margem = produto.tipoLucro === 'porcentagem' 
      ? produto.custoTotal * (lucroSimulado / 100) 
      : lucroSimulado;
      
    return (produto.custoTotal + margem + (plat.taxaFixa || 0) + (plat.freteFixo || 0)) / (1 - comissaoDecimal);
  };

  const alterouMeta = lucroSimulado !== produto.valorLucro;

  const salvarNovaMeta = async () => {
    setSalvando(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      await updateDoc(doc(db, 'usuarios', userId, 'produtos', produto.id), {
        valorLucro: Number(lucroSimulado)
      });
      // O Firebase vai disparar o listener e atualizar a tela sozinho
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar a nova meta.");
    }
    setSalvando(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 border border-slate-200/60 p-4 sm:p-5 flex flex-col sm:flex-row gap-5 relative overflow-hidden group">
      {/* Marcador lateral sutil */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

      {/* Esquerda: Imagem e Ação */}
      <div className="w-full sm:w-36 flex flex-col gap-3 shrink-0">
        <div className="aspect-square bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden p-2">
          {produto.foto ? (
            <img src={produto.foto} alt={produto.titulo} className="w-full h-full object-contain rounded-lg drop-shadow-sm mix-blend-multiply" />
          ) : (
            <span className="text-4xl opacity-50">📦</span>
          )}
        </div>
        <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
          <span>🛒</span> Vender
        </button>
      </div>

      {/* Direita: Dados e Simulador */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Cabeçalho do Cartão */}
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-slate-800 text-lg uppercase leading-tight truncate">{produto.titulo}</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {produto.categoria || 'Geral'}
            </p>
          </div>
          
          {/* Botões de Ação */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1.5 bg-amber-50 text-amber-600 font-black text-[10px] rounded-lg border border-amber-100 uppercase tracking-widest flex items-center gap-1">
              <span>📦</span> {produto.estoque || 0} UN
            </span>
            <button onClick={() => aoEditar(produto)} className="w-8 h-8 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center justify-center text-slate-500 transition-colors border border-slate-200 hover:border-indigo-200">
              ✏️
            </button>
            <button onClick={() => aoExcluir(produto.id)} className="w-8 h-8 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-lg flex items-center justify-center text-slate-500 transition-colors border border-slate-200 hover:border-rose-200">
              ✕
            </button>
          </div>
        </div>

        {/* Engine Financeiro (Edição Rápida) */}
        <div className="mt-4 bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex flex-wrap items-center gap-4 sm:gap-6 relative">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Custo Total</span>
            <span className="font-black text-slate-800 text-sm">R$ {produto.custoTotal.toFixed(2)}</span>
          </div>

          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

          <div className="flex flex-col flex-1">
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              Meta Limpa ({produto.tipoLucro === 'reais' ? 'R$' : '%'}) ✏️
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={lucroSimulado}
                onChange={e => setLucroSimulado(Number(e.target.value))}
                className="w-24 bg-white border border-emerald-200 text-emerald-700 font-black text-sm rounded-lg px-2 py-1 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-center shadow-inner"
              />
              {alterouMeta && (
                <button onClick={salvarNovaMeta} disabled={salvando} className="px-4 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm transition-all animate-fade-in flex items-center gap-1">
                  {salvando ? '⏳' : '💾 Salvar'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grid de Preços de Venda Vivo */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
          {plataformas.map(plat => {
            const preco = calcularPrecoVenda(plat);
            return (
              <div key={plat.id} className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-center hover:border-indigo-300 transition-colors shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm drop-shadow-sm">{plat.logo}</span>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">{plat.nome}</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-800 text-sm">R$ {preco.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};


// --- COMPONENTE PRINCIPAL (LISTA E FORMULÁRIO) ---
export default function Produtos({ telaAtiva, setTelaAtiva, produtos, plataformas, custosPadrao, categorias }: ProdutosProps) {
  
  // Estados para Lista
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Estados para Formulário
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [foto, setFoto] = useState('');
  const [titulo, setTitulo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [custoBase, setCustoBase] = useState('');
  const [estoque, setEstoque] = useState('');
  const [tipoLucro, setTipoLucro] = useState<'porcentagem' | 'reais'>('reais');
  const [valorLucro, setValorLucro] = useState('');
  const [custosSelecionados, setCustosSelecionados] = useState<CustoAdicional[]>([]);
  const [processando, setProcessando] = useState(false);

  // Inicializa o formulário se for edição
  React.useEffect(() => {
    if (produtoEditando && telaAtiva === 'produto_cadastro') {
      setFoto(produtoEditando.foto || '');
      setTitulo(produtoEditando.titulo);
      setCodigo(produtoEditando.codigo);
      setCategoria(produtoEditando.categoria || '');
      setCustoBase(produtoEditando.custoBase.toString());
      setEstoque(produtoEditando.estoque?.toString() || '');
      setTipoLucro(produtoEditando.tipoLucro);
      setValorLucro(produtoEditando.valorLucro.toString());
      setCustosSelecionados(produtoEditando.custosAdicionais || []);
    } else if (telaAtiva === 'produto_cadastro' && !produtoEditando) {
      limparFormulario();
    }
  }, [produtoEditando, telaAtiva]);

  const limparFormulario = () => {
    setFoto(''); setTitulo(''); setCodigo(''); setCategoria(''); setCustoBase(''); setEstoque('');
    setTipoLucro('reais'); setValorLucro(''); setCustosSelecionados([]); setProdutoEditando(null);
  };

  const lidarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setProcessando(true);
    try {
      const custoTotal = Number(custoBase) + custosSelecionados.reduce((acc, curr) => acc + Number(curr.valor), 0);
      
      const dadosProduto = {
        foto,
        titulo: titulo.toUpperCase(),
        codigo: codigo.toUpperCase(),
        categoria,
        custoBase: Number(custoBase),
        estoque: Number(estoque) || 0,
        tipoLucro,
        valorLucro: Number(valorLucro),
        custosAdicionais: custosSelecionados,
        custoTotal
      };

      if (produtoEditando) {
        await updateDoc(doc(db, 'usuarios', userId, 'produtos', produtoEditando.id), dadosProduto);
        alert("✅ Produto atualizado!");
      } else {
        await addDoc(collection(db, 'usuarios', userId, 'produtos'), dadosProduto);
        alert("✅ Produto criado!");
      }
      
      setTelaAtiva('produtos_lista');
      limparFormulario();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar produto.");
    }
    setProcessando(false);
  };

  const excluirProduto = async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    if (window.confirm("Certeza que deseja excluir este produto?")) {
      await deleteDoc(doc(db, 'usuarios', userId, 'produtos', id));
    }
  };

  const iniciarEdicao = (produto: Produto) => {
    setProdutoEditando(produto);
    setTelaAtiva('produto_cadastro');
  };

  // Filtragem da Lista
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = p.titulo.toLowerCase().includes(busca.toLowerCase()) || p.codigo.toLowerCase().includes(busca.toLowerCase());
      const matchCat = filtroCategoria ? p.categoria === filtroCategoria : true;
      return matchBusca && matchCat;
    });
  }, [produtos, busca, filtroCategoria]);


  // ==========================================
  // RENDER: LISTA DE PRODUTOS (COM NOVO CARTÃO)
  // ==========================================
  if (telaAtiva === 'produtos_lista') {
    return (
      <div className="animate-fade-in space-y-6 max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <span>📦</span> Meu Estoque
            </h2>
            <p className="text-slate-500 font-medium mt-1 text-sm">Gerencie e simule preços do seu portfólio.</p>
          </div>
          <button 
            onClick={() => { setProdutoEditando(null); setTelaAtiva('produto_cadastro'); }} 
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> Novo Produto
          </button>
        </header>

        {/* Barra de Pesquisa */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar por nome ou código..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="sm:w-64">
            <select 
              value={filtroCategoria} 
              onChange={e => setFiltroCategoria(e.target.value)} 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-indigo-500"
            >
              <option value="">Todas as Categorias</option>
              {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Renderização dos Cartões Reformulados */}
        {produtosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <span className="text-6xl mb-4 grayscale block opacity-40">📭</span>
            <p className="text-xl font-black text-slate-400">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {produtosFiltrados.map(produto => (
              <CartaoProduto 
                key={produto.id} 
                produto={produto} 
                plataformas={plataformas} 
                aoEditar={iniciarEdicao} 
                aoExcluir={excluirProduto} 
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: FORMULÁRIO DE CADASTRO
  // ==========================================
  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <span>✨</span> {produtoEditando ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <p className="text-slate-500 font-medium mt-1 text-sm">Configure a ficha técnica e a engenharia de custos.</p>
        </div>
        <button onClick={() => setTelaAtiva('produtos_lista')} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
          ✕
        </button>
      </header>

      <form onSubmit={lidarSubmit} className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200 space-y-8">
        
        {/* Foto e Infos Básicas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="sm:col-span-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">URL da Foto</label>
            <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden group">
              {foto ? (
                <img src={foto} alt="Preview" className="w-full h-full object-contain rounded-xl z-0" />
              ) : (
                <span className="text-4xl opacity-50 mb-2">📸</span>
              )}
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <input type="url" placeholder="https://..." value={foto} onChange={e => setFoto(e.target.value)} className="w-full text-xs p-2 bg-white border border-slate-300 rounded font-mono outline-none" />
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Título do Produto *</label>
              <input required type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-indigo-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SKU / Código *</label>
                <input required type="text" value={codigo} onChange={e => setCodigo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estoque</label>
                <input type="number" value={estoque} onChange={e => setEstoque(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                <option value="">Selecione...</option>
                {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Custos e Precificação */}
        <div className="space-y-6">
          <h3 className="font-black text-lg text-slate-800 border-l-4 border-indigo-500 pl-3">Engenharia de Precificação</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Custo de Fábrica (R$) *</label>
              <input required type="number" step="0.01" value={custoBase} onChange={e => setCustoBase(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-lg font-black outline-none focus:border-indigo-500" />
            </div>

            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Meta de Lucro *</label>
                <div className="flex bg-white rounded-lg p-0.5 border border-emerald-200">
                  <button type="button" onClick={() => setTipoLucro('reais')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-colors ${tipoLucro === 'reais' ? 'bg-emerald-500 text-white' : 'text-emerald-600'}`}>R$</button>
                  <button type="button" onClick={() => setTipoLucro('porcentagem')} className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-colors ${tipoLucro === 'porcentagem' ? 'bg-emerald-500 text-white' : 'text-emerald-600'}`}>%</button>
                </div>
              </div>
              <input required type="number" step="0.01" value={valorLucro} onChange={e => setValorLucro(e.target.value)} className="w-full px-4 py-3 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-lg font-black outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Custos Embutidos (Embalagem, Ads, etc)</label>
            <div className="flex flex-wrap gap-2">
              {custosPadrao.map(custo => {
                const selecionado = custosSelecionados.find(c => c.id === custo.id);
                return (
                  <button
                    type="button"
                    key={custo.id}
                    onClick={() => {
                      if (selecionado) setCustosSelecionados(custosSelecionados.filter(c => c.id !== custo.id));
                      else setCustosSelecionados([...custosSelecionados, { id: custo.id, nome: custo.nome, valor: custo.valor }]);
                    }}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${selecionado ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <span>{custo.icone}</span> {custo.nome} <span className="opacity-70">(R$ {custo.valor.toFixed(2)})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button type="submit" disabled={processando} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {processando ? <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> Processando...</> : '💾 Salvar Configurações do Produto'}
          </button>
        </div>
      </form>
    </div>
  );
} 