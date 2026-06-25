import { useState } from 'react';
import type { Plataforma } from '../types';

interface CalculadoraRapidaProps {
  plataformas: Plataforma[];
}

export default function CalculadoraRapida({ plataformas }: CalculadoraRapidaProps) {
  // Estados para as variáveis da simulação
  const [custoProduto, setCustoProduto] = useState<string>('');
  const [custoEmbalagem, setCustoEmbalagem] = useState<string>('');
  const [metaLucro, setMetaLucro] = useState<string>('');

  // Conversão segura para números
  const custoProdNum = parseFloat(custoProduto) || 0;
  const custoEmbNum = parseFloat(custoEmbalagem) || 0;
  const metaNum = parseFloat(metaLucro) || 0;
  
  const custoBaseTotal = custoProdNum + custoEmbNum;

  // Lógica Matemática de Precificação Reversa (Mark-up Reverso)
  const calcularPrecoVenda = (plat: Plataforma) => {
    // Fórmula: Preço = (Custo + Embalagem + Lucro + Taxa Fixa + Frete) / (1 - (Comissão / 100))
    const comissaoDecimal = (plat.comissao + (plat.comissaoAfiliado || 0)) / 100;
    
    // Proteção contra divisão por zero ou negativa (se a comissão for 100%+)
    if (comissaoDecimal >= 1) return 0;

    const numerador = custoBaseTotal + metaNum + (plat.taxaFixa || 0) + (plat.freteFixo || 0);
    return numerador / (1 - comissaoDecimal);
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8 pb-20">
      <header>
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <span className="text-4xl">🧮</span> Simulador Rápido de Viabilidade
        </h2>
        <p className="text-slate-500 mt-2 font-medium">
          Descubra o preço exato para anunciar e garantir sua meta de lucro limpo, já descontando as mordidas de cada marketplace.
        </p>
      </header>

      {/* PAINEL DE ENTRADA DE DADOS (OS INPUTS GIGANTES) */}
      <div className="bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Custo de Fábrica / Fornecedor</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">R$</span>
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                value={custoProduto}
                onChange={(e) => setCustoProduto(e.target.value)}
                className="w-full pl-14 pr-4 py-4 bg-slate-950/50 border border-slate-700 focus:border-blue-500 rounded-2xl font-black text-3xl text-white outline-none transition-all placeholder:text-slate-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Insumos & Embalagem</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">R$</span>
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                value={custoEmbalagem}
                onChange={(e) => setCustoEmbalagem(e.target.value)}
                className="w-full pl-14 pr-4 py-4 bg-slate-950/50 border border-slate-700 focus:border-rose-500 rounded-2xl font-black text-3xl text-white outline-none transition-all placeholder:text-slate-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              A Sua Meta Limpa no Bolso
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50 font-black text-xl">R$</span>
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                value={metaLucro}
                onChange={(e) => setMetaLucro(e.target.value)}
                className="w-full pl-14 pr-4 py-4 bg-emerald-950/30 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-2xl font-black text-3xl text-emerald-400 outline-none transition-all shadow-[0_0_15px_rgba(52,211,153,0.1)] placeholder:text-emerald-900/50"
              />
            </div>
          </div>

        </div>

        <div className="mt-6 flex justify-between items-center bg-slate-950/50 px-5 py-3 rounded-xl border border-slate-800">
          <p className="text-slate-400 font-bold text-sm">Custo Base Total da Operação:</p>
          <p className="text-xl font-black text-slate-200">R$ {custoBaseTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* RESULTADOS POR PLATAFORMA */}
      {custoBaseTotal > 0 || metaNum > 0 ? (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest px-2">Preços Sugeridos para Anúncio</h3>
          
          {plataformas.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center">
              <p className="text-amber-800 font-bold">Nenhuma plataforma configurada ainda.</p>
              <p className="text-amber-600 text-sm mt-1">Vá em "Taxas & Cofre" para cadastrar o ML, Shopee, TikTok, etc.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {plataformas.map((plat) => {
                const precoVenda = calcularPrecoVenda(plat);
                const valorComissao = precoVenda * ((plat.comissao + (plat.comissaoAfiliado || 0)) / 100);
                const valorTaxasFixas = (plat.taxaFixa || 0) + (plat.freteFixo || 0);
                
                // Validação de segurança matemática
                const lucroReal = precoVenda - custoBaseTotal - valorComissao - valorTaxasFixas;

                return (
                  <div key={plat.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-shadow relative overflow-hidden group">
                    {/* Tarja de cor da plataforma */}
                    <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: plat.cor || '#3b82f6' }}></div>
                    
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-100 bg-slate-50">
                        {plat.logo || '🛒'}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 leading-tight">{plat.nome}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Taxa: {plat.comissao}%</p>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Preço Final no Site</p>
                      <h3 className="text-4xl font-black text-slate-900 tracking-tight" style={{ color: plat.cor || '#0f172a' }}>
                        R$ {precoVenda.toFixed(2)}
                      </h3>
                    </div>

                    <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-bold">
                      <div className="flex justify-between text-slate-500">
                        <span>Custo Base</span>
                        <span>- R$ {custoBaseTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-rose-500">
                        <span>Comissão ({(plat.comissao + (plat.comissaoAfiliado || 0))}%)</span>
                        <span>- R$ {valorComissao.toFixed(2)}</span>
                      </div>
                      {(plat.taxaFixa > 0 || plat.freteFixo > 0) && (
                        <div className="flex justify-between text-rose-500">
                          <span>Taxa Fixa + Frete</span>
                          <span>- R$ {valorTaxasFixas.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-emerald-600 font-black text-sm">
                        <span>Lucro Limpo</span>
                        <span>R$ {lucroReal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <span className="text-6xl mb-4 grayscale">🧮</span>
          <p className="text-lg font-bold text-slate-400">Preencha os valores acima para iniciar a simulação.</p>
        </div>
      )}
    </div>
  );
}   