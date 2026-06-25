import React, { useState, useMemo } from 'react';
import { doc, addDoc, collection, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LancamentoFinanceiro, Compra, Fornecedor, CategoriaDespesa } from '../types';

interface FinanceiroProps {
  lancamentos: LancamentoFinanceiro[];
  compras: Compra[];
  fornecedores: Fornecedor[];
  categoriasDespesa: CategoriaDespesa[];
}

export default function Financeiro({ lancamentos, compras, fornecedores, categoriasDespesa }: FinanceiroProps) {
  const [abaAtiva, setAbaAtiva] = useState<'caixa' | 'fornecedores' | 'calendario'>('caixa');

  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0]);
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState(''); 
  const [fornSelecionado, setFornSelecionado] = useState(''); 

  const [isRecorrente, setIsRecorrente] = useState(false);
  const [mesesRepetir, setMesesRepetir] = useState('12');
  const [processandoIA, setProcessandoIA] = useState(false);

  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [categoriaLote, setCategoriaLote] = useState('');
  const [processandoLote, setProcessandoLote] = useState(false);

  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth() + 1;
  const anoAtual = dataAtual.getFullYear();

  const [buscaDescricao, setBuscaDescricao] = useState('');
  const [mesFiltro, setMesFiltro] = useState<number>(mesAtual);
  const [anoFiltro, setAnoFiltro] = useState<number>(anoAtual);
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos'); 

  const [draftBusca, setDraftBusca] = useState('');
  const [draftMes, setDraftMes] = useState<number>(mesAtual);
  const [draftAno, setDraftAno] = useState<number>(anoAtual);
  const [draftStatus, setDraftStatus] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [draftTipo, setDraftTipo] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [draftFornecedor, setDraftFornecedor] = useState('todos');
  const [draftCategoria, setDraftCategoria] = useState('todos'); 

  const [ordemFaturas, setOrdemFaturas] = useState<'vencimento_asc' | 'emissao_desc' | 'valor_desc' | 'valor_asc'>('vencimento_asc');
  const [compraModal, setCompraModal] = useState<Compra | null>(null);

  const [calMes, setCalMes] = useState<number>(mesAtual);
  const [calAno, setCalAno] = useState<number>(anoAtual);
  const [modoArrastar, setModoArrastar] = useState<'vencimento' | 'emissao'>('vencimento');

  const aplicarFiltros = () => {
    setBuscaDescricao(draftBusca); setMesFiltro(draftMes); setAnoFiltro(draftAno);
    setStatusFiltro(draftStatus); setTipoFiltro(draftTipo); setFornecedorFiltro(draftFornecedor);
    setCategoriaFiltro(draftCategoria); setSelecionados([]);
  };

  const limparFiltros = () => {
    setDraftBusca(''); setBuscaDescricao(''); setDraftMes(0); setMesFiltro(0);
    setDraftAno(0); setAnoFiltro(0); setDraftStatus('todos'); setStatusFiltro('todos');
    setDraftTipo('todos'); setTipoFiltro('todos'); setDraftFornecedor('todos'); setFornecedorFiltro('todos');
    setDraftCategoria('todos'); setCategoriaFiltro('todos'); setSelecionados([]);
  };

  const lidarUploadComprovanteIA = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return alert("ERRO CRÍTICO: Chave da IA não encontrada.");

    setProcessandoIA(true);

    try {
      const fileToGenerativePart = async (f: File) => {
        const base64EncodedDataPromise = new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(f);
        });
        return { inlineData: { data: await base64EncodedDataPromise, mimeType: f.type } };
      };

      const imagePart = await fileToGenerativePart(file);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const promptText = `Você é um assistente financeiro de um ERP. Extraia: "descricao", "valor" (numero float), "data" (YYYY-MM-DD) e "categoria" (sugira uma pasta contábil genérica). Retorne EXATAMENTE UM JSON.`;

      const result = await model.generateContent([promptText, imagePart]);
      const responseText = result.response.text();
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const dadosExtraidos = JSON.parse(cleanedText);

      setDescricao(dadosExtraidos.descricao || 'Despesa Lida por IA');
      setValor(dadosExtraidos.valor ? dadosExtraidos.valor.toString() : '');
      setDataLancamento(dadosExtraidos.data || new Date().toISOString().split('T')[0]);
      setDataVencimento(dadosExtraidos.data || new Date().toISOString().split('T')[0]);
      setTipo('despesa');
      
      const catExiste = categoriasDespesa.find(c => c.nome.toLowerCase() === dadosExtraidos.categoria?.toLowerCase());
      setCategoria(catExiste ? catExiste.nome : (dadosExtraidos.categoria || 'Outros'));
      
      alert("✅ Leitura concluída com sucesso! Confirme os dados e salve.");
    } catch (error: any) {
      alert(`❌ Erro na leitura do comprovante:\n\n${error.message}`);
    } finally {
      setProcessandoIA(false); event.target.value = '';
    }
  };

  const lidarSalvar = async (e: any) => {
    e.preventDefault();
    if (!descricao || !valor) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    
    const valorNum = parseFloat(valor);
    const fId = tipo === 'despesa' && fornSelecionado ? fornSelecionado : null;

    try {
      if (idEdicao || !isRecorrente) {
        const dados = { tipo, descricao, valor: valorNum, dataVencimento, dataLancamento, categoria: categoria || 'Geral', fornecedorId: fId };
        if (idEdicao) await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', idEdicao), dados);
        else await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), { ...dados, status: 'pendente' });
      } else {
        const qtdMeses = Math.max(1, parseInt(mesesRepetir) || 1);
        const grupoId = 'REC-' + Date.now();

        for (let i = 0; i < qtdMeses; i++) {
          const objVenc = new Date(dataVencimento + 'T12:00:00'); objVenc.setMonth(objVenc.getMonth() + i);
          const objLanc = new Date(dataLancamento + 'T12:00:00'); objLanc.setMonth(objLanc.getMonth() + i);
          await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), {
            tipo, descricao: qtdMeses > 1 ? `${descricao} (${i + 1}/${qtdMeses})` : descricao,
            valor: valorNum, dataVencimento: objVenc.toISOString().split('T')[0],
            dataLancamento: objLanc.toISOString().split('T')[0], categoria: categoria || 'Geral', status: 'pendente',
            fornecedorId: fId, recorrente: true, grupoRecorrenciaId: grupoId
          });
        }
      }
      limparFormulario();
    } catch (error) { console.error(error); }
  };

  const iniciarEdicao = (lanc: LancamentoFinanceiro) => {
    setAbaAtiva('caixa'); setIdEdicao(lanc.id); setTipo(lanc.tipo); setDescricao(lanc.descricao);
    setValor(lanc.valor.toString()); setDataLancamento(lanc.dataLancamento || lanc.dataVencimento);
    setDataVencimento(lanc.dataVencimento); setCategoria(lanc.categoria || ''); setFornSelecionado(lanc.fornecedorId || '');
    setIsRecorrente(false); setModoSelecao(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => { 
    setIdEdicao(null); setTipo('despesa'); setDescricao(''); setValor(''); 
    setDataLancamento(new Date().toISOString().split('T')[0]); setDataVencimento(new Date().toISOString().split('T')[0]); 
    setCategoria(''); setFornSelecionado(''); setIsRecorrente(false); setMesesRepetir('12');
  };

  const alternarStatus = async (lanc: LancamentoFinanceiro) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id), { status: lanc.status === 'pago' ? 'pendente' : 'pago' });
  };

  const excluirLancamento = async (lanc: LancamentoFinanceiro) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    if (lanc.grupoRecorrenciaId) {
      const resposta = window.prompt("Este boleto faz parte de uma sequência repetida!\n\nDigite 'APENAS' para excluir só este mês.\nDigite 'SÉRIE' para apagar todas as parcelas futuras:");
      if (resposta?.toUpperCase() === 'APENAS') await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id));
      else if (resposta?.toUpperCase() === 'SÉRIE') {
        const correspondentes = lancamentos.filter(l => l.grupoRecorrenciaId === lanc.grupoRecorrenciaId);
        await Promise.all(correspondentes.map(l => deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', l.id))));
      }
    } else {
      if (window.confirm("Excluir permanentemente do banco de dados?")) await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id));
    }
  };

  const excluirValeInteiro = async (compraId: string) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    if (window.confirm("⚠️ Excluir o Vale e a dívida vinculada a ele?")) {
      await deleteDoc(doc(db, 'usuarios', userId, 'compras', compraId));
      const lancVinculado = lancamentos.find(l => l.compraId === compraId);
      if (lancVinculado) await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', lancVinculado.id));
      setCompraModal(null);
    }
  };

  const adiarVencimento = async (id: string, dias: number, dataAtualStr: string) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    const dataObj = new Date(dataAtualStr + 'T12:00:00'); dataObj.setDate(dataObj.getDate() + dias);
    await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', id), { dataVencimento: dataObj.toISOString().split('T')[0] });
  };

  const selecionarTodos = () => {
    if (selecionados.length === lancamentosFiltrados.length) setSelecionados([]);
    else setSelecionados(lancamentosFiltrados.map(l => l.id));
  };

  const aplicarCategoriaEmMassa = async () => {
    if (selecionados.length === 0) return alert("Selecione pelo menos um registro.");
    if (!categoriaLote) return alert("Escolha a categoria.");
    const userId = auth.currentUser?.uid as string; if (!userId) return;

    setProcessandoLote(true);
    try {
      const batch = writeBatch(db);
      selecionados.forEach(id => {
        const ref = doc(db, 'usuarios', userId, 'lancamentos', id);
        batch.update(ref, { categoria: categoriaLote });
      });
      await batch.commit();
      alert(`✅ Sucesso! ${selecionados.length} registros movidos para "${categoriaLote}".`);
      setModoSelecao(false); setSelecionados([]); setCategoriaLote('');
    } catch (error) {
      console.error(error); alert("Falha na gravação em lote.");
    }
    setProcessandoLote(false);
  };

  const relatorioFornecedores = useMemo(() => {
    let listaBase = fornecedores;
    if (fornecedorFiltro !== 'todos' && fornecedorFiltro !== '') listaBase = fornecedores.filter(f => f.id === fornecedorFiltro);
    return listaBase.map(f => {
      const faturasPendentes = lancamentos.filter(l => l.fornecedorId === f.id && l.status === 'pendente' && l.tipo === 'despesa');
      const faturasOrdenadas = faturasPendentes.sort((a, b) => {
        if (ordemFaturas === 'vencimento_asc') return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
        if (ordemFaturas === 'emissao_desc') return (new Date(b.dataLancamento || 0).getTime()) - (new Date(a.dataLancamento || 0).getTime());
        if (ordemFaturas === 'valor_desc') return b.valor - a.valor;
        if (ordemFaturas === 'valor_asc') return a.valor - b.valor;
        return 0;
      });
      return { ...f, faturas: faturasOrdenadas, totalDevendo: faturasPendentes.reduce((a, b) => a + b.valor, 0) };
    }).filter(f => f.totalDevendo > 0).sort((a, b) => b.totalDevendo - a.totalDevendo);
  }, [fornecedores, lancamentos, fornecedorFiltro, ordemFaturas]);

  const TOTAL_GERAL_DEVIDO = relatorioFornecedores.reduce((acc, forn) => acc + forn.totalDevendo, 0);

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      const dataLanc = new Date(l.dataVencimento + 'T12:00:00'); 
      const mes = dataLanc.getMonth() + 1; const ano = dataLanc.getFullYear();
      const matchBusca = l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase());
      const matchCat = categoriaFiltro === 'todos' || l.categoria === categoriaFiltro;
      return matchBusca && matchCat && (mesFiltro === 0 || mes === mesFiltro) && (anoFiltro === 0 || ano === anoFiltro) && (statusFiltro === 'todos' || l.status === statusFiltro) && (tipoFiltro === 'todos' || l.tipo === tipoFiltro) && (fornecedorFiltro === 'todos' || l.fornecedorId === fornecedorFiltro);
    }).sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
  }, [lancamentos, buscaDescricao, mesFiltro, anoFiltro, statusFiltro, tipoFiltro, fornecedorFiltro, categoriaFiltro]);

  const resumoFiltrado = useMemo(() => {
    const rec = lancamentosFiltrados.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
    const desp = lancamentosFiltrados.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
    return { receitas: rec, despesas: desp, saldo: rec - desp };
  }, [lancamentosFiltrados]);

  const diasCalendario = useMemo(() => {
    const primeiroDiaSemana = new Date(calAno, calMes - 1, 1).getDay();
    const totalDiasMes = new Date(calAno, calMes, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let i = 1; i <= totalDiasMes; i++) dias.push(`${calAno}-${String(calMes).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    return dias;
  }, [calAno, calMes]);

  const lancamentosDoCalendario = useMemo(() => {
    return lancamentos.filter(l => {
      const matchBusca = l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase());
      const matchCat = categoriaFiltro === 'todos' || l.categoria === categoriaFiltro;
      return matchBusca && matchCat && (statusFiltro === 'todos' || l.status === statusFiltro) && (tipoFiltro === 'todos' || l.tipo === tipoFiltro) && (fornecedorFiltro === 'todos' || l.fornecedorId === fornecedorFiltro);
    });
  }, [lancamentos, buscaDescricao, statusFiltro, tipoFiltro, fornecedorFiltro, categoriaFiltro]);

  const mudarMesCal = (dir: number) => { let nMes = calMes + dir; let nAno = calAno; if (nMes > 12) { nMes = 1; nAno++; } if (nMes < 1) { nMes = 12; nAno--; } setCalMes(nMes); setCalAno(nAno); };
  const lidarDragStart = (e: any, id: string) => e.dataTransfer.setData('lancId', id);
  const lidarDragOver = (e: any) => e.preventDefault(); 
  const lidarDrop = async (e: any, dataAlvo: string) => {
    e.preventDefault(); const idLanc = e.dataTransfer.getData('lancId'); if (!idLanc || !dataAlvo) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    try { const campo = modoArrastar === 'vencimento' ? 'dataVencimento' : 'dataLancamento'; await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', idLanc), { [campo]: dataAlvo }); } catch (err) { console.error(err); }
  };

  const getCorCategoria = (nomeCat: string) => {
    const cat = categoriasDespesa.find(c => c.nome === nomeCat);
    return cat ? cat.cor : '#94a3b8';
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-8 pb-32">
      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } #relatorio-financeiro-pdf, #relatorio-financeiro-pdf * { visibility: visible; } #relatorio-financeiro-pdf { position: absolute; left: 0; top: 0; width: 100%; color: #000; padding: 10px; } .no-print { display: none !important; } }`}} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div><h2 className="text-4xl font-black text-slate-800 tracking-tight">Terminal Financeiro</h2><p className="text-slate-500 font-medium mt-1">Gestão de liquidez e visibilidade avançada do seu caixa.</p></div>
        <button onClick={() => setMostrarRelatorio(!mostrarRelatorio)} className={`px-6 py-3.5 rounded-2xl font-black flex items-center gap-3 border transition-all duration-300 shadow-sm ${mostrarRelatorio ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}>
          <span className="text-lg">⚙️</span> {mostrarRelatorio ? 'Ocultar Filtros' : 'Filtros Avançados'}
        </button>
      </header>

      {mostrarRelatorio && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl no-print animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4 text-xs">
            <div className="lg:col-span-2"><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Busca Específica</label><input type="text" value={draftBusca} onChange={(e) => setDraftBusca(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500" placeholder="Buscar palavra..." /></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Mês</label><select value={draftMes} onChange={(e) => setDraftMes(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value={0}>Todos</option>{Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'short' })}</option>))}</select></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Ano</label><select value={draftAno} onChange={(e) => setDraftAno(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value={0}>Todos</option><option value={2025}>2025</option><option value={2026}>2026</option></select></div>
            <div className="lg:col-span-2"><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label><select value={draftCategoria} onChange={(e) => setDraftCategoria(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none truncate"><option value="todos">Qualquer</option>{categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Status</label><select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as any)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option></select></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Origem</label><select value={draftFornecedor} onChange={(e) => setDraftFornecedor(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none truncate"><option value="todos">Todos</option><option value="">Avulsos</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
            <button onClick={limparFiltros} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors">Limpar Filtros</button>
            <button onClick={aplicarFiltros} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-colors tracking-widest uppercase">Executar Filtro</button>
          </div>
        </div>
      )}

      {/* ABAS PREMIUM */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px no-print">
        <button onClick={() => setAbaAtiva('caixa')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 ${abaAtiva === 'caixa' ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 shadow-[0_-4px_15px_rgba(52,211,153,0.1)]' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>Terminal de Extrato</button>
        <button onClick={() => setAbaAtiva('fornecedores')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 ${abaAtiva === 'fornecedores' ? 'bg-rose-50 text-rose-600 border-t-2 border-rose-500' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>Dívidas Fornecedor</button>
        <button onClick={() => setAbaAtiva('calendario')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 ${abaAtiva === 'calendario' ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>Calendário Operacional</button>
      </div>

      {abaAtiva === 'caixa' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start animate-fade-in print:hidden">
          
          <div className="xl:col-span-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 h-fit sticky top-24">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="font-black text-xl text-slate-800 tracking-tight">{idEdicao ? 'Revisão de Registro' : 'Injeção de Dados'}</h3>
              
              <label className={`cursor-pointer group flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${processandoIA ? 'bg-slate-100 text-slate-400 pointer-events-none' : 'bg-slate-900 hover:bg-indigo-600 text-indigo-400 hover:text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/30'}`}>
                {processandoIA ? (
                  <><span className="w-2 h-2 rounded-full bg-slate-400 animate-ping"></span> Lendo...</>
                ) : (
                  <><span>✨</span> Escanear Recibo IA</>
                )}
                <input type="file" accept="image/*,application/pdf" onChange={lidarUploadComprovanteIA} className="hidden" />
              </label>

            </div>
            
            <form onSubmit={lidarSalvar} className="space-y-5">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button type="button" onClick={() => { setTipo('despesa'); setFornSelecionado(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tipo === 'despesa' ? 'bg-white text-rose-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Saída</button>
                <button type="button" onClick={() => { setTipo('receita'); setFornSelecionado(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tipo === 'receita' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Entrada</button>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
                <input type="text" required placeholder="Ex: Pagamento Mercado Livre" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">R$</span>
                    <input type="number" required step="0.01" placeholder="0.00" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black outline-none focus:border-indigo-500 font-mono text-slate-800" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Centro de Custo</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500">
                    <option value="">Geral</option>{categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data Emissão</label><input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vencimento</label><input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" /></div>
              </div>
              
              {tipo === 'despesa' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vincular a Fornecedor</label><select value={fornSelecionado} onChange={(e) => setFornSelecionado(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"><option value="">Nenhum (Avulso)</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
              )}
              
              {!idEdicao && (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3"><label className="flex items-center gap-3 font-black text-indigo-900 text-xs cursor-pointer"><input type="checkbox" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} className="w-5 h-5 accent-indigo-600" />🔁 Lançamento Mensal Recorrente?</label>{isRecorrente && (<div className="animate-fade-in"><label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1 mt-2">Duração (Meses)</label><input type="number" min="2" max="36" value={mesesRepetir} onChange={(e) => setMesesRepetir(e.target.value)} className="w-full px-4 py-3 border border-indigo-200 rounded-xl font-black text-lg text-indigo-600 bg-white outline-none" /></div>)}</div>
              )}
              
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="submit" className={`flex-1 py-4 rounded-xl font-black text-white text-sm tracking-widest uppercase shadow-lg transition-transform hover:scale-105 ${tipo === 'despesa' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'}`}>{idEdicao ? 'Atualizar Registro' : 'Salvar Registro'}</button>
                {idEdicao && <button type="button" onClick={limparFormulario} className="px-6 bg-slate-200 text-slate-600 font-black uppercase text-xs rounded-xl hover:bg-slate-300">Cancelar</button>}
              </div>
            </form>
          </div>

          <div className="xl:col-span-8 space-y-6">
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5 text-4xl">💰</div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Receitas Validadas</p>
                <p className="text-2xl font-black text-white font-mono tracking-tight">R$ {resumoFiltrado.receitas.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5 text-4xl">📉</div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Saídas Processadas</p>
                <p className="text-2xl font-black text-white font-mono tracking-tight">R$ {resumoFiltrado.despesas.toFixed(2)}</p>
              </div>
              <div className="bg-black p-5 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.1)] border border-emerald-900/50 flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none"></div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 relative z-10 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Saldo Líquido</p>
                <p className={`text-2xl font-black font-mono tracking-tight relative z-10 ${resumoFiltrado.saldo >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>R$ {resumoFiltrado.saldo.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-[#0b1120] rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative">
              
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none z-0 opacity-20"></div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 opacity-80"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500 opacity-80"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-80"></span>
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Extrato Financeiro</p>
                </div>
                
                <button onClick={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }} className={`mt-4 sm:mt-0 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all border ${modoSelecao ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.2)]' : 'bg-slate-800 text-blue-400 hover:text-white border-slate-700 hover:border-blue-500'}`}>
                  {modoSelecao ? '✕ Cancelar Seleção' : '✏️ Edição em Lote'}
                </button>
              </div>

              {modoSelecao && (
                <div className="bg-blue-900/20 border-b border-blue-500/30 p-4 flex flex-wrap gap-4 items-center justify-between relative z-10 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <button onClick={selecionarTodos} className="text-[10px] font-black uppercase font-mono bg-blue-950 border border-blue-500 text-blue-400 hover:bg-blue-900 hover:text-white px-3 py-2 rounded transition-colors">Selecionar Todos</button>
                    <span className="text-xs font-mono text-blue-300 font-bold">[{selecionados.length} itens selecionados]</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select value={categoriaLote} onChange={e => setCategoriaLote(e.target.value)} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded font-mono text-xs text-blue-400 outline-none focus:border-blue-500 flex-1">
                      <option value="">Escolher Nova Categoria...</option>
                      {categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                      <option value="Geral">Pasta Geral</option>
                    </select>
                    <button onClick={aplicarCategoriaEmMassa} disabled={processandoLote || selecionados.length === 0 || !categoriaLote} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black font-mono rounded text-xs transition-all disabled:opacity-50">
                      {processandoLote ? 'Aplicando...' : 'Aplicar Lote'}
                    </button>
                  </div>
                </div>
              )}

              <div className="relative z-10">
                {lancamentosFiltrados.length === 0 ? (
                  <div className="p-16 text-center">
                    <span className="text-4xl text-slate-700 block mb-3 font-mono">_</span>
                    <p className="font-mono text-slate-500 text-sm uppercase tracking-widest">Nenhum registro encontrado no período.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {lancamentosFiltrados.map(lanc => {
                      const isAtrasado = lanc.status === 'pendente' && lanc.tipo === 'despesa' && lanc.dataVencimento < new Date().toISOString().split('T')[0];
                      const selecionado = selecionados.includes(lanc.id);

                      return (
                        <div key={lanc.id} className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-800/50 ${lanc.status === 'pago' ? 'opacity-60 grayscale-[50%]' : ''} ${selecionado ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : 'border-l-4 border-transparent'}`}>
                          
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {modoSelecao && (
                              <input type="checkbox" checked={selecionado} onChange={() => { if(selecionado) setSelecionados(selecionados.filter(i=>i!==lanc.id)); else setSelecionados([...selecionados, lanc.id]); }} className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0 rounded bg-slate-900 border-slate-700" />
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-1.5">
                                {!modoSelecao && (
                                  <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${lanc.tipo === 'despesa' ? 'bg-rose-500 text-rose-500' : 'bg-emerald-500 text-emerald-500'}`}></div>
                                )}
                                <p className={`font-bold text-sm truncate ${lanc.tipo === 'despesa' ? 'text-slate-200' : 'text-emerald-100'}`}>{lanc.descricao}</p>
                                
                                {lanc.recorrente && <span className="bg-blue-900/50 text-blue-400 border border-blue-500/30 text-[9px] font-black font-mono px-1.5 py-0.5 rounded">MENSAL</span>}
                                {lanc.categoria && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border opacity-80" style={{ borderColor: getCorCategoria(lanc.categoria), color: getCorCategoria(lanc.categoria), backgroundColor: `${getCorCategoria(lanc.categoria)}15` }}>{lanc.categoria}</span>}
                              </div>
                              <p className="text-[10px] font-mono text-slate-500">
                                Emissão: {lanc.dataLancamento ? lanc.dataLancamento.split('-').reverse().join('/') : '---'} // Vencimento: <span className={isAtrasado ? 'text-rose-500 font-bold bg-rose-500/10 px-1 rounded' : 'text-slate-400'}>{lanc.dataVencimento.split('-').reverse().join('/')}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-5">
                            <span className={`font-mono text-xl font-black tracking-tight ${lanc.tipo === 'despesa' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {lanc.tipo === 'despesa' ? '-' : '+'}R${lanc.valor.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => alternarStatus(lanc)} disabled={modoSelecao} className={`px-4 py-2 text-[10px] font-black uppercase font-mono rounded border transition-all disabled:opacity-30 ${lanc.status === 'pago' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/50 hover:bg-emerald-500 hover:text-white shadow-[0_0_10px_rgba(52,211,153,0.1)]'}`}>
                                {lanc.status === 'pago' ? 'Desfazer' : 'Pagar'}
                              </button>
                              <button onClick={() => iniciarEdicao(lanc)} disabled={modoSelecao} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-700 transition-colors disabled:opacity-30">✏️</button>
                              <button onClick={() => excluirLancamento(lanc)} disabled={modoSelecao} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-rose-500 hover:bg-rose-500 hover:text-white rounded border border-slate-700 transition-colors disabled:opacity-30">✕</button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: FORNECEDORES (Clean e Direto) */}
      {abaAtiva === 'fornecedores' && (
        <div className="space-y-6 animate-fade-in print:hidden pb-32">
          {relatorioFornecedores.length > 0 && (
            <div className="flex justify-end"><select value={ordemFaturas} onChange={(e) => setOrdemFaturas(e.target.value as any)} className="bg-white border border-slate-300 text-xs font-bold text-slate-700 rounded-xl px-4 py-3 shadow-sm outline-none"><option value="vencimento_asc">Organizar por Vencimento</option><option value="emissao_desc">Organizar por Emissão (Mais Recentes)</option><option value="valor_desc">Organizar por Valor (Maior primeiro)</option><option value="valor_asc">Organizar por Valor (Menor primeiro)</option></select></div>
          )}
          {relatorioFornecedores.length === 0 ? <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 font-bold text-slate-400">Nenhuma fatura de fornecedor vinculada.</div> : (
            relatorioFornecedores.map(forn => (
              <div key={forn.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="bg-slate-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
                  <div><h3 className="text-xl font-black">{forn.nome}</h3></div>
                  <div className="text-right"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Pendente</p><p className="text-3xl font-black text-rose-400 font-mono tracking-tight">R$ {forn.totalDevendo.toFixed(2)}</p></div>
                </div>
                <div className="p-4 bg-slate-50"><div className="space-y-3">
                  {forn.faturas.map(fat => {
                    const compData = compras.find(c => c.id === fat.compraId);
                    return (
                      <div key={fat.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="w-full md:w-auto"><p className="font-bold text-slate-800 text-sm">{fat.descricao}</p><p className="text-xs text-slate-500 mt-1 font-mono">Vence: {fat.dataVencimento.split('-').reverse().join('/')}</p></div>
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto justify-end">
                          <span className="font-black text-rose-600 text-lg font-mono">R$ {fat.valor.toFixed(2)}</span>
                          <div className="flex gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200"><button onClick={() => adiarVencimento(fat.id, 7, fat.dataVencimento)} className="px-3 py-1.5 bg-white hover:bg-blue-50 text-[10px] font-black text-blue-600 rounded-lg shadow-sm uppercase">+7 Dias</button><button onClick={() => adiarVencimento(fat.id, 15, fat.dataVencimento)} className="px-3 py-1.5 bg-white hover:bg-blue-50 text-[10px] font-black text-blue-600 rounded-lg shadow-sm uppercase">+15 Dias</button></div>
                          <div className="flex border border-slate-200 rounded-xl overflow-hidden shadow-sm"><button onClick={() => iniciarEdicao(fat)} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm">✏️</button><button onClick={() => excluirLancamento(fat)} className="px-4 py-2.5 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-500 text-sm border-l border-slate-200 transition-colors">✕</button></div>
                          {compData && <button onClick={() => setCompraModal(compData)} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md">📄 Ver Vale</button>}
                          <button onClick={() => alternarStatus(fat)} className="px-5 py-2.5 bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-colors">Pagar</button>
                        </div>
                      </div>
                    )
                  })}
                </div></div>
              </div>
            ))
          )}
          {relatorioFornecedores.length > 0 && (
            <div className="bg-rose-950 p-8 rounded-3xl shadow-xl border border-rose-900 text-white flex flex-col md:flex-row justify-between items-center gap-6 mt-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10"><h3 className="text-xl font-black text-rose-300 uppercase tracking-widest mb-1">Risco Fornecedores</h3><p className="text-sm text-rose-400/80 font-medium">Soma de todas as faturas pendentes da fábrica.</p></div>
              <div className="text-5xl font-black tracking-tight text-white bg-black/40 px-6 py-4 rounded-2xl border border-rose-500/30 relative z-10 font-mono shadow-[0_0_30px_rgba(225,29,72,0.2)]">R$ {TOTAL_GERAL_DEVIDO.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: CALENDÁRIO */}
      {abaAtiva === 'calendario' && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-fade-in print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Calendário Drag & Drop</h3>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200"><button onClick={() => setModoArrastar('vencimento')} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${modoArrastar === 'vencimento' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>Alvo: Vencimento</button><button onClick={() => setModoArrastar('emissao')} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${modoArrastar === 'emissao' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>Alvo: Emissão</button></div>
              <div className="flex gap-2 bg-slate-900 p-1.5 rounded-2xl shadow-lg border border-slate-800"><button onClick={() => mudarMesCal(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">◀</button><h3 className="text-sm font-black text-white w-32 text-center uppercase tracking-widest self-center">{new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'short' })} {calAno}</h3><button onClick={() => mudarMesCal(1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">▶</button></div>
            </div>
          </div>
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200"><div className="min-w-[900px]">
            <div className="grid grid-cols-7 bg-slate-900 text-white overflow-hidden">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="p-4 text-center text-xs font-black uppercase tracking-widest">{d}</div>)}</div>
            <div className="grid grid-cols-7 bg-slate-50">
              {diasCalendario.map((dataStr, index) => {
                if (!dataStr) return <div key={`e-${index}`} className="bg-slate-100 border-r border-b border-slate-200 min-h-[140px]"></div>;
                const faturasDoDia = lancamentosDoCalendario.filter(l => (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)) === dataStr);
                const isHoje = dataStr === new Date().toISOString().split('T')[0];
                return (
                  <div key={dataStr} onDragOver={lidarDragOver} onDrop={(e) => lidarDrop(e, dataStr)} className={`min-h-[140px] p-2 border-r border-b border-slate-200 transition-colors hover:bg-blue-50/50 ${isHoje ? 'bg-indigo-50/30' : 'bg-white'}`}>
                    <p className={`text-xs font-black mb-2 flex justify-between ${isHoje ? 'text-indigo-600' : 'text-slate-400'}`}><span>{parseInt(dataStr.split('-')[2])}</span> {isHoje && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>}</p>
                    <div className="space-y-1.5">{faturasDoDia.map(fat => (
                      <div key={fat.id} draggable onDragStart={(e) => lidarDragStart(e, fat.id)} className={`p-1.5 text-[10px] rounded-lg shadow-sm cursor-grab border ${fat.status === 'pago' ? 'opacity-40 grayscale' : ''} ${fat.tipo === 'despesa' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                        <p className="truncate font-bold mb-0.5">{fat.descricao}</p><p className="font-black font-mono tracking-tight">R$ {fat.valor.toFixed(2)}</p>
                      </div>
                    ))}</div>
                  </div>
                );
              })}
            </div>
          </div></div>

          <div className="mt-8 flex flex-col md:flex-row justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Resumo: {new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'long' })}</p>
            <div className="flex gap-8 relative z-10">
              <div className="text-right"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Receitas (+)</p><p className="font-black text-white text-2xl font-mono">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'receita' && (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)).startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
              <div className="w-px bg-slate-800"></div>
              <div className="text-right"><p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Despesas (-)</p><p className="font-black text-white text-2xl font-mono">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'despesa' && (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)).startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
            </div>
          </div>
        </div>
      )}

      <div id="relatorio-financeiro-pdf" className="hidden print:block w-full">
        <h1 className="text-2xl font-black text-slate-900 uppercase mb-6 border-b-2 border-slate-800 pb-2">Relatório Extraído</h1>
        <table className="w-full text-left text-xs border-collapse">
          <thead><tr className="bg-slate-100"><th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2">Categoria</th><th className="p-2 text-right">Valor</th></tr></thead>
          <tbody>{lancamentosFiltrados.map(l => (<tr key={l.id} className="border-b border-slate-200"><td className="p-2">{l.dataVencimento.split('-').reverse().join('/')}</td><td className="p-2">{l.descricao}</td><td className="p-2">{l.categoria}</td><td className={`p-2 text-right font-black ${l.tipo==='despesa'?'text-rose-600':'text-emerald-600'}`}>R$ {l.valor.toFixed(2)}</td></tr>))}</tbody>
        </table>
      </div>

      {compraModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-center items-center p-4 animate-fade-in no-print">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl"></div>
              <div className="relative z-10"><p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Detalhes do Vale</p><h3 className="text-3xl font-black tracking-tight">{compraModal.codigoOrdem}</h3></div>
              <button onClick={() => setCompraModal(null)} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full font-black text-xl flex items-center justify-center transition-colors relative z-10">✕</button>
            </div>
            <div className="p-8 overflow-y-auto"><div className="grid grid-cols-2 gap-6 mb-8 border-b border-slate-100 pb-8"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fornecedor</p><p className="font-black text-slate-800 text-xl">{compraModal.fornecedorNome}</p></div><div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NF / Vale Relacionado</p><p className="font-black text-slate-800 text-xl font-mono">{compraModal.numeroVale || 'N/A'}</p></div></div>
              <div className="space-y-3 mb-6">{compraModal.itens.map(item => (<div key={item.produtoId} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100"><div><p className="font-black text-slate-800">{item.nome}</p><p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{item.quantidade} UN x R$ {item.custoUnitario.toFixed(2)}</p></div><span className="font-black text-slate-900 text-lg font-mono tracking-tight">R$ {item.subtotal.toFixed(2)}</span></div>))}</div>
            </div>
            <div className="bg-slate-50 p-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-6 mt-auto"><button onClick={() => excluirValeInteiro(compraModal.id)} className="px-6 py-3 text-rose-600 hover:text-white bg-white hover:bg-rose-600 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-widest transition-colors w-full sm:w-auto">🗑️ Excluir Vale Completo</button><div className="text-center sm:text-right w-full sm:w-auto"><p className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-1">Total do Vale</p><p className="text-4xl font-black text-slate-900 font-mono tracking-tight">R$ {compraModal.valorTotal.toFixed(2)}</p></div></div>
          </div>
        </div>
      )}
    </div>
  );
}