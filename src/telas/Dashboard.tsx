import React, { useState, useMemo } from 'react';
import type { Produto, Plataforma, LancamentoFinanceiro } from '../types';

interface DashboardProps {
  produtos: Produto[];
  plataformas: Plataforma[];
  lancamentos: LancamentoFinanceiro[];
  setTelaAtiva: (tela: string) => void;
}

export default function Dashboard({ produtos, plataformas, lancamentos, setTelaAtiva }: DashboardProps) {
  const dataAtual = new Date();
  const [mesFiltro, setMesFiltro] = useState<number>(dataAtual.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState<number>(dataAtual.getFullYear());

  // Filtra os lançamentos baseados no mês/ano escolhido
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      const dataLanc = new Date(l.dataVencimento + 'T12:00:00'); 
      const mes = dataLanc.getMonth() + 1;
      const ano = dataLanc.getFullYear();
      const matchMes = mesFiltro === 0 || mes === mesFiltro;
      const matchAno = anoFiltro === 0 || ano === anoFiltro;
      return matchMes && matchAno;
    });
  }, [lancamentos, mesFiltro, anoFiltro]);

  const receitasRealizadas = lancamentosFiltrados.filter(l => l.tipo === 'receita' && l.status === 'pago').reduce((a, b) => a + b.valor, 0);
  const despesasRealizadas = lancamentosFiltrados.filter(l => l.tipo === 'despesa' && l.status === 'pago').reduce((a, b) => a + b.valor, 0);
  const saldoCaixa = receitasRealizadas - despesasRealizadas;

  const contasAPagar = lancamentosFiltrados.filter(l => l.tipo === 'despesa' && l.status === 'pendente').reduce((a, b) => a + b.valor, 0);
  const contasAReceber = lancamentosFiltrados.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((a, b) => a + b.valor, 0);

  const valorEstoque = produtos.reduce((acc, p) => acc + (p.custoBase * (p.estoque || 0)), 0);
  const totalItensEstoque = produtos.reduce((acc, p) => acc + (p.estoque || 0), 0);

  const maxFinanceiro = Math.max(receitasRealizadas, despesasRealizadas) || 1;
  const pctReceitas = (receitasRealizadas / maxFinanceiro) * 100;
  const pctDespesas = (despesasRealizadas / maxFinanceiro) * 100;

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Painel de Controle</h2>
          <p className="text-slate-500">Visão geral e saúde financeira.</p>
        </div>
        
        {/* Filtros da Dashboard */}
        <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none">
            <option value={0}>Todos os Meses</option>
            {Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}</option>))}
          </select>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none">
            <option value={0}>Todos os Anos</option><option value={2025}>2025</option><option value={2026}>2026</option><option value={2027}>2027</option>
          </select>
        </div>
      </header>

      {/* CARDS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Saldo Realizado</p>
          <h3 className={`text-3xl font-black ${saldoCaixa >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>R$ {saldoCaixa.toFixed(2)}</h3>
        </div>
        
        {/* CARDS CLICÁVEIS */}
        <div onClick={() => setTelaAtiva('financeiro')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-rose-400 hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Contas a Pagar</p>
            <span className="text-slate-300 group-hover:text-rose-400 transition-colors">↗</span>
          </div>
          <h3 className="text-3xl font-black text-slate-800 group-hover:text-rose-600 transition-colors">R$ {contasAPagar.toFixed(2)}</h3>
        </div>

        <div onClick={() => setTelaAtiva('financeiro')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Contas a Receber</p>
            <span className="text-slate-300 group-hover:text-emerald-400 transition-colors">↗</span>
          </div>
          <h3 className="text-3xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors">R$ {contasAReceber.toFixed(2)}</h3>
        </div>

        <div className="bg-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100">
          <p className="text-blue-600/70 text-xs font-bold uppercase tracking-wider mb-2">Dinheiro em Estoque</p>
          <h3 className="text-3xl font-black text-blue-700">R$ {valorEstoque.toFixed(2)}</h3>
          <p className="text-xs font-bold text-blue-500 mt-1">{totalItensEstoque} itens armazenados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Receitas vs Despesas (No Período Filtrado)</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm font-bold mb-2"><span className="text-emerald-600">Entradas</span><span className="text-slate-800">R$ {receitasRealizadas.toFixed(2)}</span></div>
              <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${pctReceitas}%` }}></div></div>
            </div>
            <div>
              <div className="flex justify-between text-sm font-bold mb-2"><span className="text-rose-600">Saídas</span><span className="text-slate-800">R$ {despesasRealizadas.toFixed(2)}</span></div>
              <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden"><div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${pctDespesas}%` }}></div></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Visão Geral do SaaS</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl text-center"><span className="block text-4xl mb-2">📦</span><span className="block text-2xl font-black text-slate-800">{produtos.length}</span><span className="text-xs font-bold text-slate-500 uppercase">Produtos</span></div>
            <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl text-center"><span className="block text-4xl mb-2">🛍️</span><span className="block text-2xl font-black text-slate-800">{plataformas.length}</span><span className="text-xs font-bold text-slate-500 uppercase">Canais</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}