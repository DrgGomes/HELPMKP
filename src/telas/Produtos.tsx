import React, { useState, useMemo } from 'react';
import { collection, doc, deleteDoc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Produto, Plataforma, CustoPadrao, Categoria } from '../types';

interface ProdutosProps {
  telaAtiva: string;
  setTelaAtiva: (tela: string) => void;
  produtos: Produto[];
  plataformas: Plataforma[];
  custosPadrao: CustoPadrao[];
  categorias: Categoria[];
}

export default function Produtos({ telaAtiva, setTelaAtiva, produtos, plataformas, custosPadrao, categorias }: ProdutosProps) {
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [ordem, setOrdem] = useState<'recentes' | 'estoque_baixo' | 'lucro_alto'>('recentes');

  // Simulador de Meta na própria listagem
  const [metasSimuladas, setMetasSimuladas] = useState<Record<string, string>>({});

  // PDV Express
  const [pdvModal, setPdvModal] = useState<Produto | null>(null);
  const [pdvQtd, setPdvQtd] = useState<number>(1);
  const [pdvPlataforma, setPdvPlataforma] = useState<string>('');
  const [pdvValorFinal, setPdvValorFinal] = useState<string>('');
  const [processandoVenda, setProcessandoVenda] = useState(false);

  // Estados do Formulário de Cadastro/Edição
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [foto, setFoto] = useState('');
  const [titulo, setTitulo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [custoBase, setCustoBase] = useState('');
  const [custosAtivos, setCustosAtivos] = useState<string[]>([]);
  const [tipoLucro, setTipoLucro] = useState<'porcentagem' | 'reais'>('reais');
  const [valorLucro, setValorLucro] = useState('');
  const [estoque, setEstoque] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');

  // LÓGICA DE EDIÇÃO EM MASSA DE ESTOQUE (Enterprise 5.0)
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [estoqueLote, setEstoqueLote] = useState('');
  const [operacaoLote, setOperacaoLote] = useState<'definir' | 'somar'>('definir');
  const [processandoLote, setProcessandoLote] = useState(false);

  const limparFormulario = () => {
    setIdEdicao(null); setFoto(''); setTitulo(''); setCodigo('');
    setCategoriaSelecionada(''); setCustoBase(''); setCustosAtivos([]);
    setTipoLucro('reais'); setValorLucro(''); setEstoque(''); setEstoqueMinimo('');
  };

  const calcularPrecoVendaCard = (produto: Produto, plat: Plataforma) => {
    const metaDoInput = metasSimuladas[produto.id] !== undefined ? parseFloat(metasSimuladas[produto.id]) || 0 : produto.valorLucro;
    
    const lucroReal = produto.tipoLucro === 'porcentagem' && metasSimuladas[produto.id] === undefined 
      ? produto.custoTotal * (produto.valorLucro / 100) 
      : metaDoInput;

    const comissaoDecimal = (plat.comissao + (plat.comissaoAfiliado || 0)) / 100;
    if (comissaoDecimal >= 1) return 0;
    const taxasFixas = (plat.taxaFixa || 0) + (plat.freteFixo || 0);
    return (produto.custoTotal + lucroReal + taxasFixas) / (1 - comissaoDecimal);
  };

  const registrarVendaPDV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdvModal || !pdvValorFinal) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;

    setProcessandoVenda(true);
    try {
      const novoEstoque = Math.max(0, (pdvModal.estoque || 0) - pdvQtd);
      await updateDoc(doc(db, 'usuarios', userId, 'produtos', pdvModal.id), { estoque: novoEstoque });

      const platNome = plataformas.find(p => p.id === pdvPlataforma)?.nome || 'Venda Direta / Balcão';
      await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), {
        tipo: 'receita',
        descricao: `Venda: ${pdvModal.titulo} (${pdvQtd}x) - ${platNome}`,
        valor: parseFloat(pdvValorFinal),
        dataVencimento: new Date().toISOString().split('T')[0],
        dataLancamento: new Date().toISOString().split('T')[0],
        status: 'pago',
        categoria: 'Vendas de Produtos',
        produtoId: pdvModal.id
      });

      alert("🎉 Venda registrada com sucesso! Caixa e Estoque atualizados.");
      setPdvModal(null);
      setPdvQtd(1);
      setPdvValorFinal('');
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar a venda.");
    }
    setProcessandoVenda(false);
  };

  const iniciarEdicao = (produto: Produto) => {
    setIdEdicao(produto.id);
    setFoto(produto.foto || '');
    setTitulo(produto.titulo);
    setCodigo(produto.codigo || '');
    setCategoriaSelecionada(produto.categoria || '');
    setCustoBase(produto.custoBase.toString());
    setCustosAtivos(produto.custosAdicionais ? produto.custosAdicionais.map(c => c.id) : []);
    setTipoLucro(produto.tipoLucro || 'reais');
    setValorLucro(produto.valorLucro.toString());
    setEstoque((produto.estoque || 0).toString());
    setEstoqueMinimo((produto.estoqueMinimo || 0).toString());
    setModoSelecao(false);
    setTelaAtiva('produto_cadastro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ajustarEstoqueRapido = async (produto: Produto) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    const novo = window.prompt(`Ajuste Rápido de Estoque para:\n${produto.titulo}\n\nDigite a nova quantidade total:`, (produto.estoque || 0).toString());
    
    if (novo !== null && novo.trim() !== '') {
      const qtd = parseInt(novo);
      if (!isNaN(qtd) && qtd >= 0) {
        await updateDoc(doc(db, 'usuarios', userId, 'produtos', produto.id), { estoque: qtd });
      } else {
        alert("Quantidade inválida. Digite apenas números válidos.");
      }
    }
  };

  // --- FUNÇÕES DE LOTE (MÁGICA) ---
  const selecionarTodos = () => {
    if (selecionados.length === produtosFiltrados.length) setSelecionados([]);
    else setSelecionados(produtosFiltrados.map(p => p.id));
  };

  const aplicarEstoqueEmMassa = async () => {
    if (selecionados.length === 0) return alert("Selecione pelo menos um produto na lista.");
    if (estoqueLote === '') return alert("Digite o valor para atualizar o estoque.");
    
    const qtdLote = parseInt(estoqueLote);
    if (isNaN(qtdLote)) return alert("Valor inválido. Digite apenas números.");
    
    const userId = auth.currentUser?.uid as string; if (!userId) return;

    setProcessandoLote(true);
    try {
      const batch = writeBatch(db);
      
      selecionados.forEach(id => {
        const ref = doc(db, 'usuarios', userId, 'produtos', id);
        
        if (operacaoLote === 'definir') {
          // Zera o passado e define o número absoluto
          batch.update(ref, { estoque: Math.max(0, qtdLote) });
        } else {
          // Operação 'somar' (Se digitar negativo, ele subtrai)
          const prodAtual = produtos.find(p => p.id === id);
          const estoqueExistente = prodAtual?.estoque || 0;
          const novoEstoqueSomado = Math.max(0, estoqueExistente + qtdLote);
          batch.update(ref, { estoque: novoEstoqueSomado });
        }
      });

      await batch.commit();
      alert(`✅ Buffer Executado! Estoque de ${selecionados.length} produtos atualizado.`);
      setModoSelecao(false); 
      setSelecionados([]); 
      setEstoqueLote('');
    } catch (error) {
      console.error(error); 
      alert("Falha ao gravar os dados em lote.");
    }
    setProcessandoLote(false);
  };

  const lidarExcluir = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Excluir produto definitivamente?")) await deleteDoc(doc(db, 'usuarios', userId, 'produtos', id));
  };

  const lidarSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    
    const numCustoBase = parseFloat(custoBase) || 0;
    const cAdicionais = custosPadrao.filter(c => custosAtivos.includes(c.id)).map(c => ({ id: c.id, nome: c.nome, valor: c.valor }));
    const totalAdicionais = cAdicionais.reduce((acc, c) => acc + c.valor, 0);
    const custoTotalFinal = numCustoBase + totalAdicionais;
    
    const produtoDados = {
      foto, titulo, codigo, categoria: categoriaSelecionada, custoBase: numCustoBase,
      custosAdicionais: cAdicionais, custoTotal: custoTotalFinal, tipoLucro,
      valorLucro: parseFloat(valorLucro) || 0, estoque: parseInt(estoque) || 0, estoqueMinimo: parseInt(estoqueMinimo) || 0
    };

    if (idEdicao) {
      await updateDoc(doc(db, 'usuarios', userId, 'produtos', idEdicao), produtoDados);
      alert("Produto atualizado com sucesso!");
    } else {
      await addDoc(collection(db, 'usuarios', userId, 'produtos'), produtoDados);
      alert("Produto cadastrado na esteira!");
    }
    
    limparFormulario();
    setTelaAtiva('produtos_lista');
  };

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = p.titulo.toLowerCase().includes(busca.toLowerCase()) || p.codigo.toLowerCase().includes(busca.toLowerCase());
      const matchCat = categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro;
      return matchBusca && matchCat;
    }).sort((a, b) => {
      if (ordem === 'estoque_baixo') return (a.estoque || 0) - (b.estoque || 0);
      if (ordem === 'lucro_alto') return b.valorLucro - a.valorLucro;
      return 0; 
    });
  }, [produtos, busca, categoriaFiltro, ordem]);

  if (telaAtiva === 'produto_cadastro') {
    return (
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-fade-in pb-32">
        <h2 className="text-3xl font-black text-slate-800 mb-2">{idEdicao ? 'Edição de Produto' : 'Engenharia de Produto'}</h2>
        <p className="text-slate-500 mb-8 font-medium">Cadastre insumos, defina a embalagem e a meta para alimentar o algoritmo de inteligência.</p>
        
        <form onSubmit={lidarSalvarProduto} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase text-slate-400">Identificação Base</label>
              <input type="text" required placeholder="Nome / Título do Produto" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
              <div className="flex gap-4">
                <input type="text" placeholder="Código (Ex: REF-01)" value={codigo} onChange={e => setCodigo(e.target.value)} className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                <select value={categoriaSelecionada} onChange={e => setCategoriaSelecionada(e.target.value)} className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700">
                  <option value="">Categoria...</option>
                  {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <input type="url" placeholder="URL da Imagem (Opcional)" value={foto} onChange={e => setFoto(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
            </div>

            <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <label className="block text-[10px] font-black uppercase text-slate-400">Controle Logístico</label>
              <div className="flex gap-4">
                <div className="w-1/2"><p className="text-xs font-bold text-slate-500 mb-1">Estoque Inicial</p><input type="number" required placeholder="0" value={estoque} onChange={e => setEstoque(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-blue-600" /></div>
                <div className="w-1/2"><p className="text-xs font-bold text-slate-500 mb-1">Alerta de Falta</p><input type="number" required placeholder="Min" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-rose-500" /></div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-8">
            <h3 className="text-lg font-black text-slate-800 mb-4">Estrutura de Custos (Custo de Fábrica)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">Custo Fixo de Produção / Compra</p>
                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">R$</span><input type="number" step="0.01" required value={custoBase} onChange={e => setCustoBase(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-2xl text-slate-800 outline-none focus:border-blue-500 transition-colors" /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 h-48 overflow-y-auto">
                <p className="text-xs font-bold text-slate-500 mb-3">Custos de Embalagem & Variáveis (Somados ao Custo)</p>
                {custosPadrao.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100"><input type="checkbox" checked={custosAtivos.includes(c.id)} onChange={(e) => { if(e.target.checked) setCustosAtivos([...custosAtivos, c.id]); else setCustosAtivos(custosAtivos.filter(id => id !== c.id)); }} className="w-5 h-5 accent-blue-600 rounded" /><span className="text-xl">{c.icone}</span><span className="flex-1 font-bold text-sm text-slate-700">{c.nome}</span><span className="font-black text-blue-600 text-sm">+ R$ {c.valor.toFixed(2)}</span></label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex-1 w-full z-10">
              <h3 className="text-lg font-black text-white mb-2 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span> Meta de Lucro Limpo</h3>
              <p className="text-slate-400 text-xs font-medium mb-4">Este é o valor que o algoritmo vai proteger ao calcular os preços nos marketplaces.</p>
              <div className="flex bg-slate-800 p-1.5 rounded-xl mb-4 border border-slate-700">
                <button type="button" onClick={() => setTipoLucro('reais')} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${tipoLucro === 'reais' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Valor Fixo (R$)</button>
                <button type="button" onClick={() => setTipoLucro('porcentagem')} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${tipoLucro === 'porcentagem' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Margem (%)</button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50 font-black">{tipoLucro === 'reais' ? 'R$' : '%'}</span>
                <input type="number" step="0.01" required value={valorLucro} onChange={e => setValorLucro(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-700 rounded-xl font-black text-3xl text-emerald-400 outline-none focus:border-emerald-500 transition-colors shadow-inner" />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 z-10 w-full lg:w-auto mt-4 lg:mt-0">
              <button type="submit" className="w-full px-8 py-5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-black rounded-xl shadow-lg transition-transform hover:scale-105 whitespace-nowrap">
                {idEdicao ? '💾 Atualizar Produto' : '💾 Gravar Produto'}
              </button>
              {idEdicao && (
                <button type="button" onClick={() => { limparFormulario(); setTelaAtiva('produtos_lista'); }} className="w-full px-8 py-5 bg-slate-800 hover:bg-slate-700 text-white text-lg font-black rounded-xl shadow-lg transition-transform hover:scale-105 whitespace-nowrap">
                  ✕ Cancelar
                </button>
              )}
            </div>

          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-8 pb-32">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Estoque Ativo</h2>
          <p className="text-slate-500 font-medium mt-1">Gerencie preços, controle furos de estoque e ative o PDV Expresso.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
          <div className="flex flex-wrap gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <input type="text" placeholder="🔍 Buscar Título ou Cód..." value={busca} onChange={e => setBusca(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold w-full sm:w-48 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
            <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none flex-1 sm:flex-none">
              <option value="Todas">Categorias</option>
              {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
            <select value={ordem} onChange={e => setOrdem(e.target.value as any)} className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none flex-1 sm:flex-none">
              <option value="recentes">Mais Recentes</option>
              <option value="estoque_baixo">Estoque Crítico</option>
              <option value="lucro_alto">Maior Lucro Limpo</option>
            </select>
          </div>
          
          <button onClick={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }} className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-2xl border shadow-sm transition-colors whitespace-nowrap ${modoSelecao ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
            {modoSelecao ? '✕ Fechar Edição' : '📦 Edição Lote'}
          </button>
        </div>
      </header>

      {/* PAINEL DE CONTROLE DE LOTE (MÁGICO) */}
      {modoSelecao && (
        <div className="bg-gradient-to-r from-indigo-900 to-blue-900 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row flex-wrap gap-6 items-center justify-between animate-fade-in relative overflow-hidden border border-indigo-700">
          <div className="absolute top-0 right-1/4 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
            <button onClick={selecionarTodos} className="text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl shadow-sm transition-all">
              Selecionar Todos
            </button>
            <span className="text-sm font-black text-indigo-200 bg-black/20 px-3 py-1.5 rounded-lg">{selecionados.length} Itens Mapeados</span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto relative z-10 bg-black/20 p-2 rounded-2xl border border-white/10">
            <select value={operacaoLote} onChange={e => setOperacaoLote(e.target.value as 'definir' | 'somar')} className="px-3 py-2.5 bg-indigo-950 border border-indigo-800 rounded-xl font-black text-xs text-indigo-200 outline-none focus:border-indigo-400">
              <option value="definir">Cravar Valor Absoluto (=)</option>
              <option value="somar">Somar/Dar Entrada (+/-)</option>
            </select>
            
            <input 
              type="number" 
              placeholder={operacaoLote === 'definir' ? 'Novo Estoque Exato' : 'Qtd para Somar (+)'}
              value={estoqueLote} 
              onChange={e => setEstoqueLote(e.target.value)} 
              className="w-48 px-4 py-2.5 bg-white border border-indigo-200 rounded-xl font-black text-sm text-indigo-900 outline-none focus:ring-2 focus:ring-blue-400" 
            />
            
            <button onClick={aplicarEstoqueEmMassa} disabled={processandoLote || selecionados.length === 0} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:grayscale">
              {processandoLote ? 'Executando...' : 'Aplicar Lote'}
            </button>
          </div>
        </div>
      )}

      {produtosFiltrados.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200"><span className="text-6xl mb-4 grayscale block">📦</span><p className="text-xl font-black text-slate-400">Seu centro de distribuição está vazio.</p></div>
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
          {produtosFiltrados.map(produto => {
            const estoqueCritico = (produto.estoque || 0) <= (produto.estoqueMinimo || 5);
            const semEstoque = (produto.estoque || 0) === 0;
            const selecionado = selecionados.includes(produto.id);

            return (
              <div key={produto.id} className={`bg-white rounded-3xl shadow-sm transition-all duration-300 relative overflow-hidden group flex flex-col md:flex-row ${selecionado ? 'border-2 border-indigo-500 shadow-indigo-500/20' : 'border border-slate-200 hover:shadow-xl'}`}>
                
                <div className={`absolute top-0 left-0 w-full h-1.5 ${selecionado ? 'bg-indigo-500' : semEstoque ? 'bg-rose-500' : estoqueCritico ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>

                <div className={`md:w-56 p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col items-center justify-center relative ${selecionado ? 'bg-indigo-50/30' : 'bg-slate-50/50'}`}>
                  
                  {/* CAIXA DE SELEÇÃO NO CARD */}
                  {modoSelecao && (
                    <div className="absolute top-4 left-4 z-10">
                      <input type="checkbox" checked={selecionado} onChange={() => { if(selecionado) setSelecionados(selecionados.filter(i=>i!==produto.id)); else setSelecionados([...selecionados, produto.id]); }} className="w-6 h-6 accent-indigo-600 cursor-pointer rounded-lg shadow-sm" />
                    </div>
                  )}

                  <div className="w-32 h-32 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden mb-4 relative mt-2">
                    {produto.foto ? <img src={produto.foto} alt={produto.titulo} className={`w-full h-full object-cover transition-transform duration-500 ${selecionado ? 'scale-110' : 'group-hover:scale-110'}`} /> : <span className="text-4xl text-slate-300">📦</span>}
                    {semEstoque && <div className="absolute inset-0 bg-rose-500/80 flex items-center justify-center"><span className="text-white font-black text-xs uppercase tracking-widest rotate-[-15deg]">Esgotado</span></div>}
                  </div>
                  
                  <button onClick={() => setPdvModal(produto)} disabled={semEstoque || modoSelecao} className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all disabled:opacity-30 disabled:grayscale flex justify-center items-center gap-2">
                    🛒 Vender Rápido
                  </button>
                </div>

                <div className={`p-6 flex-1 flex flex-col justify-between ${selecionado ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight pr-4">{produto.titulo}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{produto.codigo} • {produto.categoria || 'Sem Categoria'}</p>
                      </div>
                      <div className="flex gap-2">
                        {/* EDIÇÃO RÁPIDA DE ESTOQUE */}
                        <button onClick={() => ajustarEstoqueRapido(produto)} className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 border hover:scale-105 transition-transform ${semEstoque ? 'bg-rose-50 text-rose-600 border-rose-200' : estoqueCritico ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`} title="Editar Estoque Rápido">
                          {produto.estoque} UN ✏️
                        </button>
                        
                        {/* EDIÇÃO COMPLETA E EXCLUSÃO RECUPERADOS */}
                        <button onClick={() => iniciarEdicao(produto)} className="w-7 h-7 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center transition-colors shadow-sm" title="Editar Produto">✏️</button>
                        <button onClick={() => lidarExcluir(produto.id)} className="w-7 h-7 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg flex items-center justify-center transition-colors shadow-sm" title="Excluir Produto">✕</button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 my-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo Total:</span>
                        <span className="text-sm font-black text-slate-800">R$ {produto.custoTotal.toFixed(2)}</span>
                      </div>
                      
                      {/* SIMULADOR INLINE DE META */}
                      <div className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 focus-within:ring-2 focus-within:ring-emerald-400 transition-all shadow-sm">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Meta Limpa: R$</span>
                        <input 
                          type="number" step="0.01"
                          className="bg-transparent w-16 outline-none font-black text-emerald-700 text-sm"
                          placeholder={produto.valorLucro.toString()}
                          value={metasSimuladas[produto.id] !== undefined ? metasSimuladas[produto.id] : produto.tipoLucro === 'reais' ? produto.valorLucro : ''}
                          onChange={(e) => setMetasSimuladas({...metasSimuladas, [produto.id]: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-t border-slate-100 pt-3">Preços Sugeridos ao Vivo:</p>
                    {plataformas.length === 0 ? <p className="text-xs font-bold text-amber-500 bg-amber-50 px-3 py-1 rounded-lg">Sem taxas configuradas.</p> : (
                      <div className="flex flex-wrap gap-2">
                        {plataformas.map(plat => {
                          const preco = calcularPrecoVendaCard(produto, plat);
                          return (
                            <div key={plat.id} className="bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm flex flex-col justify-center min-w-[110px]">
                              <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                                
                                {/* CORREÇÃO DA IMAGEM DA LOGO AQUI */}
                                {plat.logo.startsWith('http') || plat.logo.startsWith('data:') ? (
                                  <img src={plat.logo} alt={plat.nome} className="w-4 h-4 object-contain rounded-sm shrink-0" />
                                ) : (
                                  <span className="text-sm shrink-0">{plat.logo}</span>
                                )}

                                <span className="text-[9px] font-black uppercase truncate max-w-[70px]" title={plat.nome}>{plat.nome}</span>
                              </div>
                              <span className="font-black text-slate-900" style={{ color: plat.cor || '#0f172a' }}>R$ {preco.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DO PDV */}
      {pdvModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> Terminal de Venda</p>
                <h3 className="text-2xl font-black">{pdvModal.titulo}</h3>
              </div>
              <button onClick={() => setPdvModal(null)} className="w-10 h-10 bg-slate-800 rounded-full font-black text-slate-300 hover:bg-slate-700 transition-colors z-10">✕</button>
            </div>
            
            <form onSubmit={registrarVendaPDV} className="p-8 space-y-6">
              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Qtd.</label>
                  <input type="number" min="1" max={pdvModal.estoque} required value={pdvQtd} onChange={e => setPdvQtd(parseInt(e.target.value))} className="w-full px-4 py-3 text-center bg-slate-50 border border-slate-200 rounded-xl font-black text-xl text-blue-600 outline-none focus:border-blue-500" />
                </div>
                <div className="w-2/3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Canal da Venda</label>
                  <select required value={pdvPlataforma} onChange={e => setPdvPlataforma(e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500">
                    <option value="">Venda Balcão / Direta</option>
                    {plataformas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Total Recebido</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">R$</span>
                  <input type="number" step="0.01" required placeholder="0.00" value={pdvValorFinal} onChange={e => setPdvValorFinal(e.target.value)} className="w-full pl-14 pr-4 py-5 bg-emerald-50 border border-emerald-200 focus:border-emerald-500 rounded-xl font-black text-3xl text-emerald-600 outline-none transition-all placeholder:text-emerald-300 shadow-inner" />
                </div>
                <p className="text-xs font-bold text-slate-400 mt-2 text-center">Isso criará uma receita paga direto no seu Fluxo de Caixa.</p>
              </div>

              <button type="submit" disabled={processandoVenda} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white text-lg font-black rounded-xl shadow-xl transition-all disabled:opacity-50">
                {processandoVenda ? '⏳ Registrando...' : '💵 Confirmar e Receber'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}