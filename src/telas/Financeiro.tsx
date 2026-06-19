import { useState, useMemo } from 'react';
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

  // --- ESTADOS DE EDIÇÃO EM MASSA ---
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
    setCategoriaFiltro(draftCategoria);
    setSelecionados([]); // Limpa seleção ao filtrar para evitar bugs
  };

  const limparFiltros = () => {
    setDraftBusca(''); setBuscaDescricao(''); setDraftMes(0); setMesFiltro(0);
    setDraftAno(0); setAnoFiltro(0); setDraftStatus('todos'); setStatusFiltro('todos');
    setDraftTipo('todos'); setTipoFiltro('todos'); setDraftFornecedor('todos'); setFornecedorFiltro('todos');
    setDraftCategoria('todos'); setCategoriaFiltro('todos');
    setSelecionados([]);
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
      
      alert("✅ IA leu o comprovante! Confirme e Salve.");
    } catch (error: any) {
      alert(`❌ Erro técnico IA:\n\n${error.message}`);
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
    setIsRecorrente(false); window.scrollTo({ top: 0, behavior: 'smooth' });
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
      const resposta = window.prompt("Este boleto faz parte de uma sequência repetida!\n\nDigite 'APENAS' para excluir só este mês.\nDigite 'SÉRIE' para apagar todas as parcelas futuras dessa assinatura:");
      if (resposta?.toUpperCase() === 'APENAS') await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id));
      else if (resposta?.toUpperCase() === 'SÉRIE') {
        const correspondentes = lancamentos.filter(l => l.grupoRecorrenciaId === lanc.grupoRecorrenciaId);
        await Promise.all(correspondentes.map(l => deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', l.id))));
      }
    } else {
      if (window.confirm("Excluir permanentemente?")) await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id));
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

  // --- LÓGICA DE EDIÇÃO EM MASSA (BATCH) ---
  const selecionarTodos = () => {
    if (selecionados.length === lancamentosFiltrados.length) setSelecionados([]);
    else setSelecionados(lancamentosFiltrados.map(l => l.id));
  };

  const aplicarCategoriaEmMassa = async () => {
    if (selecionados.length === 0) return alert("Selecione pelo menos um lançamento.");
    if (!categoriaLote) return alert("Escolha a categoria que deseja aplicar.");
    const userId = auth.currentUser?.uid as string; if (!userId) return;

    setProcessandoLote(true);
    try {
      const batch = writeBatch(db);
      selecionados.forEach(id => {
        const ref = doc(db, 'usuarios', userId, 'lancamentos', id);
        batch.update(ref, { categoria: categoriaLote });
      });
      await batch.commit();
      alert(`✅ ${selecionados.length} lançamentos atualizados para "${categoriaLote}"!`);
      setModoSelecao(false);
      setSelecionados([]);
      setCategoriaLote('');
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar em massa.");
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

  // CALENDÁRIO DRAG AND DROP LOGIC
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
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6 relative">
      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } #relatorio-financeiro-pdf, #relatorio-financeiro-pdf * { visibility: visible; } #relatorio-financeiro-pdf { position: absolute; left: 0; top: 0; width: 100%; color: #000; padding: 10px; } .no-print { display: none !important; } }`}} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div><h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>💰</span> Fluxo de Caixa Mestre</h2></div>
        <button onClick={() => setMostrarRelatorio(!mostrarRelatorio)} className={`px-5 py-3 rounded-xl font-bold flex items-center gap-2 border transition-all ${mostrarRelatorio ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-slate-700 border-slate-300 shadow-sm'}`}>🔍 Buscar & Filtros</button>
      </header>

      {mostrarRelatorio && (
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-lg space-y-5 no-print animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 text-xs">
            <div className="lg:col-span-2"><label className="block font-bold text-slate-500 uppercase mb-1">Buscar Palavra</label><input type="text" value={draftBusca} onChange={(e) => setDraftBusca(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" /></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Mês</label><select value={draftMes} onChange={(e) => setDraftMes(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value={0}>Todos</option>{Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'short' })}</option>))}</select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Ano</label><select value={draftAno} onChange={(e) => setDraftAno(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value={0}>Todos</option><option value={2025}>2025</option><option value={2026}>2026</option></select></div>
            <div className="lg:col-span-2"><label className="block font-bold text-rose-500 uppercase mb-1">Categoria Contábil</label><select value={draftCategoria} onChange={(e) => setDraftCategoria(e.target.value)} className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-lg font-bold text-rose-800 outline-none truncate"><option value="todos">Todas as Categorias</option>{categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Status</label><select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as any)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option></select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Fornecedor</label><select value={draftFornecedor} onChange={(e) => setDraftFornecedor(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none truncate"><option value="todos">Qualquer</option><option value="">Avulsos</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100"><button onClick={limparFiltros} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200">Limpar</button><button onClick={aplicarFiltros} className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl text-xs shadow-md hover:bg-blue-700">🔍 Buscar Agora</button><button onClick={() => window.print()} className="px-6 py-2.5 bg-slate-900 text-white font-black rounded-xl text-xs">🖨️ PDF</button></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px no-print">
        <button onClick={() => setAbaAtiva('caixa')} className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'caixa' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>💵 Lançar & Extrato</button>
        <button onClick={() => setAbaAtiva('fornecedores')} className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'fornecedores' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>🏭 Dívidas Fornecedor</button>
        <button onClick={() => setAbaAtiva('calendario')} className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-all flex items-center gap-2 ${abaAtiva === 'calendario' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>📅 Calendário Arrastável</button>
      </div>

      {abaAtiva === 'caixa' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start animate-fade-in print:hidden">
          <div className="xl:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit sticky top-6">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h3 className="font-black text-lg text-slate-800">{idEdicao ? '✏️ Editando' : '➕ Novo'} Lançamento</h3>
              <label className={`cursor-pointer bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 transition-all ${processandoIA ? 'opacity-50 pointer-events-none' : ''}`}>
                {processandoIA ? '⏳ Analisando...' : '✨ Ler Recibo'}
                <input type="file" accept="image/*,application/pdf" onChange={lidarUploadComprovanteIA} className="hidden" />
              </label>
            </div>
            <form onSubmit={lidarSalvar} className="space-y-4">
              <div className="flex bg-slate-100 p-1.5 rounded-xl"><button type="button" onClick={() => { setTipo('despesa'); setFornSelecionado(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tipo === 'despesa' ? 'bg-white text-rose-600 border border-slate-200' : 'text-slate-500'}`}>Despesa (-)</button><button type="button" onClick={() => { setTipo('receita'); setFornSelecionado(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tipo === 'receita' ? 'bg-white text-emerald-600 border border-slate-200' : 'text-slate-500'}`}>Receita (+)</button></div>
              <input type="text" required placeholder="Descrição da conta" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" required step="0.01" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none" />
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
                  <option value="">Sem Categoria</option>{categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Emissão</label><input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vencimento</label><input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
              </div>
              {tipo === 'despesa' && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100"><label className="block text-[10px] font-bold text-rose-500 uppercase mb-1">Vincular Fornecedor (Opcional)</label><select value={fornSelecionado} onChange={(e) => setFornSelecionado(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-rose-200 rounded-lg text-sm font-bold text-slate-700 outline-none"><option value="">Nenhum</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
              )}
              {!idEdicao && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2"><label className="flex items-center gap-2 font-bold text-slate-700 text-xs cursor-pointer select-none"><input type="checkbox" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} className="w-4 h-4 accent-blue-600" />🔁 Repetir Lançamento (Mensal)?</label>{isRecorrente && (<div className="animate-fade-in"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Repetir por quantos meses?</label><input type="number" min="2" max="36" value={mesesRepetir} onChange={(e) => setMesesRepetir(e.target.value)} className="w-full px-3 py-2 border rounded-xl font-black text-sm text-blue-600" /></div>)}</div>
              )}
              <div className="flex gap-2 pt-2"><button type="submit" className={`flex-1 py-3.5 rounded-xl font-black text-white shadow-md ${tipo === 'despesa' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{idEdicao ? 'Atualizar' : 'Salvar'}</button>{idEdicao && <button type="button" onClick={limparFormulario} className="px-5 bg-slate-200 text-slate-600 font-bold rounded-xl">Voltar</button>}</div>
            </form>
          </div>

          <div className="xl:col-span-8 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center"><p className="text-[10px] font-bold text-slate-500 uppercase">Receitas (+)</p><p className="text-xl font-black text-emerald-600">R$ {resumoFiltrado.receitas.toFixed(2)}</p></div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center"><p className="text-[10px] font-bold text-slate-500 uppercase">Despesas (-)</p><p className="text-xl font-black text-rose-600">R$ {resumoFiltrado.despesas.toFixed(2)}</p></div>
              <div className="bg-slate-800 p-4 rounded-xl shadow-md border border-slate-900 text-center text-white"><p className="text-[10px] font-bold text-slate-400 uppercase">Saldo do Extrato</p><p className={`text-xl font-black ${resumoFiltrado.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {resumoFiltrado.saldo.toFixed(2)}</p></div>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              
              {/* O HEADER COM O BOTÃO DE EDIÇÃO EM MASSA */}
              <div className="flex justify-between items-center px-4 pt-3 pb-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Extrato do Período</p>
                <button onClick={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors shadow-sm border ${modoSelecao ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {modoSelecao ? '✕ Cancelar Seleção' : '✏️ Edição em Massa'}
                </button>
              </div>

              {/* O PAINEL DE CONTROLE DE LOTE (MÁGICA) */}
              {modoSelecao && (
                <div className="m-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-wrap gap-4 items-center justify-between animate-fade-in shadow-inner">
                  <div className="flex items-center gap-3">
                    <button onClick={selecionarTodos} className="text-[10px] font-black uppercase bg-white border border-indigo-200 text-indigo-600 px-3 py-2 rounded-lg shadow-sm hover:bg-indigo-100 transition-colors">Selecionar Todos</button>
                    <span className="text-sm font-black text-indigo-900">{selecionados.length} selecionados</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select value={categoriaLote} onChange={e => setCategoriaLote(e.target.value)} className="px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-slate-700 outline-none flex-1">
                      <option value="">Escolher Nova Pasta...</option>
                      {categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                      <option value="Geral">Limpar Categoria (Geral)</option>
                    </select>
                    <button onClick={aplicarCategoriaEmMassa} disabled={processandoLote || selecionados.length === 0 || !categoriaLote} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-sm shadow-md transition-all disabled:opacity-50">
                      {processandoLote ? 'Aplicando...' : 'Aplicar'}
                    </button>
                  </div>
                </div>
              )}

              {lancamentosFiltrados.length === 0 ? <div className="p-10 text-center text-slate-400 font-bold">Nenhum lançamento encontrado.</div> : (
                <div className="divide-y divide-slate-100">
                  {lancamentosFiltrados.map(lanc => {
                    const isAtrasado = lanc.status === 'pendente' && lanc.tipo === 'despesa' && lanc.dataVencimento < new Date().toISOString().split('T')[0];
                    const selecionado = selecionados.includes(lanc.id);

                    return (
                      <div key={lanc.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${lanc.status === 'pago' ? 'bg-slate-50/50 opacity-60' : 'bg-white hover:bg-slate-50'} ${selecionado ? 'bg-indigo-50/50 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          
                          {/* CHECKBOX DE SELEÇÃO */}
                          {modoSelecao && (
                            <input type="checkbox" checked={selecionado} onChange={() => { if(selecionado) setSelecionados(selecionados.filter(i=>i!==lanc.id)); else setSelecionados([...selecionados, lanc.id]); }} className="w-5 h-5 accent-indigo-600 cursor-pointer shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {!modoSelecao && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${lanc.tipo === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>}
                              <p className={`font-black text-base truncate text-slate-800`}>{lanc.descricao}</p>
                              {lanc.recorrente && <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black px-1.5 py-0.5 rounded">🔁 Mensal</span>}
                              {lanc.categoria && <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-white shadow-sm" style={{ backgroundColor: getCorCategoria(lanc.categoria) }}>{lanc.categoria}</span>}
                            </div>
                            <p className="text-xs font-bold text-slate-500">Emitido: {lanc.dataLancamento ? lanc.dataLancamento.split('-').reverse().join('/') : '---'} • Vence: <span className={isAtrasado ? 'text-rose-600 font-black' : ''}>{lanc.dataVencimento.split('-').reverse().join('/')}</span></p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3"><span className={`font-black text-xl ${lanc.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}`}>R$ {lanc.valor.toFixed(2)}</span><button onClick={() => alternarStatus(lanc)} className="px-4 py-2 text-xs font-black uppercase rounded-xl border bg-white shadow-sm disabled:opacity-50" disabled={modoSelecao}>{lanc.status === 'pago' ? 'Desfazer' : 'Pagar'}</button><button onClick={() => excluirLancamento(lanc)} className="text-slate-300 hover:text-rose-500 p-1 disabled:opacity-50" disabled={modoSelecao}>🗑️</button></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {abaAtiva === 'fornecedores' && (
        <div className="space-y-6 animate-fade-in print:hidden pb-32">
          {relatorioFornecedores.length > 0 && (
            <div className="flex justify-end"><select value={ordemFaturas} onChange={(e) => setOrdemFaturas(e.target.value as any)} className="bg-white border border-slate-300 text-xs font-bold text-slate-700 rounded-xl px-4 py-3 shadow-sm outline-none"><option value="vencimento_asc">Organizar por Vencimento</option><option value="emissao_desc">Organizar por Emissão (Mais Recentes)</option><option value="valor_desc">Organizar por Valor (Maior primeiro)</option><option value="valor_asc">Organizar por Valor (Menor primeiro)</option></select></div>
          )}
          {relatorioFornecedores.length === 0 ? <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 font-bold text-slate-400">Nenhuma fatura de fornecedor vinculada.</div> : (
            relatorioFornecedores.map(forn => (
              <div key={forn.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
                  <div><h3 className="text-xl font-black">{forn.nome}</h3></div>
                  <div className="text-right"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Devido</p><p className="text-3xl font-black text-rose-400">R$ {forn.totalDevendo.toFixed(2)}</p></div>
                </div>
                <div className="p-4 bg-slate-50"><div className="space-y-3">
                  {forn.faturas.map(fat => {
                    const compData = compras.find(c => c.id === fat.compraId);
                    return (
                      <div key={fat.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl flex justify-between items-center">
                        <div><p className="font-bold text-slate-800">{fat.descricao}</p><p className="text-xs text-slate-500">Vence: {fat.dataVencimento.split('-').reverse().join('/')}</p></div>
                        <div className="flex items-center gap-3"><span className="font-black text-rose-600 text-lg">R$ {fat.valor.toFixed(2)}</span><div className="flex gap-1 bg-slate-100 p-1 rounded-lg"><button onClick={() => adiarVencimento(fat.id, 7, fat.dataVencimento)} className="px-2.5 py-1 bg-white text-[10px] font-bold text-slate-600 rounded shadow-sm">+7 Dias</button><button onClick={() => adiarVencimento(fat.id, 15, fat.dataVencimento)} className="px-2.5 py-1 bg-white text-[10px] font-bold text-slate-600 rounded shadow-sm">+15 Dias</button></div><div className="flex border border-slate-200 rounded-lg overflow-hidden"><button onClick={() => iniciarEdicao(fat)} className="px-3 py-2 bg-slate-50 text-xs font-bold">✏️</button><button onClick={() => excluirLancamento(fat)} className="px-3 py-2 bg-rose-50 text-rose-500 text-xs font-bold border-l">🗑️</button></div>{compData && <button onClick={() => setCompraModal(compData)} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-black">📄 Vale</button>}<button onClick={() => alternarStatus(fat)} className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black uppercase">Pagar</button></div>
                      </div>
                    )
                  })}
                </div></div>
              </div>
            ))
          )}
          {relatorioFornecedores.length > 0 && (
            <div className="bg-rose-900 p-8 rounded-3xl shadow-xl border border-rose-800 text-white flex flex-col md:flex-row justify-between items-center gap-6 mt-8"><div><h3 className="text-xl font-bold text-rose-200 uppercase tracking-widest mb-1">Risco Total em Fornecedores</h3><p className="text-sm text-rose-300">Soma de todas as faturas pendentes da fábrica (Independente de Mês).</p></div><div className="text-5xl font-black tracking-tight text-white bg-rose-950/50 px-6 py-4 rounded-2xl border border-rose-800/50">R$ {TOTAL_GERAL_DEVIDO.toFixed(2)}</div></div>
          )}
        </div>
      )}

      {abaAtiva === 'calendario' && (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 animate-fade-in print:hidden">
          <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-slate-800">Calendário de Movimentações</h3>
            <div className="flex bg-slate-900 p-1.5 rounded-xl shadow-inner border border-slate-800 mr-4"><button onClick={() => setModoArrastar('vencimento')} className={`px-4 py-2 text-xs font-black rounded-lg transition-all uppercase ${modoArrastar === 'vencimento' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>🎯 Vencimentos</button><button onClick={() => setModoArrastar('emissao')} className={`px-4 py-2 text-xs font-black rounded-lg transition-all uppercase ${modoArrastar === 'emissao' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>📄 Emissões</button></div>
            <div className="flex gap-2"><button onClick={() => mudarMesCal(-1)} className="p-2 bg-slate-100 rounded-lg font-bold">◀ Mês Anterior</button><h3 className="text-lg font-black text-slate-800 w-32 text-center uppercase tracking-wider self-center">{new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'short' })} {calAno}</h3><button onClick={() => mudarMesCal(1)} className="p-2 bg-slate-100 rounded-lg font-bold">Próximo Mês ▶</button></div>
          </div>
          <div className="w-full overflow-x-auto"><div className="min-w-[800px]">
            <div className="grid grid-cols-7 bg-slate-800 text-white rounded-t-xl overflow-hidden">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="p-3 text-center text-xs font-black uppercase">{d}</div>)}</div>
            <div className="grid grid-cols-7 border-l border-slate-200">
              {diasCalendario.map((dataStr, index) => {
                if (!dataStr) return <div key={`e-${index}`} className="bg-slate-50 border-r border-b border-slate-200 min-h-[120px]"></div>;
                const faturasDoDia = lancamentosDoCalendario.filter(l => (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)) === dataStr);
                return (
                  <div key={dataStr} onDragOver={lidarDragOver} onDrop={(e) => lidarDrop(e, dataStr)} className="min-h-[120px] p-2 border-r border-b border-slate-200 bg-white">
                    <p className="text-xs font-black text-slate-400 mb-2">{parseInt(dataStr.split('-')[2])}</p>
                    <div className="space-y-1">{faturasDoDia.map(fat => (
                      <div key={fat.id} draggable onDragStart={(e) => lidarDragStart(e, fat.id)} className={`p-1 text-[9px] border-l-4 rounded shadow-sm cursor-grab ${fat.tipo === 'despesa' ? 'bg-rose-50 border-rose-500 text-rose-800' : 'bg-emerald-50 border-emerald-500 text-emerald-800'}`}>
                        <p className="truncate font-bold">{fat.descricao}</p><p className="font-black">R$ {fat.valor.toFixed(2)}</p>
                      </div>
                    ))}</div>
                  </div>
                );
              })}
            </div>
          </div></div>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in no-print">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center"><div><p className="text-xs text-slate-400 font-bold uppercase mb-1">Recibo do Vale</p><h3 className="text-2xl font-black">{compraModal.codigoOrdem}</h3></div><button onClick={() => setCompraModal(null)} className="w-10 h-10 bg-slate-800 rounded-full font-black text-xl">✕</button></div>
            <div className="p-6 overflow-y-auto"><div className="grid grid-cols-2 gap-4 mb-6 border-b pb-6"><div><p className="text-[10px] font-bold text-slate-400 uppercase">Fornecedor</p><p className="font-black text-slate-800 text-lg">{compraModal.fornecedorNome}</p></div><div className="text-right"><p className="text-[10px] font-bold text-slate-400 uppercase">NF / Vale Relacionado</p><p className="font-black text-slate-800 text-lg">{compraModal.numeroVale || 'N/A'}</p></div></div>
              <div className="space-y-2 mb-6">{compraModal.itens.map(item => (<div key={item.produtoId} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"><div><p className="font-bold text-slate-800 text-sm">{item.nome}</p><p className="text-[10px] font-bold text-slate-500">{item.quantidade}x R$ {item.custoUnitario.toFixed(2)}</p></div><span className="font-black text-slate-700">R$ {item.subtotal.toFixed(2)}</span></div>))}</div>
            </div>
            <div className="bg-slate-100 p-6 border-t border-slate-200 flex justify-between items-center mt-auto"><button onClick={() => excluirValeInteiro(compraModal.id)} className="px-4 py-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg text-xs font-black">🗑️ Excluir Vale Completo</button><div className="text-right"><p className="font-bold text-slate-500 uppercase">Total do Vale</p><p className="text-3xl font-black text-slate-900">R$ {compraModal.valorTotal.toFixed(2)}</p></div></div>
          </div>
        </div>
      )}
    </div>
  );
}