import { useState, useMemo } from 'react';
import { doc, addDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LancamentoFinanceiro, Compra, Fornecedor } from '../types';

interface FinanceiroProps {
  lancamentos: LancamentoFinanceiro[];
  compras: Compra[];
  fornecedores: Fornecedor[];
}

export default function Financeiro({ lancamentos, compras, fornecedores }: FinanceiroProps) {
  const [abaAtiva, setAbaAtiva] = useState<'caixa' | 'fornecedores' | 'calendario'>('caixa');

  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0]);
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('Geral');
  const [fornSelecionado, setFornSelecionado] = useState(''); 

  const [isRecorrente, setIsRecorrente] = useState(false);
  const [mesesRepetir, setMesesRepetir] = useState('12');
  const [processandoIA, setProcessandoIA] = useState(false);

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

  const [draftBusca, setDraftBusca] = useState('');
  const [draftMes, setDraftMes] = useState<number>(mesAtual);
  const [draftAno, setDraftAno] = useState<number>(anoAtual);
  const [draftStatus, setDraftStatus] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [draftTipo, setDraftTipo] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [draftFornecedor, setDraftFornecedor] = useState('todos');

  const [ordemFaturas, setOrdemFaturas] = useState<'vencimento_asc' | 'emissao_desc' | 'valor_desc' | 'valor_asc'>('vencimento_asc');
  const [compraModal, setCompraModal] = useState<Compra | null>(null);

  const [calMes, setCalMes] = useState<number>(mesAtual);
  const [calAno, setCalAno] = useState<number>(anoAtual);
  const [modoArrastar, setModoArrastar] = useState<'vencimento' | 'emissao'>('vencimento');

  const aplicarFiltros = () => {
    setBuscaDescricao(draftBusca); setMesFiltro(draftMes); setAnoFiltro(draftAno);
    setStatusFiltro(draftStatus); setTipoFiltro(draftTipo); setFornecedorFiltro(draftFornecedor);
  };

  const limparFiltros = () => {
    setDraftBusca(''); setBuscaDescricao(''); setDraftMes(0); setMesFiltro(0);
    setDraftAno(0); setAnoFiltro(0); setDraftStatus('todos'); setStatusFiltro('todos');
    setDraftTipo('todos'); setTipoFiltro('todos'); setDraftFornecedor('todos'); setFornecedorFiltro('todos');
  };

  // ==========================================
  // O CÉREBRO: VISÃO COMPUTACIONAL COM GEMINI
  // ==========================================
  const lidarUploadComprovanteIA = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      alert("ERRO CRÍTICO: A chave da IA (VITE_GEMINI_API_KEY) não foi encontrada! Verifique se você colocou na Vercel e fez um novo Deploy.");
      return;
    }

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

      const promptText = `
        Você é um assistente financeiro de um sistema ERP.
        Analise a imagem deste recibo, nota fiscal ou comprovante.
        Extraia as informações cruciais e retorne EXATAMENTE UM OBJETO JSON, sem crases de formatação, sem markdown, apenas as chaves e valores.
        Se não achar alguma informação, deduza da melhor forma ou deixe vazio.
        Formato obrigatório JSON:
        {
          "descricao": "Resumo do que foi comprado ou pago",
          "valor": 150.50, // Apenas o numero, formato float (ponto para decimais)
          "data": "2026-06-18" // Formato YYYY-MM-DD
        }
      `;

      const result = await model.generateContent([promptText, imagePart]);
      const responseText = result.response.text();

      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const dadosExtraidos = JSON.parse(cleanedText);

      setDescricao(dadosExtraidos.descricao || 'Despesa Lida por IA');
      setValor(dadosExtraidos.valor ? dadosExtraidos.valor.toString() : '');
      setDataLancamento(dadosExtraidos.data || new Date().toISOString().split('T')[0]);
      setDataVencimento(dadosExtraidos.data || new Date().toISOString().split('T')[0]);
      setTipo('despesa');
      setCategoria('Extraída via IA');
      
      alert("✅ IA leu o comprovante! Confirme os dados e clique em Salvar.");

    } catch (error: any) {
      console.error("ERRO TÉCNICO DETALHADO DA IA:", error);
      // AGORA O SISTEMA VAI CUSPIR O ERRO REAL NA SUA TELA
      alert(`❌ Ocorreu um erro técnico ao processar:\n\n${error.message || error}\n\nTire um print desta mensagem exata e envie para analisarmos.`);
    } finally {
      setProcessandoIA(false);
      event.target.value = '';
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
        const dados = { tipo, descricao, valor: valorNum, dataVencimento, dataLancamento, categoria, fornecedorId: fId };
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
            dataLancamento: objLanc.toISOString().split('T')[0], categoria, status: 'pendente',
            fornecedorId: fId, recorrente: true, grupoRecorrenciaId: grupoId
          });
        }
      }
      limparFormulario();
    } catch (error) { console.error(error); }
  };

  const iniciarEdicao = (lanc: LancamentoFinanceiro) => {
    setAbaAtiva('caixa'); 
    setIdEdicao(lanc.id); setTipo(lanc.tipo); setDescricao(lanc.descricao);
    setValor(lanc.valor.toString()); setDataLancamento(lanc.dataLancamento || lanc.dataVencimento);
    setDataVencimento(lanc.dataVencimento); setCategoria(lanc.categoria); setFornSelecionado(lanc.fornecedorId || '');
    setIsRecorrente(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => { 
    setIdEdicao(null); setTipo('despesa'); setDescricao(''); setValor(''); 
    setDataLancamento(new Date().toISOString().split('T')[0]); setDataVencimento(new Date().toISOString().split('T')[0]); 
    setCategoria('Geral'); setFornSelecionado(''); setIsRecorrente(false); setMesesRepetir('12');
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
        alert("Toda a série recorrente foi eliminada.");
      }
    } else {
      if (window.confirm("Excluir este lançamento financeiro permanentemente?")) await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id));
    }
  };

  const excluirValeInteiro = async (compraId: string) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    if (window.confirm("⚠️ ATENÇÃO: Isso excluirá o Vale de Compra e a dívida vinculada a ele. Deseja continuar?")) {
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
      const matchBusca = l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase()) || l.categoria.toLowerCase().includes(buscaDescricao.toLowerCase());
      return matchBusca && (mesFiltro === 0 || mes === mesFiltro) && (anoFiltro === 0 || ano === anoFiltro) && (statusFiltro === 'todos' || l.status === statusFiltro) && (tipoFiltro === 'todos' || l.tipo === tipoFiltro) && (fornecedorFiltro === 'todos' || l.fornecedorId === fornecedorFiltro);
    }).sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
  }, [lancamentos, buscaDescricao, mesFiltro, anoFiltro, statusFiltro, tipoFiltro, fornecedorFiltro]);

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
      const matchBusca = l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase()) || l.categoria.toLowerCase().includes(buscaDescricao.toLowerCase());
      return matchBusca && (statusFiltro === 'todos' || l.status === statusFiltro) && (tipoFiltro === 'todos' || l.tipo === tipoFiltro) && (fornecedorFiltro === 'todos' || l.fornecedorId === fornecedorFiltro);
    });
  }, [lancamentos, buscaDescricao, statusFiltro, tipoFiltro, fornecedorFiltro]);

  const mudarMesCal = (dir: number) => {
    let nMes = calMes + dir; let nAno = calAno;
    if (nMes > 12) { nMes = 1; nAno++; }
    if (nMes < 1) { nMes = 12; nAno--; }
    setCalMes(nMes); setCalAno(nAno);
  };

  const lidarDragStart = (e: any, id: string) => e.dataTransfer.setData('lancId', id);
  const lidarDragOver = (e: any) => e.preventDefault(); 
  const lidarDrop = async (e: any, dataAlvo: string) => {
    e.preventDefault();
    const idLanc = e.dataTransfer.getData('lancId');
    if (!idLanc || !dataAlvo) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    try {
      const campo = modoArrastar === 'vencimento' ? 'dataVencimento' : 'dataLancamento';
      await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', idLanc), { [campo]: dataAlvo });
    } catch (err) { console.error(err); }
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs">
            <div className="lg:col-span-2"><label className="block font-bold text-slate-500 uppercase mb-1">Buscar Palavra</label><input type="text" value={draftBusca} onChange={(e) => setDraftBusca(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" /></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Mês (Extrato)</label><select value={draftMes} onChange={(e) => setDraftMes(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value={0}>Todos</option>{Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'short' })}</option>))}</select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Ano (Extrato)</label><select value={draftAno} onChange={(e) => setDraftAno(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value={0}>Todos</option><option value={2025}>2025</option><option value={2026}>2026</option><option value={2027}>2027</option></select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Status</label><select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as any)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option></select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Tipo</label><select value={draftTipo} onChange={(e) => setDraftTipo(e.target.value as any)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value="todos">Todos</option><option value="despesa">Despesas (-)</option><option value="receita">Receitas (+)</option></select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Fornecedor</label><select value={draftFornecedor} onChange={(e) => setDraftFornecedor(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none truncate"><option value="todos">Qualquer Fornecedor</option><option value="">Avulsos (S/ Forn.)</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t"><button onClick={limparFiltros} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs">Limpar</button><button onClick={aplicarFiltros} className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl text-xs shadow-md">🔍 Buscar Agora</button><button onClick={() => window.print()} className="px-6 py-2.5 bg-slate-900 text-white font-black rounded-xl text-xs">🖨️ Exportar PDF</button></div>
        </div>
      )}

      {/* --- MENU DE NAVEGAÇÃO DE ABAS --- */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px no-print">
        <button onClick={() => setAbaAtiva('caixa')} className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'caixa' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>💵 Lançar & Extrato</button>
        <button onClick={() => setAbaAtiva('fornecedores')} className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'fornecedores' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>🏭 Dívidas Fornecedor</button>
        <button onClick={() => setAbaAtiva('calendario')} className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-all flex items-center gap-2 ${abaAtiva === 'calendario' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>📅 Calendário Arrastável</button>
      </div>

      {/* --- ABA 1: CAIXA / EXTRATO --- */}
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
                <input type="text" placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Emissão</label><input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vencimento</label><input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
              </div>

              {tipo === 'despesa' && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100"><label className="block text-[10px] font-bold text-rose-500 uppercase mb-1">Vincular Fornecedor</label><select value={fornSelecionado} onChange={(e) => setFornSelecionado(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-rose-200 rounded-lg text-sm font-bold text-slate-700 outline-none"><option value="">Nenhum</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
              )}

              {!idEdicao && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <label className="flex items-center gap-2 font-bold text-slate-700 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    🔁 Repetir Lançamento (Mensal)?
                  </label>
                  {isRecorrente && (
                    <div className="animate-fade-in"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Repetir por quantos meses?</label><input type="number" min="2" max="36" value={mesesRepetir} onChange={(e) => setMesesRepetir(e.target.value)} className="w-full px-3 py-2 border rounded-xl font-black text-sm text-blue-600" /></div>
                  )}
                </div>
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
              {lancamentosFiltrados.length === 0 ? <div className="p-10 text-center text-slate-400 font-bold">Nenhum lançamento encontrado.</div> : (
                <div className="divide-y divide-slate-100">
                  {lancamentosFiltrados.map(lanc => {
                    const isAtrasado = lanc.status === 'pendente' && lanc.tipo === 'despesa' && lanc.dataVencimento < new Date().toISOString().split('T')[0];
                    return (
                      <div key={lanc.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${lanc.status === 'pago' ? 'bg-slate-50/50 opacity-60' : 'bg-white hover:bg-slate-50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${lanc.tipo === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                            <p className={`font-black text-base truncate text-slate-800`}>{lanc.descricao}</p>
                            {lanc.recorrente && <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black px-1.5 py-0.5 rounded">🔁 Mensal</span>}
                          </div>
                          <p className="text-xs font-bold text-slate-500">Emitido: {lanc.dataLancamento ? lanc.dataLancamento.split('-').reverse().join('/') : '---'} • Vence: <span className={isAtrasado ? 'text-rose-600 font-black' : ''}>{lanc.dataVencimento.split('-').reverse().join('/')}</span></p>
                        </div>
                        <div className="flex items-center gap-3"><span className={`font-black text-xl ${lanc.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}`}>R$ {lanc.valor.toFixed(2)}</span><button onClick={() => alternarStatus(lanc)} className="px-4 py-2 text-xs font-black uppercase rounded-xl border bg-white">{lanc.status === 'pago' ? 'Desfazer' : 'Pagar'}</button><button onClick={() => excluirLancamento(lanc)} className="text-slate-300 hover:text-rose-500 p-1">🗑️</button></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ABA 2: FORNECEDORES --- */}
      {abaAtiva === 'fornecedores' && (
        <div className="space-y-6 animate-fade-in print:hidden pb-32">
          {relatorioFornecedores.length > 0 && (
            <div className="flex justify-end">
              <select value={ordemFaturas} onChange={(e) => setOrdemFaturas(e.target.value as any)} className="bg-white border border-slate-300 text-xs font-bold text-slate-700 rounded-xl px-4 py-3 shadow-sm outline-none">
                <option value="vencimento_asc">Organizar por Vencimento</option>
                <option value="emissao_desc">Organizar por Emissão (Mais Recentes)</option>
                <option value="valor_desc">Organizar por Valor (Maior primeiro)</option>
                <option value="valor_asc">Organizar por Valor (Menor primeiro)</option>
              </select>
            </div>
          )}

          {relatorioFornecedores.length === 0 ? <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 font-bold text-slate-400">Nenhuma fatura pendente.</div> : (
            relatorioFornecedores.map(forn => (
              <div key={forn.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
                  <div><h3 className="text-xl font-black">{forn.nome}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{forn.categoriaInsumo}</p></div>
                  <div className="text-right"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Devido</p><p className="text-3xl font-black text-rose-400">R$ {forn.totalDevendo.toFixed(2)}</p></div>
                </div>
                <div className="p-4 bg-slate-50"><div className="space-y-3">
                  {forn.faturas.map(fat => {
                    const compData = compras.find(c => c.id === fat.compraId);
                    return (
                      <div key={fat.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col xl:flex-row justify-between xl:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-800">{fat.descricao}</span>{fat.recorrente && <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black px-1.5 py-0.5 rounded">🔁 Mensal</span>}</div>
                          <p className="text-xs font-bold text-slate-500">Emissão: {fat.dataLancamento ? fat.dataLancamento.split('-').reverse().join('/') : '---'} • Vencimento: <span className="text-slate-800">{fat.dataVencimento.split('-').reverse().join('/')}</span></p>
                        </div>
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                          <span className="font-black text-rose-600 text-lg">R$ {fat.valor.toFixed(2)}</span>
                          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg"><button onClick={() => adiarVencimento(fat.id, 7, fat.dataVencimento)} className="px-2.5 py-1 bg-white text-[10px] font-bold text-slate-600 rounded shadow-sm">+7 Dias</button><button onClick={() => adiarVencimento(fat.id, 15, fat.dataVencimento)} className="px-2.5 py-1 bg-white text-[10px] font-bold text-slate-600 rounded shadow-sm">+15 Dias</button></div>
                          <div className="flex border border-slate-200 rounded-lg overflow-hidden"><button onClick={() => iniciarEdicao(fat)} className="px-3 py-2 bg-slate-50 text-xs font-bold">✏️</button><button onClick={() => excluirLancamento(fat)} className="px-3 py-2 bg-rose-50 text-rose-500 text-xs font-bold border-l">🗑️</button></div>
                          {compData && <button onClick={() => setCompraModal(compData)} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-black">📄 Vale</button>}
                          <button onClick={() => alternarStatus(fat)} className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black uppercase">Pagar</button>
                        </div>
                      </div>
                    );
                  })}
                </div></div>
              </div>
            ))
          )}
          {relatorioFornecedores.length > 0 && (
            <div className="bg-rose-900 p-8 rounded-3xl shadow-xl border border-rose-800 text-white flex flex-col md:flex-row justify-between items-center gap-6 mt-8">
              <div><h3 className="text-xl font-bold text-rose-200 uppercase tracking-widest mb-1">Risco Total em Fornecedores</h3><p className="text-sm text-rose-300">Soma de todas as faturas pendentes da fábrica (Independente de Mês).</p></div>
              <div className="text-5xl font-black tracking-tight text-white bg-rose-950/50 px-6 py-4 rounded-2xl border border-rose-800/50">R$ {TOTAL_GERAL_DEVIDO.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {/* --- ABA 3: CALENDÁRIO DRAG AND DROP --- */}
      {abaAtiva === 'calendario' && (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 animate-fade-in print:hidden">
          
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
            <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button onClick={() => mudarMesCal(-1)} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-slate-800 font-bold transition-all shadow-sm">◀ Anterior</button>
              <h3 className="text-lg font-black text-slate-800 w-40 text-center uppercase tracking-wider">{new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'long' })} {calAno}</h3>
              <button onClick={() => mudarMesCal(1)} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-slate-800 font-bold transition-all shadow-sm">Próximo ▶</button>
            </div>

            <div className="flex bg-slate-900 p-1.5 rounded-2xl shadow-inner border border-slate-800">
              <button onClick={() => setModoArrastar('vencimento')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-wider ${modoArrastar === 'vencimento' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>🎯 Vencimentos</button>
              <button onClick={() => setModoArrastar('emissao')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-wider ${modoArrastar === 'emissao' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>📄 Emissões</button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-7 bg-slate-800 text-white rounded-t-xl overflow-hidden">
                {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(d => (
                  <div key={d} className="p-3 text-center text-xs font-black uppercase tracking-widest">{d}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 border-l border-slate-200">
                {diasCalendario.map((dataString, index) => {
                  if (!dataString) return <div key={`empty-${index}`} className="bg-slate-50 border-r border-b border-slate-200 min-h-[140px]"></div>;
                  
                  const numDia = parseInt(dataString.split('-')[2]);
                  const hoje = new Date().toISOString().split('T')[0] === dataString;
                  
                  const faturasDoDia = lancamentosDoCalendario.filter(l => {
                    const dataRef = modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento);
                    return dataRef === dataString;
                  });

                  return (
                    <div 
                      key={dataString} 
                      onDragOver={lidarDragOver} 
                      onDrop={(e) => lidarDrop(e, dataString)}
                      className={`min-h-[140px] p-2 border-r border-b border-slate-200 transition-colors ${hoje ? 'bg-blue-50/50' : 'bg-white hover:bg-slate-50/50'}`}
                    >
                      <div className={`text-xs font-black mb-2 flex justify-between items-center ${hoje ? 'text-blue-600' : 'text-slate-400'}`}>
                        <span>{numDia}</span>
                        {hoje && <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>}
                      </div>
                      
                      <div className="space-y-1.5">
                        {faturasDoDia.map(fat => (
                          <div 
                            key={fat.id} 
                            draggable
                            onDragStart={(e) => lidarDragStart(e, fat.id)}
                            className={`p-1.5 rounded border text-[10px] cursor-grab active:cursor-grabbing shadow-sm ${fat.status === 'pago' ? 'opacity-50 grayscale' : ''} ${fat.tipo === 'despesa' ? 'bg-rose-50 border-rose-200 text-rose-800 border-l-4 border-l-rose-500' : 'bg-emerald-50 border-emerald-200 text-emerald-800 border-l-4 border-l-emerald-500'}`}
                            title={fat.descricao}
                          >
                            <p className="font-bold truncate leading-none mb-1">{fat.descricao}</p>
                            <p className="font-black">R$ {fat.valor.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase">Resumo do Mês Vizualizado ({new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'short' })})</p>
            <div className="flex gap-6">
              <div className="text-right"><p className="text-[10px] font-bold text-emerald-600 uppercase">Receitas</p><p className="font-black text-slate-800">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'receita' && l.dataVencimento.startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
              <div className="text-right"><p className="text-[10px] font-bold text-rose-600 uppercase">Despesas</p><p className="font-black text-slate-800">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'despesa' && l.dataVencimento.startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
            </div>
          </div>
        </div>
      )}

      {/* --- O PDF (VISÍVEL SÓ NA IMPRESSORA) --- */}
      <div id="relatorio-financeiro-pdf" className="hidden print:block w-full">
        <div className="mb-8 border-b-2 border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Relatório Financeiro</h1>
          <p className="text-slate-600 font-bold mt-2">Filtros: Mês {mesFiltro === 0 ? 'Todos' : mesFiltro}/{anoFiltro === 0 ? 'Todos' : anoFiltro} | Status: {statusFiltro.toUpperCase()} | Fornecedor: {fornecedorFiltro === 'todos' ? 'TODOS' : (fornecedores.find(f=>f.id === fornecedorFiltro)?.nome || 'AVULSOS')}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><p className="text-[10px] font-bold text-slate-500 uppercase">Receitas (+)</p><p className="text-xl font-black text-emerald-600">R$ {resumoFiltrado.receitas.toFixed(2)}</p></div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><p className="text-[10px] font-bold text-slate-500 uppercase">Despesas (-)</p><p className="text-xl font-black text-rose-600">R$ {resumoFiltrado.despesas.toFixed(2)}</p></div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-900 text-center text-white"><p className="text-[10px] font-bold text-slate-400 uppercase">Saldo</p><p className={`text-xl font-black ${resumoFiltrado.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {resumoFiltrado.saldo.toFixed(2)}</p></div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead><tr className="border-b border-slate-400 bg-slate-100 font-bold uppercase"><th className="p-2">Emissão</th><th className="p-2">Vencimento</th><th className="p-2">Descrição</th><th className="p-2">Categoria</th><th className="p-2 text-center">Status</th><th className="p-2 text-right">Valor</th></tr></thead>
          <tbody className="divide-y divide-slate-300">
            {lancamentosFiltrados.map(l => (
              <tr key={l.id}><td className="p-2">{l.dataLancamento?.split('-').reverse().join('/') || '---'}</td><td className="p-2 font-bold">{l.dataVencimento.split('-').reverse().join('/')}</td><td className="p-2"><span className="font-bold">{l.descricao}</span></td><td className="p-2">{l.categoria}</td><td className="p-2 text-center font-bold uppercase">{l.status}</td><td className={`p-2 text-right font-black ${l.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}`}>{l.tipo === 'despesa' ? '-' : '+'} R$ {l.valor.toFixed(2)}</td></tr>
            ))}
          </tbody>
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