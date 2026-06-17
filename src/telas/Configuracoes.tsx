import React, { useState, useRef } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Plataforma } from '../types';

interface ConfiguracoesProps {
  plataformas: Plataforma[];
}

// Catálogo de plataformas padrão baseado nas regras de mercado
const PLATAFORMAS_PADRAO = [
  {
    id_template: 'ml_premium',
    nome: 'Mercado Livre (Premium)',
    comissao: 16, // Média da categoria
    comissaoAfiliado: 0,
    taxaFixa: 6.0, // Taxa média para < R$79
    freteFixo: 0,
    logo: 'https://logo.clearbit.com/mercadolivre.com.br',
    cor: 'bg-yellow-400',
    textoCor: 'text-yellow-900',
  },
  {
    id_template: 'ml_classico',
    nome: 'Mercado Livre (Clássico)',
    comissao: 12,
    comissaoAfiliado: 0,
    taxaFixa: 6.0,
    freteFixo: 0,
    logo: 'https://logo.clearbit.com/mercadolivre.com.br',
    cor: 'bg-yellow-100',
    textoCor: 'text-yellow-800',
  },
  {
    id_template: 'shopee_padrao',
    nome: 'Shopee (Frete Grátis)',
    comissao: 20,
    comissaoAfiliado: 0,
    taxaFixa: 3.0,
    freteFixo: 0,
    logo: 'https://logo.clearbit.com/shopee.com.br',
    cor: 'bg-orange-500',
    textoCor: 'text-white',
  },
  {
    id_template: 'tiktok_shop',
    nome: 'TikTok Shop (< R$50)',
    comissao: 10,
    comissaoAfiliado: 0,
    taxaFixa: 4.0, // Ajustar para R$ 6.00 se o produto for > R$50
    freteFixo: 0,
    logo: 'https://logo.clearbit.com/tiktok.com',
    cor: 'bg-black',
    textoCor: 'text-white',
  },
  {
    id_template: 'kwai_shop',
    nome: 'Kwai Shop',
    comissao: 20,
    comissaoAfiliado: 0,
    taxaFixa: 4.0, // Ajustar se o produto for < R$8,00
    freteFixo: 0,
    logo: 'https://ui-avatars.com/api/?name=Kwai&background=ff7a00&color=fff',
    cor: 'bg-orange-600',
    textoCor: 'text-white',
  },
];

export default function Configuracoes({ plataformas }: ConfiguracoesProps) {
  // Referência para o carrossel para podermos rolar via botões
  const carrosselRef = useRef<HTMLDivElement>(null);

  const [idPlatEdicao, setIdPlatEdicao] = useState<string | null>(null);
  const [nomePlat, setNomePlat] = useState('');
  const [comissaoPlat, setComissaoPlat] = useState('');
  const [comissaoAfilPlat, setComissaoAfilPlat] = useState('');
  const [taxaFixaPlat, setTaxaFixaPlat] = useState('');
  const [freteFixoPlat, setFreteFixoPlat] = useState('');
  const [logoPlat, setLogoPlat] = useState('');
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null);

  // Funções para rolar o carrossel
  const rolarEsquerda = () => {
    if (carrosselRef.current) {
      carrosselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const rolarDireita = () => {
    if (carrosselRef.current) {
      carrosselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const lidarAdicionarPadrao = async (
    platTemplate: (typeof PLATAFORMAS_PADRAO)[0]
  ) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setAdicionandoId(platTemplate.id_template);

    try {
      const colRef = collection(db, 'usuarios', userId, 'plataformas');
      await addDoc(colRef, {
        nome: platTemplate.nome,
        comissao: platTemplate.comissao,
        comissaoAfiliado: platTemplate.comissaoAfiliado,
        taxaFixa: platTemplate.taxaFixa,
        freteFixo: platTemplate.freteFixo,
        logo: platTemplate.logo,
      });
    } catch (error) {
      console.error('Erro ao adicionar plataforma padrão:', error);
    } finally {
      setAdicionandoId(null);
    }
  };

  const lidarSalvarPlataforma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomePlat || !comissaoPlat) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const logoFinal =
      logoPlat.trim() !== ''
        ? logoPlat
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(
            nomePlat
          )}&background=random&color=fff`;

    const dadosAtualizados = {
      nome: nomePlat,
      comissao: parseFloat(comissaoPlat),
      comissaoAfiliado: comissaoAfilPlat ? parseFloat(comissaoAfilPlat) : 0,
      taxaFixa: taxaFixaPlat ? parseFloat(taxaFixaPlat) : 0,
      freteFixo: freteFixoPlat ? parseFloat(freteFixoPlat) : 0,
      logo: logoFinal,
    };

    try {
      if (idPlatEdicao) {
        const docRef = doc(db, 'usuarios', userId, 'plataformas', idPlatEdicao);
        await setDoc(docRef, dadosAtualizados);
      } else {
        const colRef = collection(db, 'usuarios', userId, 'plataformas');
        await addDoc(colRef, dadosAtualizados);
      }
      limparFormPlataforma();
    } catch (error) {
      console.error('Erro ao salvar plataforma:', error);
    }
  };

  const iniciarEdicaoPlataforma = (plat: Plataforma) => {
    setIdPlatEdicao(plat.id);
    setNomePlat(plat.nome);
    setComissaoPlat(plat.comissao.toString());
    setComissaoAfilPlat(plat.comissaoAfiliado.toString());
    setTaxaFixaPlat(plat.taxaFixa.toString());
    setFreteFixoPlat(plat.freteFixo.toString());
    setLogoPlat(plat.logo.includes('ui-avatars') ? '' : plat.logo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormPlataforma = () => {
    setIdPlatEdicao(null);
    setNomePlat('');
    setComissaoPlat('');
    setComissaoAfilPlat('');
    setTaxaFixaPlat('');
    setFreteFixoPlat('');
    setLogoPlat('');
  };

  const lidarExcluirPlataforma = async (id: string) => {
    if (
      window.confirm(
        'Tem certeza que deseja excluir esta plataforma? Seus produtos vinculados a ela perderão este cálculo.'
      )
    ) {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const docRef = doc(db, 'usuarios', userId, 'plataformas', id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error('Erro ao excluir plataforma:', error);
      }
    }
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-8 md:mb-10">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
          Taxas das Plataformas
        </h2>
        <p className="text-slate-500 mt-1 text-sm md:text-base">
          Configure os custos cobrados por cada marketplace para precificação
          precisa.
        </p>
      </header>

      {/* VITRINE DE PLATAFORMAS PADRÃO (1 CLIQUE) */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">⚡</span>
          <h3 className="text-lg font-bold text-slate-800">
            Adicionar com 1 Clique
          </h3>
        </div>

        {/* Container Relativo para segurar os botões flutuantes */}
        <div className="relative group">
          {/* Botão Esquerda */}
          <button
            onClick={rolarEsquerda}
            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 z-10 bg-white border border-slate-200 shadow-lg rounded-full w-12 h-12 items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 opacity-0 group-hover:opacity-100 transition-all hidden md:flex cursor-pointer"
            aria-label="Rolar para a esquerda"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Carrossel Scrollável */}
          <div
            ref={carrosselRef}
            className="flex overflow-x-auto pb-4 gap-4 snap-x hide-scrollbar"
          >
            {PLATAFORMAS_PADRAO.map((plat) => (
              <div
                key={plat.id_template}
                className="min-w-[260px] max-w-[260px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm snap-start flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner overflow-hidden ${plat.cor}`}
                  >
                    <img
                      src={plat.logo}
                      alt={plat.nome}
                      className="w-full h-full object-cover opacity-90"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm leading-tight">
                    {plat.nome}
                  </h4>
                </div>
                <div className="space-y-1 mb-5 flex-1">
                  <p className="text-xs text-slate-500 flex justify-between">
                    <span>Comissão:</span>{' '}
                    <strong className="text-slate-700">{plat.comissao}%</strong>
                  </p>
                  <p className="text-xs text-slate-500 flex justify-between">
                    <span>Taxa Fixa:</span>{' '}
                    <strong className="text-slate-700">
                      R$ {plat.taxaFixa.toFixed(2)}
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => lidarAdicionarPadrao(plat)}
                  disabled={adicionandoId === plat.id_template}
                  className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-blue-600 border border-slate-200 hover:border-blue-200 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {adicionandoId === plat.id_template ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></span>
                  ) : (
                    <>
                      <span>➕</span> Adicionar
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Botão Direita */}
          <button
            onClick={rolarDireita}
            className="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 z-10 bg-white border border-slate-200 shadow-lg rounded-full w-12 h-12 items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-300 opacity-0 group-hover:opacity-100 transition-all hidden md:flex cursor-pointer"
            aria-label="Rolar para a direita"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 md:gap-8">
        {/* FORMULÁRIO CUSTOMIZADO */}
        <div className="xl:w-1/3 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>⚙️</span>{' '}
            {idPlatEdicao ? 'Editar Plataforma' : 'Criar Personalizada'}
          </h3>
          <form onSubmit={lidarSalvarPlataforma} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Nome do Marketplace
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Mercado Livre Shoes"
                value={nomePlat}
                onChange={(e) => setNomePlat(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Comissão (%)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="0.00"
                  value={comissaoPlat}
                  onChange={(e) => setComissaoPlat(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Afiliado (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={comissaoAfilPlat}
                  onChange={(e) => setComissaoAfilPlat(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Taxa Fixa (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={taxaFixaPlat}
                  onChange={(e) => setTaxaFixaPlat(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Frete Fixo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={freteFixoPlat}
                  onChange={(e) => setFreteFixoPlat(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                URL da Logo (Opcional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={logoPlat}
                onChange={(e) => setLogoPlat(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className={`flex-1 text-white py-3 rounded-xl text-sm font-bold shadow-sm transition-colors ${
                  idPlatEdicao
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {idPlatEdicao ? 'Atualizar Dados' : 'Salvar Plataforma'}
              </button>
              {idPlatEdicao && (
                <button
                  type="button"
                  onClick={limparFormPlataforma}
                  className="px-5 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LISTA DE PLATAFORMAS ATIVAS */}
        <div className="xl:w-2/3 space-y-4">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">✅</span>
            <h3 className="text-lg font-bold text-slate-800">
              Suas Plataformas Ativas
            </h3>
          </div>

          {plataformas.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center">
              <p className="text-slate-500">
                Você ainda não configurou nenhuma plataforma.
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Adicione pelo catálogo rápido acima ou crie uma personalizada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {plataformas.map((plat) => (
                <div
                  key={plat.id}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => iniciarEdicaoPlataforma(plat)}
                      className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => lidarExcluirPlataforma(plat.id)}
                      className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="flex items-center gap-4 mb-5 pr-14">
                    <img
                      src={plat.logo}
                      alt=""
                      className="w-12 h-12 rounded-full border border-slate-100 p-1 object-contain bg-slate-50"
                      onError={(e) =>
                        (e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          plat.nome
                        )}&background=e2e8f0`)
                      }
                    />
                    <h4 className="font-bold text-slate-800 text-base leading-tight">
                      {plat.nome}
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                      <p className="text-blue-600/70 font-bold uppercase tracking-wider mb-0.5 text-[10px]">
                        Taxas
                      </p>
                      <p className="font-black text-slate-700 text-sm">
                        {plat.comissao}%{' '}
                        <span className="text-slate-400 font-medium text-xs">
                          + {plat.comissaoAfiliado}%
                        </span>
                      </p>
                    </div>
                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                      <p className="text-emerald-600/70 font-bold uppercase tracking-wider mb-0.5 text-[10px]">
                        Custos Fixos
                      </p>
                      <p className="font-black text-slate-700 text-sm">
                        R$ {plat.taxaFixa.toFixed(2)}{' '}
                        <span className="text-slate-400 font-medium text-xs">
                          + frete
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Estilo para esconder a barra de rolagem nativa e manter o visual limpo no carrossel */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
        }}
      />
    </div>
  );
}
