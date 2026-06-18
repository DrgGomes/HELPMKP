import React, { useState, useMemo } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
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
  // Filtros Operacionais da Tela
  const [buscaProduto, setBuscaProduto] = useState('');
  const [filtroPlataforma, setFiltroPlataforma] = useState('todas');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  // Controle de Visão da Tela
  const [modoTela, setModoTela] = useState<'cards' | 'massa'>('cards');

  // --- ESTADOS DO MÓDULO DE BIPE ---
  const [codigoBipado, setCodigoBipado] = useState('');
  const [modoBipe, setMenuBipe] = useState<'entrada' | 'saida'>('entrada');
  const [alertaBipe, setAlertaBipe] = useState({ tipo: '', texto: '' });

  // --- ESTADOS DO RELATÓRIO PDF ---
  const [mostrarPainelRelatorio, setMostrarPainelRelatorio] = useState(false);
  const [relFiltroEstoque, setRelFiltroEstoque] = useState<'todos' | 'falta' | 'baixo' | 'saudavel'>('todos');
  const [relCustoMax, setRelCustoMax] = useState('');
  const [colCod, setColCod] = useState(true);
  const [colCat, setColCat] = useState(true);
  const [colEst, setColEst] = useState(true);
  const [colCusto, setColCodCusto] = useState(true);
  const [colPrecos, setColPrecos] = useState(true);

  // --- ESTADOS DE EDIÇÃO EM MASSA ---
  const [edicoesMassa, setEdicoesMassa] = useState<Record<string, Partial<Produto>>>({});
  const [salvandoMassa, setSalvandoMassa] = useState(false);

  // --- ESTADOS DO FORMULÁRIO DE CADASTRO ÚNICO ---
  const listaCategorias = categorias.length > 0 ? categorias.map(c => c.nome).sort() : ['Geral'];
  const [idProdEdicao, setIdProdEdicao] = useState<string | null>(null);
  const [fotoProd, setFotoProd] = useState('');
  const [tituloProd, setTituloProd] = useState('');
  const [codigoProd, setCodigoProd] = useState('');
  const [categoriaProd, setCategoriaProd] = useState(listaCategorias[0]);
  const [custoBaseProd, setCustoBaseProd] = useState('');
  const [custoAdsProd, setCustoAdsProd] = useState('0');
  const [estoqueProd, setEstoqueProd] = useState('0');
  const [estoqueMinProd, setEstoqueMinProd] = useState('5');
  const [custosAdicionais, setCustosAdicionais] = useState<CustoAdicional[]>([]);
  const [tipoLucro, setTipoLucro] = useState<'porcentagem' | 'reais'>('reais');
  const [valorLucro, setValorLucro] = useState('');

  // --- LÓGICA DO BIPE ---
  const lidarBipeLeitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoBipado.trim()) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    const produtoEncontrado = produtos.find(p => p.codigo === codigoBipado.trim());
    if (!produtoEncontrado) {
      setAlertaBipe({ tipo: 'erro', texto: `⚠️ Código "${codigoBipado}" não localizado.` });
      setCodigoBipado(''); return;
    }

    const estoqueAtual = produtoEncontrado.estoque || 0;
    const novaQuantidade = modoBipe === 'entrada' ? estoqueAtual + 1 : Math.max(0, estoqueAtual - 1);

    try {
      await updateDoc(doc(db, 'usuarios', userId, 'produtos', produtoEncontrado.id), { estoque: novaQuantidade });
      setAlertaBipe({ tipo: 'sucesso', texto: `✨ [${modoBipe === 'entrada' ? 'ENTRADA' : 'SAÍDA'}] ${produtoEncontrado.titulo} alterado para ${novaQuantidade} un.` });
    } catch (error) { setAlertaBipe({ tipo: 'erro', texto: 'Erro ao atualizar.' }); }
    setCodigoBipado('');
  };

  // --- LÓGICA DE EDIÇÃO EM MASSA (A MÁGICA) ---
  const registrarEdicaoMassa = (id: string, campo: keyof Produto, valor: any) => {
    setEdicoesMassa(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [campo]: valor }
    }));
  };

  const salvarEdicoesEmMassa = async () => {
    const idsEditados = Object.keys(edicoesMassa);
    if (idsEditados.length === 0) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    setSalvandoMassa(true);
    try {
      await Promise.all(idsEditados.map(async (id) => {
        const prodOriginal = produtos.find(p => p.id === id);
        if (!prodOriginal) return;
        
        const dadosNovos = edicoesMassa[id];
        
        // Se mudou o custo base ou ads, precisa recalcular o Custo Total
        if (dadosNovos.custoBase !== undefined || dadosNovos.custoAds !== undefined) {
          const cBase = dadosNovos.custoBase !== undefined ? Number(dadosNovos.custoBase) : prodOriginal.custoBase;
          const cAds = dadosNovos.custoAds !== undefined ? Number(dadosNovos.custoAds) : (prodOriginal.custoAds || 0);
          const cExtras = prodOriginal.custosAdicionais?.reduce((a, b) => a + (b.valor || 0), 0) || 0;
          dadosNovos.custoTotal = cBase + cAds + cExtras;
        }

        await updateDoc(doc(db, 'usuarios', userId, 'produtos', id), dadosNovos);
      }));
      setEdicoesMassa({});
      alert(`${idsEditados.length} produtos atualizados com sucesso!`);
      setModoTela('cards');
    } catch (error) { console.error("Erro na edição em massa:", error); alert("Falha ao salvar edições em massa."); }
    setSalvandoMassa(false);
  };

  // --- LÓGICA DE CUSTOS EXTRAS (Formulário Único) ---
  const adicionarCustoExtra = () => setCustosAdicionais([...custosAdicionais, { id: Date.now().toString(), nome: '', valor: 0 }]);
  const adicionarCustoRapido = (padrao: CustoPadrao) => setCustosAdicionais([...custosAdicionais, { id: Date.now().toString() + Math.random().toString(), nome: padrao.nome, valor: padrao.valor }]);
  const atualizarCustoExtra = (id: string, campo: 'nome' | 'valor', novoValor: string) => setCustosAdicionais(custosAdicionais.map(c => c.id === id ? { ...c, [campo]: campo === 'valor' ? parseFloat(novoValor) || 0 : novoValor } : c));
  const removerCustoExtra = (id: string) => setCustosAdicionais(custosAdicionais.filter(c => c.id !== id));
  const calcularCustoTotalAoVivo = () => (parseFloat(custoBaseProd) || 0) + custosAdicionais.reduce((acc, curr) => acc + (parseFloat(curr.valor.toString()) || 0), 0);

  // --- BANCO DE DADOS: SALVAR PRODUTO ÚNICO ---
  const lidarSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloProd || !custoBaseProd || !valorLucro) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;

    const codigoFinal = codigoProd.trim() || Math.floor(Date.now() / 1000).toString();
    const baseFormatada = parseFloat(custoBaseProd);
    const extrasFormatados: CustoAdicional[] = custosAdicionais.filter(c => c.nome.trim() !== '').map(c => ({ id: c.id, nome: c.nome, valor: parseFloat(c.valor.toString()) || 0 }));
    const total = baseFormatada + extrasFormatados.reduce((acc, curr) => acc + curr.valor, 0);

    const dadosProduto: Partial<Produto> = {
      foto: fotoProd || `https://ui-avatars.com/api/?name=${encodeURIComponent(tituloProd)}&background=e2e8f0&color=475569&size=150`,
      titulo: tituloProd, codigo: codigoFinal, categoria: categoriaProd, custoBase: baseFormatada,
      custosAdicionais: extrasFormatados, custoAds: parseFloat(custoAdsProd) || 0, custoTotal: total,
      tipoLucro, valorLucro: parseFloat(valorLucro), estoque: parseInt(estoqueProd) || 0, estoqueMinimo: parseInt(estoqueMinProd) || 5
    };

    try {
      if (idProdEdicao) await setDoc(doc(db, 'usuarios', userId, 'produtos', idProdEdicao as string), dadosProduto);
      else await addDoc(collection(db, 'usuarios', userId, 'produtos'), dadosProduto);
      limparFormProduto(); setTelaAtiva('produtos_lista');
    } catch (error) { console.error(error); }
  };

  const iniciarEdicaoProduto = (prod: Produto) => {
    setIdProdEdicao(prod.id); setFotoProd(prod.foto.includes('ui-avatars') ? '' : prod.foto); setTituloProd(prod.titulo);
    setCodigoProd(prod.codigo || ''); setCategoriaProd(prod.categoria || listaCategorias[0]); setCustoBaseProd(prod.custoBase.toString());
    setCustoAdsProd(prod.custoAds?.toString() || '0'); setEstoqueProd((prod.estoque || 0).toString()); setEstoqueMinProd((prod.estoqueMinimo || 5).toString());
    setCustosAdicionais(prod.custosAdicionais || []); setTipoLucro(prod.tipoLucro); setValorLucro(prod.valorLucro.toString());
    setTelaAtiva('produto_cadastro'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicarProduto = async (prod: Produto) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    const { id, ...dadosSemId } = prod;
    await addDoc(collection(db, 'usuarios', userId, 'produtos'), { ...dadosSemId, titulo: `${prod.titulo} (Cópia)`, codigo: Math.floor(Date.now() / 1000).toString() });
  };

  const limparFormProduto = () => {
    setIdProdEdicao(null); setFotoProd(''); setTituloProd(''); setCodigoProd(''); setCategoriaProd(listaCategorias[0]); 
    setCustoBaseProd(''); setCustoAdsProd('0'); setEstoqueProd('0'); setEstoqueMinProd('5'); setCustosAdicionais([]); setTipoLucro('reais'); setValorLucro('');
  };

  const lidarExcluirProduto = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Excluir este produto?")) await deleteDoc(doc(db, 'usuarios', userId, 'produtos', id));
  };

  // --- FILTROS DE TELA ---
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchBusca = p.titulo.toLowerCase().includes(buscaProduto.toLowerCase()) || (p.codigo && p.codigo.includes(buscaProduto));
      const matchCategoria = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
      
      let matchEstoque = true;
      const est = p.estoque || 0; const min = p.estoqueMinimo || 5;
      if (relFiltroEstoque === 'falta') matchEstoque = est === 0;
      else if (relFiltroEstoque === 'baixo') matchEstoque = est > 0 && est <= min;
      else if (relFiltroEstoque === 'saudavel') matchEstoque = est > min;

      const matchCustoMax = !relCustoMax || p.custoTotal <= parseFloat(relCustoMax);

      return matchBusca && matchCategoria && matchEstoque && matchCustoMax;
    });
  }, [produtos, buscaProduto, filtroCategoria, relFiltroEstoque, relCustoMax]);

  const plataformasFiltradas = useMemo(() => filtroPlataforma === 'todas' ? plataformas : plataformas.filter(p => p.id === filtroPlataforma), [plataformas, filtroPlataforma]);

  const calcularPrecoVenda = (produto: Produto, plat: Plataforma) => {
    const C = produto.custoTotal + (produto.custoAds || 0) + plat.taxaFixa + plat.freteFixo;
    const P_taxas = (plat.comissao + plat.comissaoAfiliado) / 100;
    if (produto.tipoLucro === 'reais') {
      const divisor = 1 - P_taxas; return divisor <= 0 ? null : (C + produto.valorLucro) / divisor;
    } else {
      const divisor = 1 - P_taxas - (produto.valorLucro / 100); return divisor <= 0 ? null : C / divisor;
    }
  };

  // TELA DE CADASTRO ÚNICO
  if (telaAtiva === 'produto_cadastro') {
    return (
      <div className="animate-fade-in max-w-4xl mx-auto">
        <header className="mb-6"><h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{idProdEdicao ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h2></header>
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={lidarSalvarProduto} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Título do Produto</label>
                <input type="text" required value={tituloProd} onChange={(e) => setTituloProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoria</label>
                <select value={categoriaProd} onChange={(e) => setCategoriaProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-700">
                  {listaCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cód. Barras / SKU</label>
                <input type="text" value={codigoProd} onChange={(e) => setCodigoProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-600" placeholder="Automático se vazio" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Estoque</label>
                <input type="number" value={estoqueProd} onChange={(e) => setEstoqueProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Alerta Mínimo</label>
                <input type="number" value={estoqueMinProd} onChange={(e) => setEstoqueMinProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-rose-600" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">URL da Foto</label>
                <input type="url" value={fotoProd} onChange={(e) => setFotoProd(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5">
              <h4 className="text-base font-black text-slate-800 flex items-center gap-2"><span>🏭</span> Estrutura de Custos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Base (R$)</label><input type="number" required step="0.01" value={custoBaseProd} onChange={(e) => setCustoBaseProd(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl font-bold text-lg text-slate-700" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Ads/Tráfego (R$)</label><input type="number" step="0.01" value={custoAdsProd} onChange={(e) => setCustoAdsProd(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl font-bold text-lg text-slate-700" /></div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4"><label className="block text-sm font-bold text-slate-700">Insumos e Embalagens</label><button type="button" onClick={adicionarCustoExtra} className="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold hover:bg-blue-200">+ Manual</button></div>
                <div className="flex flex-wrap gap-2 mb-5">
                  {custosPadrao.map((padrao) => <button key={padrao.id} type="button" onClick={() => adicionarCustoRapido(padrao)} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-1.5 shadow-sm"><span>{padrao.icone}</span> {padrao.nome} (+R$ {padrao.valor.toFixed(2)})</button>)}
                </div>
                <div className="space-y-3">
                  {custosAdicionais.map((custo) => (
                    <div key={custo.id} className="flex gap-3 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm animate-fade-in"><input type="text" placeholder="Nome" value={custo.nome} onChange={(e) => atualizarCustoExtra(custo.id, 'nome', e.target.value)} className="flex-1 px-3 py-2 bg-transparent text-sm font-medium outline-none" /><div className="flex items-center gap-2 border-l pl-3"><span className="text-slate-400 font-bold text-sm">R$</span><input type="number" step="0.01" value={custo.valor} onChange={(e) => atualizarCustoExtra(custo.id, 'valor', e.target.value)} className="w-24 px-2 py-2 bg-transparent text-sm font-bold outline-none" /></div><button type="button" onClick={() => removerCustoExtra(custo.id)} className="w-8 h-8 bg-rose-50 text-rose-500 rounded-lg font-bold">✕</button></div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center bg-slate-900 p-5 rounded-xl shadow-inner"><span className="text-sm font-bold text-slate-300 uppercase tracking-widest">Custo Total:</span><span className="text-2xl font-black text-white">R$ {calcularCustoTotalAoVivo().toFixed(2)}</span></div>
            </div>

            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-4">
              <h4 className="text-base font-black text-emerald-800">🎯 Lucro Desejado</h4>
              <div className="flex gap-3">
                <select value={tipoLucro} onChange={(e) => setTipoLucro(e.target.value as any)} className="w-1/3 px-4 py-3 border border-emerald-200 rounded-xl bg-white text-emerald-900 font-bold"><option value="reais">Lucro em (R$)</option><option value="porcentagem">Margem em (%)</option></select>
                <input type="number" required step="0.01" value={valorLucro} onChange={(e) => setValorLucro(e.target.value)} className="w-2/3 px-4 py-3 border border-emerald-200 rounded-xl bg-white font-black text-lg text-emerald-900" placeholder="0.00" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button type="submit" className="flex-1 text-white py-4 rounded-xl font-black text-lg bg-blue-600 hover:bg-blue-700 shadow-lg">Salvar Estratégia</button>
              <button type="button" onClick={() => { limparFormProduto(); setTelaAtiva('produtos_lista'); }} className="px-8 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // TELA PRINCIPAL (LISTAGEM OU EDIÇÃO EM MASSA)
  return (
    <div className="animate-fade-in space-y-6 relative pb-20">
      
      {/* Estilos para PDF */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print { body * { visibility: hidden; } #area-print-produtos, #area-print-produtos * { visibility: visible; } #area-print-produtos { position: absolute; left: 0; top: 0; width: 100%; color: #000; } .no-print { display: none !important; } }
      `}} />

      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 no-print">
        <div><h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Catálogo de Produtos</h2></div>
        
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          {/* BOTÃO DE MODO EDIÇÃO EM MASSA */}
          <button 
            onClick={() => setModoTela(modoTela === 'cards' ? 'massa' : 'cards')} 
            className={`px-5 py-3 rounded-xl font-bold border transition-colors flex items-center gap-2 ${modoTela === 'massa' ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-inner' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
          >
            {modoTela === 'massa' ? '🔙 Voltar aos Cards' : '📝 Edição em Massa (Planilha)'}
          </button>
          <button onClick={() => setMostrarPainelRelatorio(!mostrarPainelRelatorio)} className="bg-slate-100 text-slate-700 border border-slate-300 px-5 py-3 rounded-xl font-bold flex items-center gap-2">📑 PDF / Filtros</button>
          <button onClick={() => { setTelaAtiva('produto_cadastro'); limparFormProduto(); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2"><span>➕</span> Novo</button>
        </div>
      </header>

      {/* --- MÓDULO DE BIPE (Oculto na edição em massa para limpar a tela) --- */}
      {modoTela === 'cards' && (
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white no-print shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2"><span className="text-xl animate-pulse">⚡</span><div><h3 className="font-black text-sm tracking-wide uppercase text-slate-200">Terminal de Bipe Contínuo</h3><p className="text-xs text-slate-400 mt-0.5">Mantenha o campo focado e bipe em sequência (Barcode/QR Code)</p></div></div>
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
              <button type="button" onClick={() => setMenuBipe('entrada')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${modoBipe === 'entrada' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>📥 Entrada (+1)</button>
              <button type="button" onClick={() => setMenuBipe('saida')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${modoBipe === 'saida' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'}`}>📤 Saída (-1)</button>
            </div>
          </div>
          <form onSubmit={lidarBipeLeitor} className="flex gap-2">
            <div className="relative flex-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🎯</span><input type="text" placeholder="Bipe o produto com o leitor..." value={codigoBipado} onChange={(e) => setCodigoBipado(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-blue-500 font-mono font-bold tracking-widest text-lg text-blue-400 placeholder:text-slate-600 shadow-inner" autoFocus /></div>
          </form>
          {alertaBipe.texto && <div className={`mt-3 p-3 rounded-xl text-xs font-bold border ${alertaBipe.tipo === 'sucesso' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-rose-950/40 border-rose-800 text-rose-400'}`}>{alertaBipe.texto}</div>}
        </div>
      )}

      {/* --- PAINEL DE RELATÓRIO PDF --- */}
      {mostrarPainelRelatorio && (
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-md space-y-5 no-print animate-fade-in">
          <div className="border-b pb-2 flex justify-between items-center"><h3 className="font-black text-slate-800">🛠️ Filtros do PDF</h3><button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-lg">🖨️ Imprimir Modelo</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-500 uppercase mb-1">Status do Estoque</label>
              <select value={relFiltroEstoque} onChange={(e) => setRelFiltroEstoque(e.target.value as any)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700"><option value="todos">Todos</option><option value="falta">Falta de Estoque (Zerado)</option><option value="baixo">Baixo Estoque (Limite de Alerta)</option><option value="saudavel">Estoque Saudável</option></select>
            </div>
            <div>
              <label className="block font-bold text-slate-500 uppercase mb-1">Teto de Custo Total (R$)</label>
              <input type="number" placeholder="Ex: 50.00" value={relCustoMax} onChange={(e) => setRelCustoMax(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold" />
            </div>
          </div>
          <div className="pt-2 border-t text-xs">
            <p className="font-bold text-slate-500 uppercase mb-2">Colunas para Exibir no PDF:</p>
            <div className="flex flex-wrap gap-4 font-bold text-slate-700">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={colCod} onChange={(e) => setColCod(e.target.checked)} /> Código</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={colCat} onChange={(e) => setColCat(e.target.checked)} /> Categoria</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={colEst} onChange={(e) => setColEst(e.target.checked)} /> Qtd. Estoque</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={colCusto} onChange={(e) => setColCodCusto(e.target.checked)} /> Custo Total</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={colPrecos} onChange={(e) => setColPrecos(e.target.checked)} /> Preços Sugeridos</label>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE PESQUISA */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 no-print">
        <div className="flex-1 relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span><input type="text" placeholder="Buscar por título ou código..." value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm" /></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative min-w-[200px]"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">📂</span><select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none font-bold text-sm text-slate-700 appearance-none"><option value="todas">Todas as Categorias</option>{listaCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
          <div className="relative min-w-[200px]"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🛍️</span><select value={filtroPlataforma} onChange={(e) => setFiltroPlataforma(e.target.value)} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none font-bold text-sm text-slate-700 appearance-none"><option value="todas">Ver todas plataformas</option>{plataformas.map(p => <option key={p.id} value={p.id}>Apenas {p.nome}</option>)}</select></div>
        </div>
      </div>

      {/* --- MODO DE EDIÇÃO EM MASSA (PLANILHA) --- */}
      {modoTela === 'massa' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto no-print animate-fade-in">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold">Produto</th>
                <th className="p-4 font-bold">Categoria</th>
                <th className="p-4 font-bold">Cód/SKU</th>
                <th className="p-4 font-bold">Estoque</th>
                <th className="p-4 font-bold">Estq. Min</th>
                <th className="p-4 font-bold">Custo Base (R$)</th>
                <th className="p-4 font-bold">Meta Lucro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produtosFiltrados.map(p => (
                <tr key={p.id} className={`hover:bg-amber-50/30 transition-colors ${edicoesMassa[p.id] ? 'bg-blue-50/30' : ''}`}>
                  <td className="p-3 font-bold text-slate-800 max-w-[200px] truncate" title={p.titulo}>{p.titulo}</td>
                  <td className="p-3">
                    <select value={edicoesMassa[p.id]?.categoria ?? (p.categoria || listaCategorias[0])} onChange={(e) => registrarEdicaoMassa(p.id, 'categoria', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs">
                      {listaCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <input type="text" value={edicoesMassa[p.id]?.codigo ?? p.codigo} onChange={(e) => registrarEdicaoMassa(p.id, 'codigo', e.target.value)} className="w-24 p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs font-mono" />
                  </td>
                  <td className="p-3">
                    <input type="number" value={edicoesMassa[p.id]?.estoque ?? p.estoque ?? 0} onChange={(e) => registrarEdicaoMassa(p.id, 'estoque', Number(e.target.value))} className="w-20 p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs font-black text-center" />
                  </td>
                  <td className="p-3">
                    <input type="number" value={edicoesMassa[p.id]?.estoqueMinimo ?? p.estoqueMinimo ?? 5} onChange={(e) => registrarEdicaoMassa(p.id, 'estoqueMinimo', Number(e.target.value))} className="w-20 p-2 border border-slate-200 rounded-lg outline-none focus:border-rose-500 text-xs text-rose-600 font-bold text-center" />
                  </td>
                  <td className="p-3">
                    <input type="number" step="0.01" value={edicoesMassa[p.id]?.custoBase ?? p.custoBase} onChange={(e) => registrarEdicaoMassa(p.id, 'custoBase', Number(e.target.value))} className="w-24 p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs font-bold" />
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    <input type="number" step="0.01" value={edicoesMassa[p.id]?.valorLucro ?? p.valorLucro} onChange={(e) => registrarEdicaoMassa(p.id, 'valorLucro', Number(e.target.value))} className="w-20 p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs font-black" />
                    <select value={edicoesMassa[p.id]?.tipoLucro ?? p.tipoLucro} onChange={(e) => registrarEdicaoMassa(p.id, 'tipoLucro', e.target.value)} className="w-16 p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-xs">
                      <option value="reais">R$</option>
                      <option value="porcentagem">%</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {Object.keys(edicoesMassa).length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-fade-in border border-slate-700">
              <span className="font-bold text-sm">⚠️ {Object.keys(edicoesMassa).length} produtos modificados</span>
              <div className="flex gap-2">
                <button onClick={() => setEdicoesMassa({})} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-xs font-bold transition-colors">Desfazer</button>
                <button onClick={salvarEdicoesEmMassa} disabled={salvandoMassa} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-full text-sm font-black transition-colors shadow-lg shadow-emerald-500/30">
                  {salvandoMassa ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MODO CARDS (VISÃO NORMAL E PDF) --- */}
      {modoTela === 'cards' && (
        <div id="area-print-produtos">
          
          {/* Cabeçalho do PDF */}
          <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
            <h1 className="text-xl font-black">HelpMkp - Relatório Gerencial de Inventário</h1>
            <p className="text-xs text-slate-600 mt-1">Filtros - Estoque: {relFiltroEstoque.toUpperCase()} | Plataforma: {plataformas.find(p=>p.id === filtroPlataforma)?.nome || 'Todas'}</p>
          </div>

          {produtosFiltrados.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border border-dashed border-slate-300 no-print"><div className="text-4xl mb-4">📦</div><h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum produto localizado</h3></div>
          ) : (
            <>
              {/* TABELA DE IMPRESSÃO (PDF) */}
              <div className="hidden print:block w-full">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-400 bg-slate-100 font-bold">
                      <th className="p-2">Item / Título</th>
                      {colCod && <th className="p-2">Código</th>}
                      {colCat && <th className="p-2">Categoria</th>}
                      {colEst && <th className="p-2 text-center">Estoque</th>}
                      {colCusto && <th className="p-2 text-right">Custo Total</th>}
                      {colPrecos && <th className="p-2 pl-4">Preços Sugeridos</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {produtosFiltrados.map(p => (
                      <tr key={p.id} className="align-top">
                        <td className="p-2 font-bold">{p.titulo}</td>
                        {colCod && <td className="p-2 font-mono font-bold">{p.codigo}</td>}
                        {colCat && <td className="p-2">{p.categoria || 'Geral'}</td>}
                        {colEst && <td className={`p-2 font-black text-center ${(p.estoque || 0) <= (p.estoqueMinimo || 5) ? 'text-red-600' : ''}`}>{p.estoque || 0} un</td>}
                        {colCusto && <td className="p-2 font-bold text-right">R$ {p.custoTotal.toFixed(2)}</td>}
                        {colPrecos && (
                          <td className="p-2 pl-4 space-y-0.5 font-medium border-l border-slate-200">
                            {plataformasFiltradas.map(pl => {
                              const v = calcularPrecoVenda(p, pl);
                              return <div key={pl.id} className="text-[10px] whitespace-nowrap">{pl.nome}: <strong className="text-emerald-700">R$ {v ? v.toFixed(2) : '---'}</strong></div>;
                            })}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CARDS VISUAIS NA TELA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
                {produtosFiltrados.map((prod) => {
                  const estAtual = prod.estoque || 0;
                  const estMin = prod.estoqueMinimo || 5;
                  const isBaixoEstoque = estAtual <= estMin;

                  return (
                    <div key={prod.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full hover:shadow-md transition-all group relative overflow-hidden">
                      <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <span className={`px-2.5 py-0.5 font-black text-[10px] rounded-md uppercase tracking-wider ${isBaixoEstoque ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          📦 {estAtual} un
                        </span>
                        <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-md">
                          {prod.categoria || 'Geral'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-start mb-5 pb-5 border-b border-slate-100 mt-2">
                        <div className="flex gap-4 items-center w-full pr-24">
                          <img src={prod.foto} alt="" onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(prod.titulo)}&background=e2e8f0`} className="w-20 h-20 rounded-xl object-cover bg-slate-50 border border-slate-200 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-slate-800 text-lg leading-tight mb-2 truncate" title={prod.titulo}>{prod.titulo}</h4>
                            <p className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit mb-2 border border-blue-100">🎯 Cód: {prod.codigo}</p>
                            
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-bold border border-slate-200">Custo Total: R$ {prod.custoTotal.toFixed(2)}</span>
                              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md font-black border border-emerald-200">Meta: {prod.tipoLucro === 'reais' ? `R$ ${prod.valorLucro.toFixed(2)}` : `${prod.valorLucro}%`}</span>
                            </div>

                            {/* CUSTOS VARIÁVEIS NA TELA */}
                            {prod.custosAdicionais && prod.custosAdicionais.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                                {prod.custosAdicionais.map((c, i) => (
                                  <span key={i} className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md">
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
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}