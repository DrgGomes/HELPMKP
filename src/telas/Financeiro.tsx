import React, { useState, useMemo } from 'react';
import { doc, addDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { LancamentoFinanceiro, Compra, Fornecedor } from '../types';

interface FinanceiroProps {
  lancamentos: LancamentoFinanceiro[];
  compras: Compra[];
  fornecedores: Fornecedor[];
}

export default function Financeiro({ lancamentos, compras, fornecedores }: FinanceiroProps) {
  const [abaAtiva, setAbaAtiva] = useState<'caixa' | 'fornecedores'>('caixa');

  // --- ESTADOS DO FORMULÁRIO ---
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0]); // NOVO CAMPO
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('Geral');
  const [fornSelecionado, setFornSelecionado] = useState(''); 

  // --- ESTADOS DE RELATÓRIO E FILTROS ---
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [buscaDescricao, setBuscaDescricao] = useState('');
  const dataAtual = new Date();
  const [mesFiltro, setMesFiltro] = useState<number>(dataAtual.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(dataAtual.getFullYear());
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('todos');

  const [compraModal, setCompraModal] = useState<Compra | null>(null);

  // --- LÓGICA DO CAIXA GERAL ---
  const lidarSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    
    const dados: any = { tipo, descricao, valor: parseFloat(valor), dataVencimento, dataLancamento, categoria };
    if (tipo === 'despesa' && fornSelecionado) dados.fornecedorId = fornSelecionado;
    else dados.fornecedorId = null;

    if (idEdicao) await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', idEdicao), dados);
    else await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), { ...dados, status: 'pendente' });
    limparFormulario();
  };

  const iniciarEdicao = (lanc: LancamentoFinanceiro) => {
    setAbaAtiva('caixa'); 
    setIdEdicao(lanc.id); setTipo(lanc.tipo); setDescricao(lanc.descricao);
    setValor(lanc.valor.toString()); 
    setDataLancamento(lanc.dataLancamento || lanc.dataVencimento); // Puxa do banco se existir
    setDataVencimento(lanc.dataVencimento);
    setCategoria(lanc.categoria); setFornSelecionado(lanc.fornecedorId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => { 
    setIdEdicao(null); setTipo('despesa'); setDescricao(''); setValor(''); 
    setDataLancamento(new Date().toISOString().split('T')[0]);
    setDataVencimento(new Date().toISOString().split('T')[0]); 
    setCategoria('Geral'); setFornSelecionado('');
  };

  const alternarStatus = async (lanc: LancamentoFinanceiro) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id), { status: lanc.status === 'pago' ? 'pendente' : 'pago' });
  };

  const excluirLancamento = async (id: string) => {
    const userId = auth.currentUser?.uid as string; if (userId && window.confirm("Excluir este registro permanentemente?")) await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', id));
  };

  const adiarVencimento = async (id: string, dias: number, dataAtualStr: string) => {
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    const dataObj = new Date(dataAtualStr + 'T12:00:00');
    dataObj.setDate(dataObj.getDate() + dias);
    await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', id), { dataVencimento: dataObj.toISOString().split('T')[0] });
  };

  // --- INTELIGÊNCIA: DÍVIDAS POR FORNECEDOR ---
  const relatorioFornecedores = useMemo(() => {
    return fornecedores.map(f => {
      const faturasPendentes = lancamentos.filter(l => l.fornecedorId === f.id && l.status === 'pendente' && l.tipo === 'despesa');
      const totalDevendo = faturasPendentes.reduce((a, b) => a + b.valor, 0);
      return { ...f, faturas: faturasPendentes.sort((a,b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()), totalDevendo };
    }).filter(f => f.totalDevendo > 0).sort((a, b) => b.totalDevendo - a.totalDevendo);
  }, [fornecedores, lancamentos]);

  const TOTAL_GERAL_DEVIDO = relatorioFornecedores.reduce((acc, forn) => acc + forn.totalDevendo, 0);

  // --- INTELIGÊNCIA: FILTRAGEM AVANÇADA (TELA E PDF) ---
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      const dataLanc = new Date(l.dataVencimento + 'T12:00:00'); 
      const mes = dataLanc.getMonth() + 1;
      const ano = dataLanc.getFullYear();

      const matchBusca = l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase()) || l.categoria.toLowerCase().includes(buscaDescricao.toLowerCase());
      const matchMes = mesFiltro === 0 || mes === mesFiltro;
      const matchAno = anoFiltro === 0 || ano === anoFiltro;
      const matchStatus = statusFiltro === 'todos' || l.status === statusFiltro;
      const matchTipo = tipoFiltro === 'todos' || l.tipo === tipoFiltro;
      const matchForn = fornecedorFiltro === 'todos' || l.fornecedorId === fornecedorFiltro;

      return matchBusca && matchMes && matchAno && matchStatus && matchTipo && matchForn;
    }).sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
  }, [lancamentos, buscaDescricao, mesFiltro, anoFiltro, statusFiltro, tipoFiltro, fornecedorFiltro]);

  const resumoFiltrado = {
    receitas: lancamentosFiltrados.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0),
    despesas: lancamentosFiltrados.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0),
    saldo: 0
  };
  resumoFiltrado.saldo = resumoFiltrado.receitas - resumoFiltrado.despesas;

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6 relative">
      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } #relatorio-financeiro-pdf, #relatorio-financeiro-pdf * { visibility: visible; } #relatorio-financeiro-pdf { position: absolute; left: 0; top: 0; width: 100%; color: #000; padding: 10px; } .no-print { display: none !important; } }`}} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>💰</span> Fluxo de Caixa Mestre</h2>
          <p className="text-slate-500 mt-1">Sua mesa de controle financeiro. Edite contas, atrase boletos e gere relatórios.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMostrarRelatorio(!mostrarRelatorio)} className={`px-5 py-3 rounded-xl font-bold flex items-center gap-2 border transition-all ${mostrarRelatorio ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-slate-700 border-slate-300 shadow-sm'}`}>📑 Filtros & PDF</button>
        </div>
      </header>

      {mostrarRelatorio && (
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-lg space-y-5 no-print animate-fade-in">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center"><h3 className="font-black text-slate-800">🛠️ Extrator de Relatórios</h3><button onClick={() => window.print()} className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-lg flex items-center gap-2 shadow-lg">🖨️ Gerar PDF Destes Dados</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs">
            <div className="lg:col-span-2"><label className="block font-bold text-slate-500 uppercase mb-1">Buscar Item / Categoria</label><input type="text" placeholder="Ex: Energia, Compra..." value={buscaDescricao} onChange={(e) => setBuscaDescricao(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" /></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Mês Vencimento</label><select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value={0}>Todos</option>{Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'short' })}</option>))}</select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Ano</label><select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value={0}>Todos</option><option value={2025}>2025</option><option value={2026}>2026</option><option value={2027}>2027</option></select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Status</label><select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as any)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option></select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Tipo</label><select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"><option value="todos">Todos</option><option value="despesa">Despesas (-)</option><option value="receita">Receitas (+)</option></select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Fornecedor</label><select value={fornecedorFiltro} onChange={(e) => setFornecedorFiltro(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none truncate"><option value="todos">Qualquer Fornecedor</option><option value="">Avulsos (S/ Forn.)</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200 pb-px no-print">
        <button onClick={() => setAbaAtiva('caixa')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'caixa' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>💵 Extrato e Lançamentos</button>
        <button onClick={() => setAbaAtiva('fornecedores')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all flex items-center gap-2 ${abaAtiva === 'fornecedores' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><span>🏭</span> Contas por Fornecedor</button>
      </div>

      <div id="relatorio-financeiro-pdf">
        <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Relatório Financeiro Inteligente</h1>
          <p className="text-slate-600 font-bold mt-2">HelpMkp E-commerce e Indústria</p>
          <p className="text-xs text-slate-500 mt-1">Filtros: Mês {mesFiltro === 0 ? 'Todos' : mesFiltro}/{anoFiltro === 0 ? 'Todos' : anoFiltro} | Status: {statusFiltro.toUpperCase()} | Fornecedor: {fornecedorFiltro === 'todos' ? 'TODOS' : (fornecedores.find(f=>f.id === fornecedorFiltro)?.nome || 'AVULSOS')}</p>
        </div>

        {(mostrarRelatorio || document.getElementById('relatorio-financeiro-pdf')) && (
          <div className="grid grid-cols-3 gap-4 mb-6 print:grid">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><p className="text-[10px] font-bold text-slate-500 uppercase">Receitas (+)</p><p className="text-xl font-black text-emerald-600">R$ {resumoFiltrado.receitas.toFixed(2)}</p></div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><p className="text-[10px] font-bold text-slate-500 uppercase">Despesas (-)</p><p className="text-xl font-black text-rose-600">R$ {resumoFiltrado.despesas.toFixed(2)}</p></div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-900 text-center text-white"><p className="text-[10px] font-bold text-slate-400 uppercase">Saldo do Relatório</p><p className={`text-xl font-black ${resumoFiltrado.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {resumoFiltrado.saldo.toFixed(2)}</p></div>
          </div>
        )}

        <div className="hidden print:block w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-400 bg-slate-100 font-bold uppercase"><th className="p-2">Emissão</th><th className="p-2">Vencimento</th><th className="p-2">Descrição / Fornecedor</th><th className="p-2">Categoria</th><th className="p-2 text-center">Status</th><th className="p-2 text-right">Valor</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {lancamentosFiltrados.map(l => (
                <tr key={l.id}>
                  <td className="p-2">{l.dataLancamento?.split('-').reverse().join('/') || '---'}</td>
                  <td className="p-2 font-bold">{l.dataVencimento.split('-').reverse().join('/')}</td>
                  <td className="p-2"><span className="font-bold">{l.descricao}</span>{l.fornecedorId && <div className="text-[10px] text-slate-500">{fornecedores.find(f=>f.id === l.fornecedorId)?.nome}</div>}</td>
                  <td className="p-2">{l.categoria}</td>
                  <td className="p-2 text-center font-bold uppercase">{l.status}</td>
                  <td className={`p-2 text-right font-black ${l.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}`}>{l.tipo === 'despesa' ? '-' : '+'} R$ {l.valor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {abaAtiva === 'caixa' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start animate-fade-in print:hidden">
            <div className="xl:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit sticky top-6">
              <h3 className="font-black text-lg text-slate-800 mb-5 border-b border-slate-100 pb-3">{idEdicao ? '✏️ Editando' : '➕ Novo'} Lançamento</h3>
              <form onSubmit={lidarSalvar} className="space-y-4">
                <div className="flex bg-slate-100 p-1.5 rounded-xl"><button type="button" onClick={() => { setTipo('despesa'); setFornSelecionado(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tipo === 'despesa' ? 'bg-white text-rose-600 border border-slate-200' : 'text-slate-500'}`}>Despesa (-)</button><button type="button" onClick={() => { setTipo('receita'); setFornSelecionado(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tipo === 'receita' ? 'bg-white text-emerald-600 border border-slate-200' : 'text-slate-500'}`}>Receita (+)</button></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrição</label><input type="text" required placeholder="Ex: Conta de Luz / Venda ML" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor (R$)</label><input type="number" required step="0.01" placeholder="0.00" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none" /></div>
                
                {/* OS DOIS CAMPOS DE DATA LADO A LADO */}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Emissão</label><input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vencimento</label><input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                </div>

                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria</label><input type="text" placeholder="Ex: Fixo, Variável, Imposto" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" /></div>

                {tipo === 'despesa' && (
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-100"><label className="block text-[10px] font-bold text-rose-500 uppercase mb-1">Vincular a Fornecedor (Opcional)</label><select value={fornSelecionado} onChange={(e) => setFornSelecionado(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-rose-200 rounded-lg text-sm font-bold text-slate-700 outline-none truncate"><option value="">Nenhum vinculado</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
                )}

                <div className="flex gap-2 pt-2"><button type="submit" className={`flex-1 py-3.5 rounded-xl font-black text-white transition-all shadow-md ${tipo === 'despesa' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{idEdicao ? 'Atualizar' : 'Salvar'}</button>{idEdicao && <button type="button" onClick={limparFormulario} className="px-5 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300">Cancelar</button>}</div>
              </form>
            </div>

            <div className="xl:col-span-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              {lancamentosFiltrados.length === 0 ? <div className="p-10 text-center text-slate-400 font-bold">Nenhum lançamento encontrado com os filtros atuais.</div> : (
                <div className="divide-y divide-slate-100">
                  {lancamentosFiltrados.map(lanc => {
                    const isAtrasado = lanc.status === 'pendente' && lanc.tipo === 'despesa' && lanc.dataVencimento < new Date().toISOString().split('T')[0];
                    return (
                      <div key={lanc.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${lanc.status === 'pago' ? 'bg-slate-50/50 opacity-60' : 'bg-white hover:bg-slate-50'} ${idEdicao === lanc.id ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${lanc.tipo === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                            <p className={`font-black text-base truncate ${lanc.status === 'pago' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{lanc.descricao}</p>
                            {isAtrasado && <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">Atrasado</span>}
                            {lanc.fornecedorId && <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded uppercase" title={fornecedores.find(f=>f.id===lanc.fornecedorId)?.nome}>Fornecedor</span>}
                          </div>
                          <p className="text-xs font-bold text-slate-500">Emitido: {lanc.dataLancamento ? lanc.dataLancamento.split('-').reverse().join('/') : '---'} • Vence: <span className={isAtrasado ? 'text-rose-600' : ''}>{lanc.dataVencimento.split('-').reverse().join('/')}</span> • {lanc.categoria}</p>
                        </div>
                        
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                          <span className={`font-black text-xl whitespace-nowrap ${lanc.status === 'pago' ? 'text-slate-400' : (lanc.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600')}`}>R$ {lanc.valor.toFixed(2)}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => alternarStatus(lanc)} className={`px-4 py-2.5 text-xs font-black uppercase rounded-xl border transition-all ${lanc.status === 'pago' ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}>{lanc.status === 'pago' ? 'Desfazer' : 'Pagar'}</button>
                            <div className="flex border border-slate-200 rounded-xl overflow-hidden"><button onClick={() => iniciarEdicao(lanc)} className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors" title="Editar">✏️</button><div className="w-px bg-slate-200"></div><button onClick={() => excluirLancamento(lanc.id)} className="px-3 py-2.5 bg-slate-50 hover:bg-rose-50 text-rose-500 transition-colors" title="Apagar">🗑️</button></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TELA NO APP: GESTÃO DE FORNECEDORES --- */}
        {abaAtiva === 'fornecedores' && (
          <div className="space-y-6 animate-fade-in print:hidden pb-32">
            
            {relatorioFornecedores.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center"><span className="text-4xl mb-4 block">🎉</span><h3 className="text-xl font-bold text-slate-700">Nenhuma dívida pendente!</h3></div>
            ) : (
              relatorioFornecedores.map(forn => (
                <div key={forn.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-900 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
                    <div><h3 className="text-xl font-black">{forn.nome}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{forn.categoriaInsumo}</p></div>
                    <div className="text-right"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Devido</p><p className="text-3xl font-black text-rose-400">R$ {forn.totalDevendo.toFixed(2)}</p></div>
                  </div>
                  <div className="p-4 bg-slate-50">
                    <div className="space-y-3">
                      {forn.faturas.map(fat => {
                        const isAtrasado = fat.dataVencimento < new Date().toISOString().split('T')[0];
                        const compData = compras.find(c => c.id === fat.compraId); 
                        return (
                          <div key={fat.id} className={`p-4 rounded-xl border flex flex-col xl:flex-row justify-between xl:items-center gap-4 ${isAtrasado ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                            <div>
                              <div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-800">{fat.descricao}</span>{isAtrasado && <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">Atrasado</span>}</div>
                              <p className="text-xs font-bold text-slate-500">Emissão: {fat.dataLancamento ? fat.dataLancamento.split('-').reverse().join('/') : '---'} • Vencimento: <span className={isAtrasado ? 'text-rose-600 font-black' : ''}>{fat.dataVencimento.split('-').reverse().join('/')}</span></p>
                            </div>
                            <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                              <span className="font-black text-rose-600 text-lg w-28 text-right">R$ {fat.valor.toFixed(2)}</span>
                              <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200"><button onClick={() => adiarVencimento(fat.id, 7, fat.dataVencimento)} className="px-3 py-1.5 bg-white text-slate-600 text-[10px] font-black uppercase rounded shadow-sm hover:text-blue-600 transition-colors">+7 Dias</button><button onClick={() => adiarVencimento(fat.id, 15, fat.dataVencimento)} className="px-3 py-1.5 bg-white text-slate-600 text-[10px] font-black uppercase rounded shadow-sm hover:text-blue-600 transition-colors">+15 Dias</button></div>
                              <button onClick={() => iniciarEdicao(fat)} className="px-3 py-2 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg text-xs font-black transition-colors" title="Editar">✏️ Editar</button>
                              {compData && <button onClick={() => setCompraModal(compData)} className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-lg text-xs font-black transition-colors flex items-center gap-2">📄 Vale</button>}
                              <button onClick={() => alternarStatus(fat)} className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-black uppercase transition-colors">Pagar</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* O NOVO GRANDE TOTALIZADOR NO RODAPÉ */}
            {relatorioFornecedores.length > 0 && (
              <div className="bg-rose-900 p-8 rounded-3xl shadow-xl border border-rose-800 text-white flex flex-col md:flex-row justify-between items-center gap-6 mt-8">
                <div><h3 className="text-xl font-bold text-rose-200 uppercase tracking-widest mb-1">Risco Total em Fornecedores</h3><p className="text-sm text-rose-300">Soma de todas as faturas pendentes da fábrica.</p></div>
                <div className="text-5xl font-black tracking-tight text-white bg-rose-950/50 px-6 py-4 rounded-2xl border border-rose-800/50">R$ {TOTAL_GERAL_DEVIDO.toFixed(2)}</div>
              </div>
            )}
          </div>
        )}

      </div>

      {compraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in no-print">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <div><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Recibo do Vale</p><h3 className="text-2xl font-black">{compraModal.codigoOrdem}</h3></div>
              <button onClick={() => setCompraModal(null)} className="w-10 h-10 bg-slate-800 hover:bg-rose-500 rounded-full font-black text-xl transition-colors">✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6 border-b border-slate-200 pb-6">
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Fornecedor</p><p className="font-black text-slate-800 text-lg">{compraModal.fornecedorNome}</p></div>
                <div className="text-right"><p className="text-[10px] font-bold text-slate-400 uppercase">NF / Vale Relacionado</p><p className="font-black text-slate-800 text-lg">{compraModal.numeroVale || 'N/A'}</p></div>
              </div>
              <h4 className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-3">O que foi comprado:</h4>
              <div className="space-y-2 mb-6">
                {compraModal.itens.map(item => (
                  <div key={item.produtoId} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div><p className="font-bold text-slate-800 text-sm">{item.nome}</p><p className="text-[10px] font-bold text-slate-500">{item.quantidade}x R$ {item.custoUnitario.toFixed(2)}</p></div>
                    <span className="font-black text-slate-700">R$ {item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-100 p-6 border-t border-slate-200 flex justify-between items-center mt-auto"><p className="font-bold text-slate-500 uppercase">Total do Vale</p><p className="text-3xl font-black text-slate-900">R$ {compraModal.valorTotal.toFixed(2)}</p></div>
          </div>
        </div>
      )}

    </div>
  );
}