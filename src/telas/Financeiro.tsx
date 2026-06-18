import React, { useState, useMemo } from 'react';
import { doc, addDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { LancamentoFinanceiro } from '../types';

interface FinanceiroProps {
  lancamentos: LancamentoFinanceiro[];
}

export default function Financeiro({ lancamentos }: FinanceiroProps) {
  // Estados do Formulário de Edição/Criação
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('Geral');

  // Estados dos Filtros (Inicia no mês atual)
  const dataAtual = new Date();
  const [mesFiltro, setMesFiltro] = useState<number>(dataAtual.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(dataAtual.getFullYear());
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos');

  // --- LÓGICA DE BANCO DE DADOS ---
  const lidarSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    const dados = {
      tipo,
      descricao,
      valor: parseFloat(valor),
      dataVencimento,
      status: idEdicao ? undefined : 'pendente', // Mantém o status se estiver editando
      categoria
    };

    try {
      if (idEdicao) {
        await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', idEdicao), dados);
      } else {
        await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), { ...dados, status: 'pendente' });
      }
      limparFormulario();
    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
    }
  };

  const iniciarEdicao = (lanc: LancamentoFinanceiro) => {
    setIdEdicao(lanc.id);
    setTipo(lanc.tipo);
    setDescricao(lanc.descricao);
    setValor(lanc.valor.toString());
    setDataVencimento(lanc.dataVencimento);
    setCategoria(lanc.categoria);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => {
    setIdEdicao(null); setTipo('despesa'); setDescricao(''); setValor(''); 
    setDataVencimento(new Date().toISOString().split('T')[0]); setCategoria('Geral');
  };

  const alternarStatus = async (lanc: LancamentoFinanceiro) => {
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;
    await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id), {
      status: lanc.status === 'pago' ? 'pendente' : 'pago'
    });
  };

  const excluirLancamento = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Tem certeza que deseja excluir este registro financeiro?")) {
      await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', id));
    }
  };

  // --- LÓGICA DE FILTROS E RELATÓRIOS ---
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      // Ajuste de fuso horário para evitar que dia 31 caia no mês errado
      const dataLanc = new Date(l.dataVencimento + 'T12:00:00'); 
      const mes = dataLanc.getMonth() + 1;
      const ano = dataLanc.getFullYear();

      const matchMes = mesFiltro === 0 || mes === mesFiltro;
      const matchAno = anoFiltro === 0 || ano === anoFiltro;
      const matchStatus = statusFiltro === 'todos' || l.status === statusFiltro;
      const matchTipo = tipoFiltro === 'todos' || l.tipo === tipoFiltro;

      return matchMes && matchAno && matchStatus && matchTipo;
    }).sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
  }, [lancamentos, mesFiltro, anoFiltro, statusFiltro, tipoFiltro]);

  // Cálculos do Resumo Filtrado
  const totalReceitas = lancamentosFiltrados.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
  const totalDespesas = lancamentosFiltrados.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
  const saldoProjetado = totalReceitas - totalDespesas;
  
  // Atrasados: Despesa, Pendente, e Vencimento menor que hoje
  const hojeStr = new Date().toISOString().split('T')[0];
  const totalAtrasado = lancamentosFiltrados.filter(l => l.tipo === 'despesa' && l.status === 'pendente' && l.dataVencimento < hojeStr).reduce((a, b) => a + b.valor, 0);

  // Geração de PDF (Print nativo estilizado)
  const gerarPDF = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
      
      {/* Estilo Injetado para o Relatório em PDF */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #relatorio-pdf, #relatorio-pdf * { visibility: visible; }
          #relatorio-pdf { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
          .print-break { page-break-inside: avoid; }
        }
      `}} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>💰</span> Gestão de Caixa</h2>
          <p className="text-slate-500 mt-1">Acompanhe suas contas a pagar, a receber e emita relatórios.</p>
        </div>
        <button onClick={gerarPDF} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2">
          <span>📄</span> Exportar Relatório PDF
        </button>
      </header>

      {/* ÁREA QUE SERÁ IMPRESSA NO PDF */}
      <div id="relatorio-pdf" className="space-y-6">
        
        {/* Cabeçalho do Relatório (Aparece bem no PDF) */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-slate-900">Relatório de Fluxo de Caixa - HelpMkp</h1>
          <p className="text-slate-600 font-medium mt-1">
            Período: {mesFiltro === 0 ? 'Todos os meses' : `Mês ${mesFiltro}`} de {anoFiltro === 0 ? 'Todos os anos' : anoFiltro}
          </p>
        </div>

        {/* CARDS DE RESUMO DO PERÍODO */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Entradas (Projetado)</p>
            <h3 className="text-2xl font-black text-emerald-600">R$ {totalReceitas.toFixed(2)}</h3>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Saídas (Projetado)</p>
            <h3 className="text-2xl font-black text-rose-600">R$ {totalDespesas.toFixed(2)}</h3>
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo do Período</p>
            <h3 className={`text-2xl font-black ${saldoProjetado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {saldoProjetado.toFixed(2)}</h3>
          </div>
          <div className={`p-5 rounded-2xl shadow-sm border ${totalAtrasado > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${totalAtrasado > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Contas Atrasadas</p>
            <h3 className={`text-2xl font-black ${totalAtrasado > 0 ? 'text-rose-600' : 'text-slate-800'}`}>R$ {totalAtrasado.toFixed(2)}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LADO ESQUERDO: FORMULÁRIO DE CADASTRO/EDIÇÃO (Não imprime) */}
          <div className="xl:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit no-print sticky top-6">
            <h3 className="font-black text-lg text-slate-800 mb-5 border-b border-slate-100 pb-3">
              {idEdicao ? '✏️ Editando Lançamento' : '➕ Novo Lançamento'}
            </h3>
            <form onSubmit={lidarSalvar} className="space-y-4">
              <div className="flex bg-slate-100 p-1.5 rounded-xl">
                <button type="button" onClick={() => setTipo('despesa')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tipo === 'despesa' ? 'bg-white text-rose-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Despesa (-)</button>
                <button type="button" onClick={() => setTipo('receita')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${tipo === 'receita' ? 'bg-white text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Receita (+)</button>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrição</label>
                <input type="text" required placeholder="Ex: Fornecedor de Embalagens" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor (R$)</label>
                  <input type="number" required step="0.01" placeholder="0.00" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vencimento</label>
                  <input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria</label>
                <input type="text" placeholder="Ex: Insumos, Impostos, Frete" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="submit" className={`flex-1 py-3.5 rounded-xl font-black text-white transition-all shadow-md ${tipo === 'despesa' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {idEdicao ? 'Atualizar' : 'Lançar no Caixa'}
                </button>
                {idEdicao && (
                  <button type="button" onClick={limparFormulario} className="px-5 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancelar</button>
                )}
              </div>
            </form>
          </div>

          {/* LADO DIREITO: LISTAGEM E FILTROS */}
          <div className="xl:col-span-8 space-y-4">
            
            {/* BARRA DE FILTROS SUPERIOR (Não imprime) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap lg:flex-nowrap gap-3 no-print">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mês</label>
                <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                  <option value={0}>Todos</option>
                  {Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
                </select>
              </div>
              <div className="w-24 shrink-0">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ano</label>
                <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                  <option value={0}>Todos</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
              <div className="w-32 shrink-0">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
                <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as any)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendentes</option>
                  <option value="pago">Pagos</option>
                </select>
              </div>
              <div className="w-32 shrink-0">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo</label>
                <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                  <option value="todos">Todos</option>
                  <option value="receita">Receitas</option>
                  <option value="despesa">Despesas</option>
                </select>
              </div>
            </div>

            {/* LISTA DE LANÇAMENTOS */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              {lancamentosFiltrados.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Nenhum lançamento encontrado para este período.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {lancamentosFiltrados.map(lanc => {
                    const isAtrasado = lanc.status === 'pendente' && lanc.tipo === 'despesa' && lanc.dataVencimento < hojeStr;
                    
                    return (
                      <div key={lanc.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors print-break ${lanc.status === 'pago' ? 'bg-slate-50/50 opacity-60' : 'bg-white hover:bg-slate-50'} ${idEdicao === lanc.id ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}>
                        
                        {/* Info da Conta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${lanc.tipo === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                            <p className={`font-black text-base truncate ${lanc.status === 'pago' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                              {lanc.descricao}
                            </p>
                            {isAtrasado && <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">Atrasado</span>}
                          </div>
                          <p className="text-xs font-bold text-slate-500 flex gap-2">
                            <span>Vence: {lanc.dataVencimento.split('-').reverse().join('/')}</span>
                            <span>•</span>
                            <span className="uppercase">{lanc.categoria}</span>
                          </p>
                        </div>

                        {/* Valores e Ações */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                          <span className={`font-black text-xl whitespace-nowrap ${lanc.status === 'pago' ? 'text-slate-400' : (lanc.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600')}`}>
                            R$ {lanc.valor.toFixed(2)}
                          </span>
                          
                          <div className="flex items-center gap-2 no-print">
                            <button 
                              onClick={() => alternarStatus(lanc)} 
                              className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${lanc.status === 'pago' ? 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}
                            >
                              {lanc.status === 'pago' ? 'Desfazer' : 'Baixar'}
                            </button>
                            
                            <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                              <button onClick={() => iniciarEdicao(lanc)} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors" title="Editar">✏️</button>
                              <div className="w-px bg-slate-200"></div>
                              <button onClick={() => excluirLancamento(lanc.id)} className="px-3 py-2 bg-slate-50 hover:bg-rose-50 text-rose-500 transition-colors" title="Excluir">🗑️</button>
                            </div>
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
    </div>
  );
}