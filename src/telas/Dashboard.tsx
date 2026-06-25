import { useState, useMemo } from 'react';
import type { Produto, Plataforma, LancamentoFinanceiro, CategoriaDespesa } from '../types';

interface DashboardProps {
  produtos: Produto[]; 
  plataformas: Plataforma[]; 
  lancamentos: LancamentoFinanceiro[];
  categoriasDespesa: CategoriaDespesa[];
  setTelaAtiva: (tela: string) => void;
}

export default function Dashboard({ produtos, plataformas, lancamentos, categoriasDespesa, setTelaAtiva }: DashboardProps) {
  const dataAtual = new Date();
  const [mesFiltro, setMesFiltro] = useState<number>(dataAtual.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(dataAtual.getFullYear());

  // --- MOTOR DE DADOS CORE ---
  const saldoGeralRealizado = lancamentos.filter(l => l.status === 'pago').reduce((acc, l) => acc + (l.tipo === 'receita' ? l.valor : -l.valor), 0);
  
  const faturasPagarAtrasadas = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pendente' && l.dataVencimento < dataAtual.toISOString().split('T')[0]);
  const faturasReceberAtrasadas = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pendente' && l.dataVencimento < dataAtual.toISOString().split('T')[0]);
  
  const contasAPagarGlobal = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pendente').reduce((a, b) => a + b.valor, 0);
  const contasAReceberGlobal = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((a, b) => a + b.valor, 0);

  const valorEstoque = produtos.reduce((acc, p) => acc + (p.custoBase * (p.estoque || 0)), 0);
  const totalItensEstoque = produtos.reduce((acc, p) => acc + (p.estoque || 0), 0);

  // --- INTELIGÊNCIA PREDITIVA (INSIGHTS GERADOS AUTOMATICAMENTE) ---
  const insights = useMemo(() => {
    const alertas = [];
    
    // Análise 1: Saúde do Caixa a Curto Prazo
    if (faturasPagarAtrasadas.length > 0) {
      alertas.push({ tipo: 'critico', icone: '🚨', titulo: 'Atenção ao Fluxo', msg: `Você tem ${faturasPagarAtrasadas.length} faturas atrasadas totalizando R$ ${faturasPagarAtrasadas.reduce((a,b)=>a+b.valor,0).toFixed(2)}. Risco de multas e bloqueio de fornecedores.`, acao: 'Pagar Agora', link: 'financeiro' });
    } else if (contasAPagarGlobal > (saldoGeralRealizado + contasAReceberGlobal) && saldoGeralRealizado > 0) {
      alertas.push({ tipo: 'alerta', icone: '📉', titulo: 'Gargalo Financeiro Detectado', msg: 'Suas obrigações futuras superam seu saldo atual + recebíveis. Considere adiar compras de insumos nesta semana.', acao: 'Ver Contas', link: 'financeiro' });
    } else if (saldoGeralRealizado > (contasAPagarGlobal * 2)) {
      alertas.push({ tipo: 'sucesso', icone: '🚀', titulo: 'Caixa Fortalecido', msg: 'Seu saldo líquido cobre 2x suas dívidas. Excelente momento para investir em tráfego pago ou novos moldes de calçados.', acao: 'Precificar Novos', link: 'calculadora' });
    }

    // Análise 2: Estoque Inteligente
    const produtosEstoqueBaixo = produtos.filter(p => (p.estoque || 0) <= (p.estoqueMinimo || 5) && (p.estoque || 0) > 0);
    const produtosZerados = produtos.filter(p => (p.estoque || 0) === 0);
    
    if (produtosZerados.length > 0) {
      alertas.push({ tipo: 'critico', icone: '📦', titulo: 'Ruptura de Estoque!', msg: `${produtosZerados.length} produtos chegaram a zero. Pause os anúncios no Mercado Livre imediatamente para não afetar sua reputação.`, acao: 'Ajustar Estoque', link: 'produtos_lista' });
    } else if (produtosEstoqueBaixo.length > 0) {
      alertas.push({ tipo: 'alerta', icone: '⏳', titulo: 'Reposição Necessária', msg: `${produtosEstoqueBaixo.length} itens estão na zona vermelha de estoque mínimo. Acione seus fornecedores hoje.`, acao: 'Ver Insumos', link: 'fornecedores' });
    }

    // Se não tiver nada de errado, gera um insight positivo genérico
    if (alertas.length === 0) {
      alertas.push({ tipo: 'info', icone: '🧠', titulo: 'IA Status: Operação Saudável', msg: 'Nenhum risco detectado no momento. Continue focando em escalar as vendas e cadastrar novos produtos no sistema.', acao: 'Criar Produto', link: 'produto_cadastro' });
    }

    return alertas;
  }, [faturasPagarAtrasadas, contasAPagarGlobal, saldoGeralRealizado, contasAReceberGlobal, produtos]);

  // --- SCORE DE SAÚDE DO NEGÓCIO (0 a 100) ---
  const healthScore = useMemo(() => {
    let score = 100;
    if (saldoGeralRealizado < 0) score -= 40;
    if (faturasPagarAtrasadas.length > 0) score -= 20;
    if (contasAPagarGlobal > (saldoGeralRealizado + contasAReceberGlobal)) score -= 15;
    const prodZerados = produtos.filter(p => (p.estoque || 0) === 0).length;
    if (prodZerados > 0) score -= (prodZerados * 5);
    return Math.max(0, Math.min(100, score));
  }, [saldoGeralRealizado, faturasPagarAtrasadas, contasAPagarGlobal, contasAReceberGlobal, produtos]);

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

  const despesasTotaisDoMes = lancamentosMes.filter(l => l.tipo === 'despesa');
  const valorTotalDespesas = despesasTotaisDoMes.reduce((acc, l) => acc + l.valor, 0) || 1;

  const dadosPizza = useMemo(() => {
    const agrupado = despesasTotaisDoMes.reduce((acc, l) => {
      const catNome = l.categoria || 'Sem Categoria';
      const objCat = categoriasDespesa.find(c => c.nome === catNome);
      const cor = objCat ? objCat.cor : '#94a3b8';
      if (!acc[catNome]) acc[catNome] = { valor: 0, cor };
      acc[catNome].valor += l.valor;
      return acc;
    }, {} as Record<string, { valor: number, cor: string }>);
    return Object.entries(agrupado).map(([nome, dados]) => ({ nome, ...dados })).sort((a, b) => b.valor - a.valor);
  }, [despesasTotaisDoMes, categoriasDespesa]);

  let grauAcumulado = 0;
  const stringConicGradient = dadosPizza.map(fatia => {
    const porcentagem = (fatia.valor / valorTotalDespesas) * 100;
    const slice = `${fatia.cor} ${grauAcumulado}% ${grauAcumulado + porcentagem}%`;
    grauAcumulado += porcentagem;
    return slice;
  }).join(', ');

  const temGraficoParaExibir = dadosPizza.length > 0;

  return (
    <div className="animate-fade-in space-y-8 pb-20">
      
      {/* CABEÇALHO 5.0 */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Centro de Comando</h2>
          <p className="text-slate-500 font-medium mt-1">Bem-vindo ao motor estratégico da sua operação.</p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-colors"><option value={0}>Panorama Global (Todos Meses)</option>{Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}</option>))}</select>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 cursor-pointer border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none transition-colors"><option value={0}>Todos Anos</option><option value={2025}>2025</option><option value={2026}>2026</option></select>
        </div>
      </header>

      {/* MOTOR DE INSIGHTS PREDITIVOS (NOVIDADE ABSOLUTA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.slice(0,3).map((insight, idx) => (
          <div key={idx} className={`p-6 rounded-3xl border flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.02] ${
            insight.tipo === 'critico' ? 'bg-rose-50 border-rose-200 shadow-[0_4px_20px_rgba(225,29,72,0.1)]' :
            insight.tipo === 'alerta' ? 'bg-amber-50 border-amber-200' :
            insight.tipo === 'sucesso' ? 'bg-emerald-50 border-emerald-200' :
            'bg-indigo-50 border-indigo-200'
          }`}>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{insight.icone}</span>
                <h4 className={`font-black text-sm uppercase tracking-widest ${
                  insight.tipo === 'critico' ? 'text-rose-700' : insight.tipo === 'alerta' ? 'text-amber-700' : insight.tipo === 'sucesso' ? 'text-emerald-700' : 'text-indigo-700'
                }`}>{insight.titulo}</h4>
              </div>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">{insight.msg}</p>
            </div>
            <button onClick={() => setTelaAtiva(insight.link)} className={`mt-5 self-start px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              insight.tipo === 'critico' ? 'bg-rose-600 text-white hover:bg-rose-700' : insight.tipo === 'alerta' ? 'bg-amber-500 text-white hover:bg-amber-600' : insight.tipo === 'sucesso' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}>
              {insight.acao} →
            </button>
          </div>
        ))}

        {/* TERMÔMETRO DE SAÚDE DA EMPRESA */}
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-white flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-1">Score da Operação</h4>
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-black ${healthScore >= 80 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{healthScore}</span>
              <span className="text-slate-500 font-bold mb-1">/100</span>
            </div>
            <p className="text-slate-400 text-xs mt-2 font-medium">Algoritmo analisa caixa líquido, dívidas atrasadas e volume de estoque.</p>
          </div>
          <div className="mt-5 w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${healthScore}%` }}></div>
          </div>
        </div>
      </div>

      {/* OS 4 PILARES FINANCEIROS (DESIGN CLEAN E IMPACTANTE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-5xl">🏦</div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Caixa Realizado</p>
          <h3 className={`text-3xl font-black tracking-tight ${saldoGeralRealizado >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {saldoGeralRealizado.toFixed(2)}</h3>
          <p className="text-xs font-bold text-slate-500 mt-2">Saldo líquido disponível hoje.</p>
        </div>

        <div onClick={() => setTelaAtiva('financeiro')} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-300 hover:shadow-lg transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:text-rose-500 transition-all text-5xl">📉</div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Faturas a Pagar</p>
          <h3 className="text-3xl font-black text-slate-800 group-hover:text-rose-600 transition-colors tracking-tight">R$ {contasAPagarGlobal.toFixed(2)}</h3>
          <p className="text-xs font-bold text-slate-500 mt-2">{faturasPagarAtrasadas.length} pendências atrasadas.</p>
        </div>

        <div onClick={() => setTelaAtiva('financeiro')} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-300 hover:shadow-lg transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:text-emerald-500 transition-all text-5xl">📈</div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Contas a Receber</p>
          <h3 className="text-3xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors tracking-tight">R$ {contasAReceberGlobal.toFixed(2)}</h3>
          <p className="text-xs font-bold text-slate-500 mt-2">Dinheiro a caminho da conta.</p>
        </div>

        <div onClick={() => setTelaAtiva('produtos_lista')} className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-lg border border-blue-500 text-white cursor-pointer hover:shadow-blue-500/30 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20 text-5xl transform group-hover:scale-110 transition-transform">📦</div>
          <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-2">Patrimônio em Estoque</p>
          <h3 className="text-3xl font-black tracking-tight text-white">R$ {valorEstoque.toFixed(2)}</h3>
          <p className="text-xs font-bold text-blue-200 mt-2">{totalItensEstoque} produtos imobilizados.</p>
        </div>
      </div>

      {/* ÁREA DE GRÁFICOS (REDISEGNADOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Termômetro do Mês */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-800">Termômetro do Período</h3>
            <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">{mesFiltro === 0 ? 'Tempo Real' : 'Filtrado'}</span>
          </div>
          
          <div className="space-y-8 flex-1 flex flex-col justify-center">
            <div>
              <div className="flex justify-between items-end mb-3">
                <div><p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Receitas Validadas</p><p className="text-2xl font-black text-slate-800">R$ {receitasMesPagas.toFixed(2)}</p></div>
                <span className="text-sm font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md">{((receitasMesPagas/maxFinanceiro)*100 || 0).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full transition-all duration-1000 rounded-full" style={{ width: `${(receitasMesPagas/maxFinanceiro)*100}%` }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-3">
                <div><p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Despesas Pagas</p><p className="text-2xl font-black text-slate-800">R$ {despesasMesPagas.toFixed(2)}</p></div>
                <span className="text-sm font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-md">{((despesasMesPagas/maxFinanceiro)*100 || 0).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-full transition-all duration-1000 rounded-full" style={{ width: `${(despesasMesPagas/maxFinanceiro)*100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico 2: Mapeamento de Custos (Donut 3D) */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1 w-full min-w-0">
            <h3 className="text-xl font-black text-slate-800 mb-2">Escoamento de Capital</h3>
            <p className="text-xs text-slate-500 font-bold mb-6 leading-relaxed">Para onde seu dinheiro está indo? Acompanhe o centro de custos em tempo real.</p>
            
            <div className="space-y-3 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
              {temGraficoParaExibir ? dadosPizza.map((fatia) => (
                <div key={fatia.nome} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:border-slate-300 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full shadow-sm border border-black/10" style={{ backgroundColor: fatia.cor }}></span>
                    <p className="font-black text-slate-700 text-xs truncate max-w-[120px] group-hover:text-slate-900">{fatia.nome}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 text-sm">R$ {fatia.valor.toFixed(2)}</p>
                    <p className="text-[10px] font-black text-slate-400">{( (fatia.valor / valorTotalDespesas) * 100 ).toFixed(1)}%</p>
                  </div>
                </div>
              )) : (
                <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Painel Vazio</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">Nenhuma despesa para mapear.</p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-center p-4">
            <div className="relative w-48 h-48 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.1)] flex items-center justify-center transform hover:scale-105 transition-transform duration-500" style={{ background: temGraficoParaExibir ? `conic-gradient(${stringConicGradient})` : '#f8fafc' }}>
              <div className="absolute inset-0 rounded-full shadow-inner border-[6px] border-white/20 pointer-events-none"></div>
              <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-xl border-8 border-white z-10 relative">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saídas</p>
                <p className="font-black text-rose-600 text-xl tracking-tight">R$ {(temGraficoParaExibir ? valorTotalDespesas : 0).toFixed(0)}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}