import { useState } from 'react';
import type { Plataforma } from '../types';

interface CalculadoraRapidaProps {
  plataformas: Plataforma[];
}

export default function CalculadoraRapida({ plataformas }: CalculadoraRapidaProps) {
  // 1: Meta Limpa (Fabricante) | 2: Analisar Concorrente (Espião)
  const [modoCalculo, setModoCalculo] = useState<1 | 2>(1);

  // Custos Quebrados (Visão de Fábrica)
  const [custoInsumo, setCustoInsumo] = useState<string>('');
  const [custoMaoDeObra, setCustoMaoDeObra] = useState<string>('');
  const [custoEmbalagem, setCustoEmbalagem] = useState<string>('');
  
  // Alvos (Depende do modo)
  const [valorAlvo, setValorAlvo] = useState<string>(''); // Pode ser a Meta de Lucro ou o Preço do Concorrente

  const cInsumo = parseFloat(custoInsumo) || 0;
  const cObra = parseFloat(custoMaoDeObra) || 0;
  const cEmb = parseFloat(custoEmbalagem) || 0;
  const alvoNum = parseFloat(valorAlvo) || 0;
  
  const custoBaseTotal = cInsumo + cObra + cEmb;

  // MOTOR DE INTELIGÊNCIA BIFÁSICO
  const processarInteligencia = (plat: Plataforma) => {
    const comissaoTotal = plat.comissao + (plat.comissaoAfiliado || 0);
    const comissaoDecimal = comissaoTotal / 100;
    const taxasFixas = (plat.taxaFixa || 0) + (plat.freteFixo || 0);

    if (modoCalculo === 1) {
      // MODO FABRICANTE: Calcula Preço Ideal
      if (comissaoDecimal >= 1) return { preco: 0, lucro: 0, comissaoGasta: 0, roi: 0, status: 'erro' };
      const precoSugerido = (custoBaseTotal + alvoNum + taxasFixas) / (1 - comissaoDecimal);
      const comissaoGasta = precoSugerido * comissaoDecimal;
      const roi = custoBaseTotal > 0 ? (alvoNum / custoBaseTotal) * 100 : 0;
      
      return { 
        preco: precoSugerido, lucro: alvoNum, comissaoGasta, roi, 
        status: roi >= 30 ? 'excelente' : roi >= 15 ? 'bom' : 'alerta' 
      };
    } else {
      // MODO ESPIÃO: Calcula Margem Real a partir do Preço de Mercado
      const precoMercado = alvoNum;
      const comissaoGasta = precoMercado * comissaoDecimal;
      const lucroReal = precoMercado - custoBaseTotal - comissaoGasta - taxasFixas;
      const roi = custoBaseTotal > 0 ? (lucroReal / custoBaseTotal) * 100 : 0;

      return { 
        preco: precoMercado, lucro: lucroReal, comissaoGasta, roi, 
        status: lucroReal < 0 ? 'prejuizo' : roi >= 30 ? 'excelente' : roi >= 15 ? 'bom' : 'alerta' 
      };
    }
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8 pb-20">
      
      {/* HEADER PREMIUM */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">🤖</span>
            <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-transparent bg-clip-text">
              Inteligência de Precificação
            </h2>
          </div>
          <p className="text-slate-500 font-medium max-w-xl">
            Simulador logístico avançado com engenharia reversa. Otimize sua esteira de produção e descubra a viabilidade real de qualquer produto em segundos.
          </p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200 w-full md:w-auto">
          <button onClick={() => setModoCalculo(1)} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 justify-center ${modoCalculo === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>
            <span>🎯</span> Meta Limpa
          </button>
          <button onClick={() => setModoCalculo(2)} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 justify-center ${modoCalculo === 2 ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 scale-105' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>
            <span>🕵️</span> Espião de Preço
          </button>
        </div>
      </header>

      {/* DASHBOARD DE INPUTS (VISUAL HACKER/DAY TRADE) */}
      <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 relative overflow-hidden">
        {/* Efeito de brilho de fundo */}
        <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900/0 to-transparent pointer-events-none"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          
          <div className="space-y-2 group">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-400 transition-colors">1. Matéria Prima</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">R$</span>
              <input type="number" step="0.01" placeholder="0.00" value={custoInsumo} onChange={(e) => setCustoInsumo(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-950/80 border border-slate-700 focus:border-blue-500 rounded-2xl font-black text-2xl text-white outline-none transition-all placeholder:text-slate-700 shadow-inner" />
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-amber-400 transition-colors">2. Mão de Obra / Fab.</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">R$</span>
              <input type="number" step="0.01" placeholder="0.00" value={custoMaoDeObra} onChange={(e) => setCustoMaoDeObra(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-950/80 border border-slate-700 focus:border-amber-500 rounded-2xl font-black text-2xl text-white outline-none transition-all placeholder:text-slate-700 shadow-inner" />
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-fuchsia-400 transition-colors">3. Embalagem / Outros</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">R$</span>
              <input type="number" step="0.01" placeholder="0.00" value={custoEmbalagem} onChange={(e) => setCustoEmbalagem(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-950/80 border border-slate-700 focus:border-fuchsia-500 rounded-2xl font-black text-2xl text-white outline-none transition-all placeholder:text-slate-700 shadow-inner" />
            </div>
          </div>

          <div className="space-y-2 group relative">
            <label className={`block text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${modoCalculo === 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${modoCalculo === 1 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              {modoCalculo === 1 ? '4. Lucro Alvo (Meta Limpa)' : '4. Preço de Venda do Concorrente'}
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl ${modoCalculo === 1 ? 'text-emerald-600/50' : 'text-rose-600/50'}`}>R$</span>
              <input type="number" step="0.01" placeholder="0.00" value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} className={`w-full pl-12 pr-4 py-4 bg-slate-950 border-2 rounded-2xl font-black text-3xl outline-none transition-all shadow-[0_0_20px_rgba(0,0,0,0.3)] ${modoCalculo === 1 ? 'border-emerald-500/50 focus:border-emerald-400 text-emerald-400 placeholder:text-emerald-900/50' : 'border-rose-500/50 focus:border-rose-400 text-rose-400 placeholder:text-rose-900/50'}`} />
            </div>
          </div>

        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center relative z-10">
          <div>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Custo Base de Produção (CPV)</p>
            <p className="text-2xl font-black text-white">R$ {custoBaseTotal.toFixed(2)}</p>
          </div>
          <button onClick={() => window.print()} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors border border-slate-700">
            🖨️ Exportar Relatório de Viabilidade
          </button>
        </div>
      </div>

      {/* RENDERIZAÇÃO DOS CARDS DE INTELIGÊNCIA */}
      {custoBaseTotal > 0 || alvoNum > 0 ? (
        <div className="space-y-6 animate-fade-in">
          
          {plataformas.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center shadow-sm">
              <p className="text-amber-800 font-bold text-lg">Nenhuma plataforma conectada.</p>
              <p className="text-amber-600 text-sm mt-1">Configure suas taxas no menu lateral para ativar o simulador.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {plataformas.map((plat) => {
                const result = processarInteligencia(plat);
                const valorTaxasFixas = (plat.taxaFixa || 0) + (plat.freteFixo || 0);

                return (
                  <div key={plat.id} className={`rounded-3xl p-1 shadow-lg transition-all duration-300 hover:scale-[1.02] ${result.status === 'prejuizo' ? 'bg-gradient-to-b from-rose-500 to-rose-900' : result.status === 'excelente' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600' : 'bg-gradient-to-b from-slate-200 to-slate-300'}`}>
                    <div className="bg-white rounded-[22px] p-6 h-full flex flex-col relative overflow-hidden">
                      
                      {/* Selo de Status da Operação */}
                      <div className="absolute top-4 right-4">
                        {result.status === 'prejuizo' && <span className="px-3 py-1 bg-rose-100 text-rose-700 font-black text-[10px] uppercase tracking-widest rounded-full border border-rose-200">❌ Prejuízo</span>}
                        {result.status === 'alerta' && <span className="px-3 py-1 bg-amber-100 text-amber-700 font-black text-[10px] uppercase tracking-widest rounded-full border border-amber-200">⚠️ Margem Baixa</span>}
                        {result.status === 'bom' && <span className="px-3 py-1 bg-blue-100 text-blue-700 font-black text-[10px] uppercase tracking-widest rounded-full border border-blue-200">👍 Saudável</span>}
                        {result.status === 'excelente' && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-black text-[10px] uppercase tracking-widest rounded-full border border-emerald-200 shadow-sm shadow-emerald-200">🔥 Escalonável</span>}
                      </div>

                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm border border-slate-100 bg-slate-50" style={{ color: plat.cor }}>
                          {plat.logo || '🛒'}
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 text-lg leading-tight">{plat.nome}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taxa Base: {plat.comissao}%</p>
                        </div>
                      </div>

                      <div className="text-center mb-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          {modoCalculo === 1 ? 'Preço Ideal de Venda' : 'Seu Concorrente Vende Por'}
                        </p>
                        <h3 className={`text-4xl font-black tracking-tight ${modoCalculo === 1 ? 'text-slate-900' : 'text-slate-500'}`}>
                          R$ {result.preco.toFixed(2)}
                        </h3>
                      </div>

                      <div className="space-y-3 font-bold text-xs flex-1">
                        <div className="flex justify-between items-center text-slate-500 pb-2 border-b border-slate-100">
                          <span>Custo de Fábrica Total</span>
                          <span>- R$ {custoBaseTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-rose-500 pb-2 border-b border-slate-100">
                          <span>Comissão ({(plat.comissao + (plat.comissaoAfiliado || 0))}%)</span>
                          <span>- R$ {result.comissaoGasta.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-rose-500 pb-2 border-b border-slate-100">
                          <span>Custos Fixos da Plataforma</span>
                          <span>- R$ {valorTaxasFixas.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className={`mt-6 pt-4 border-t-2 flex justify-between items-end ${result.status === 'prejuizo' ? 'border-rose-100' : 'border-emerald-100'}`}>
                        <div>
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${result.status === 'prejuizo' ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {result.status === 'prejuizo' ? 'Prejuízo Real' : 'Lucro Limpo na Conta'}
                          </p>
                          <p className={`text-2xl font-black ${result.status === 'prejuizo' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            R$ {result.lucro.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ROI</p>
                          <span className={`px-2 py-1 rounded-md text-xs font-black text-white ${result.status === 'prejuizo' ? 'bg-rose-500' : result.roi >= 30 ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                            {result.roi.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-50 border-2 border-dashed border-slate-300 rounded-3xl mx-4">
          <span className="text-6xl mb-6 grayscale">⚙️</span>
          <p className="text-xl font-black text-slate-500 uppercase tracking-widest text-center">Aguardando Parâmetros</p>
          <p className="text-sm font-bold text-slate-400 mt-2 text-center">Preencha os custos de fábrica no painel negro para ativar o motor de inteligência.</p>
        </div>
      )}
    </div>
  );
}