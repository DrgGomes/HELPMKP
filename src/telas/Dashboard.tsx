import { useState, useMemo } from 'react';
import type { Produto, Plataforma, LancamentoFinanceiro, CategoriaDespesa } from '../types';

interface DashboardProps {
  produtos: Produto[]; plataformas: Plataforma[]; lancamentos: LancamentoFinanceiro[];
  categoriasDespesa: CategoriaDespesa[]; // NOVO: Prop para o gráfico
  setTelaAtiva: (tela: string) => void;
}

export default function Dashboard({ produtos, plataformas, lancamentos, categoriasDespesa, setTelaAtiva }: DashboardProps) {
  const dataAtual = new Date();
  const [mesFiltro, setMesFiltro] = useState<number>(dataAtual.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(dataAtual.getFullYear());

  const saldoGeralRealizado = lancamentos.filter(l => l.status === 'pago').reduce((acc, l) => acc + (l.tipo === 'receita' ? l.valor : -l.valor), 0);
  const contasAPagarGlobal = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pendente').reduce((a, b) => a + b.valor, 0);
  const contasAReceberGlobal = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((a, b) => a + b.valor, 0);

  const valorEstoque = produtos.reduce((acc, p) => acc + (p.custoBase * (p.estoque || 0)), 0);
  const totalItensEstoque = produtos.reduce((acc, p) => acc + (p.estoque || 0), 0);

  // --- FILTRAGEM DO MÊS PARA OS GRÁFICOS ---
  const lancamentosMes = useMemo(() => {
    return lancamentos.filter(l => {
      const mes = new Date(l.dataVencimento + 'T12:00:00').getMonth() + 1;
      const ano = new Date(l.dataVencimento + 'T12:00:00').getFullYear();
      return (mesFiltro === 0 || mes === mesFiltro) && (anoFiltro === 0 || ano === anoFiltro);
    });
  }, [lancamentos, mesFiltro, anoFiltro]);

  const receitasMesPagas = lancamentosMes.filter(l => l.tipo === 'receita' && l.status === 'pago').reduce((a, b) => a + b.valor, 0);
  const despesasMesPagas = lancamentosMes.filter(l => l.tipo === 'despesa' && l.status === 'pago').reduce((a, b) => a + b.valor, 0);
  const maxFinanceiro = Math.max(receitasMesPagas, despesasMesPagas) || 1;

  // --- O MOTOR DO GRÁFICO DE PIZZA DE DESPESAS ---
  // Pega todas as despesas (pagas ou não) daquele mês para saber para onde o dinheiro está fugindo
  const despesasTotaisDoMes = lancamentosMes.filter(l => l.tipo === 'despesa');
  const valorTotalDespesas = despesasTotaisDoMes.reduce((acc, l) => acc + l.valor, 0) || 1;

  const dadosPizza = useMemo(() => {
    const agrupado = despesasTotaisDoMes.reduce((acc, l) => {
      const catNome = l.categoria || 'Sem Categoria';
      const objCat = categoriasDespesa.find(c => c.nome === catNome);
      const cor = objCat ? objCat.cor : '#94a3b8'; // Puxa a cor que você cadastrou (ou Cinza)
      
      if (!acc[catNome]) acc[catNome] = { valor: 0, cor };
      acc[catNome].valor += l.valor;
      return acc;
    }, {} as Record<string, { valor: number, cor: string }>);

    // Converte para Array e ordena da maior despesa para a menor
    return Object.entries(agrupado)
      .map(([nome, dados]) => ({ nome, ...dados }))
      .sort((a, b) => b.valor - a.valor);
  }, [despesasTotaisDoMes, categoriasDespesa]);

  // Monta a string do CSS Conic Gradient (Ex: #ff0000 0% 20%, #00ff00 20% 100%)
  let grauAcumulado = 0;
  const stringConicGradient = dadosPizza.map(fatia => {
    const porcentagem = (fatia.valor / valorTotalDespesas) * 100;
    const slice = `${fatia.cor} ${grauAcumulado}% ${grauAcumulado + porcentagem}%`;
    grauAcumulado += porcentagem;
    return slice;
  }).join(', ');

  const temGraficoParaExibir = dadosPizza.length > 0;

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-3xl font-black text-slate-800">Painel de Controle</h2><p className="text-slate-500">Visão geral e saúde financeira.</p></div>
        <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none"><option value={0}>Todos os Meses</option>{Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}</option>))}</select>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none"><option value={0}>Todos</option><option value={2025}>2025</option><option value={2026}>2026</option></select>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white"><p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Saldo em Caixa Geral</p><h3 className={`text-3xl font-black ${saldoGeralRealizado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {saldoGeralRealizado.toFixed(2)}</h3></div>
        <div onClick={() => setTelaAtiva('financeiro')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-rose-400 hover:shadow-md transition-all group"><div className="flex justify-between items-start"><p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Contas a Pagar</p></div><h3 className="text-3xl font-black text-slate-800 group-hover:text-rose-600">R$ {contasAPagarGlobal.toFixed(2)}</h3><p className="text-[10px] text-slate-400 mt-1 font-bold">Total pendente</p></div>
        <div onClick={() => setTelaAtiva('financeiro')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group"><div className="flex justify-between items-start"><p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Contas a Receber</p></div><h3 className="text-3xl font-black text-slate-800 group-hover:text-emerald-600">R$ {contasAReceberGlobal.toFixed(2)}</h3><p className="text-[10px] text-slate-400 mt-1 font-bold">Total pendente</p></div>
        <div className="bg-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100"><p className="text-blue-600/70 text-xs font-bold uppercase tracking-wider mb-2">Estoque</p><h3 className="text-3xl font-black text-blue-700">R$ {valorEstoque.toFixed(2)}</h3><p className="text-xs font-bold text-blue-500 mt-1">{totalItensEstoque} itens armazenados</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO 1: BARRAS */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-slate-800">Fluxo do Mês ({mesFiltro === 0 ? 'Geral' : mesFiltro}/{anoFiltro === 0 ? 'Geral' : anoFiltro})</h3><span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">Realizado</span></div>
          <div className="space-y-6">
            <div><div className="flex justify-between text-sm font-bold mb-2"><span className="text-emerald-600">Entradas</span><span className="text-slate-800">R$ {receitasMesPagas.toFixed(2)}</span></div><div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(receitasMesPagas/maxFinanceiro)*100}%` }}></div></div></div>
            <div><div className="flex justify-between text-sm font-bold mb-2"><span className="text-rose-600">Saídas</span><span className="text-slate-800">R$ {despesasMesPagas.toFixed(2)}</span></div><div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden"><div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${(despesasMesPagas/maxFinanceiro)*100}%` }}></div></div></div>
          </div>
        </div>

        {/* GRÁFICO 2: DONUT CHART (PIZZA) MÁGICO DE DESPESAS */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1 w-full min-w-0">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Para onde o dinheiro vai?</h3>
            <p className="text-xs text-slate-500 font-medium mb-5">Distribuição das despesas do mês {mesFiltro === 0 ? 'selecionado' : mesFiltro}.</p>
            
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {temGraficoParaExibir ? dadosPizza.map((fatia) => (
                <div key={fatia.nome} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: fatia.cor }}></span><p className="font-bold text-slate-700 text-xs truncate max-w-[120px]">{fatia.nome}</p></div>
                  <div className="text-right"><p className="font-black text-slate-900 text-sm">R$ {fatia.valor.toFixed(2)}</p><p className="text-[10px] font-bold text-slate-400">{( (fatia.valor / valorTotalDespesas) * 100 ).toFixed(1)}%</p></div>
                </div>
              )) : (
                <p className="text-xs font-bold text-slate-400 text-center py-4">Nenhuma despesa no período.</p>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-center">
            {/* O Gráfico de Pizza NATIVO (Zero bibliotecas lentas!) */}
            <div 
              className="w-48 h-48 rounded-full shadow-inner flex items-center justify-center relative transform hover:scale-105 transition-transform duration-500"
              style={{ background: temGraficoParaExibir ? `conic-gradient(${stringConicGradient})` : '#f1f5f9' }}
            >
              <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-md border-4 border-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Despesas</p>
                <p className="font-black text-rose-600 text-lg">R$ {(temGraficoParaExibir ? valorTotalDespesas : 0).toFixed(2)}</p>
              </div> 
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}