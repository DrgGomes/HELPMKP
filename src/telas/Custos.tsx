import React, { useState } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { CustoPadrao } from '../types';

interface CustosProps {
  custosPadrao: CustoPadrao[];
}

const CUSTOS_1_CLIQUE = [
  { nome: 'Caixa de Papelão', valor: 1.50, icone: '📦' },
  { nome: 'Etiqueta Térmica', valor: 0.15, icone: '🏷️' },
  { nome: 'Saco Plástico / Envelope', valor: 0.45, icone: '✉️' },
  { nome: 'Impressão DTF', valor: 4.50, icone: '🖨️' },
  { nome: 'Plástico Bolha', valor: 0.80, icone: '🫧' },
  { nome: 'Fita Adesiva', valor: 0.25, icone: '📼' },
  { nome: 'Panfleto / Mimo', valor: 0.30, icone: '🎁' }
];

export default function Custos({ custosPadrao }: CustosProps) {
  const [idCustoEdicao, setIdCustoEdicao] = useState<string | null>(null);
  const [nomeCusto, setNomeCusto] = useState('');
  const [valorCusto, setValorCusto] = useState('');
  const [iconeCusto, setIconeCusto] = useState('📦');

  const lidarSalvarCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCusto || !valorCusto) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const dadosAtualizados = {
      nome: nomeCusto,
      valor: parseFloat(valorCusto),
      icone: iconeCusto || '📌',
    };

    try {
      if (idCustoEdicao) {
        await setDoc(doc(db, 'usuarios', userId, 'custos_padrao', idCustoEdicao), dadosAtualizados);
      } else {
        await addDoc(collection(db, 'usuarios', userId, 'custos_padrao'), dadosAtualizados);
      }
      limparFormulario();
    } catch (error) {
      console.error("Erro ao salvar custo:", error);
    }
  };

  const adicionarPadrao = async (padrao: any) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    await addDoc(collection(db, 'usuarios', userId, 'custos_padrao'), {
      nome: padrao.nome,
      valor: padrao.valor,
      icone: padrao.icone
    });
  };

  const iniciarEdicao = (custo: CustoPadrao) => {
    setIdCustoEdicao(custo.id);
    setNomeCusto(custo.nome);
    setValorCusto(custo.valor.toString());
    setIconeCusto(custo.icone);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => {
    setIdCustoEdicao(null); setNomeCusto(''); setValorCusto(''); setIconeCusto('📦');
  };

  const lidarExcluir = async (id: string) => {
    if (window.confirm("Deseja excluir este custo global?")) {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      await deleteDoc(doc(db, 'usuarios', userId, 'custos_padrao', id));
    }
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <header className="mb-8 md:mb-10">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Custos Variáveis</h2>
        <p className="text-slate-500 mt-1 text-sm md:text-base">Gerencie os valores de embalagens e insumos. Eles aparecerão como atalhos no cadastro de produtos.</p>
      </header>

      {/* Adicionar com 1 Clique */}
      <div className="mb-10">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Adicionar Rápidos (1 Clique)</h3>
        <div className="flex flex-wrap gap-3">
          {CUSTOS_1_CLIQUE.map((padrao, idx) => (
            <button key={idx} onClick={() => adicionarPadrao(padrao)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm transition-all flex items-center gap-2">
              <span className="text-lg">{padrao.icone}</span> {padrao.nome} (+R$ {padrao.valor.toFixed(2)})
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 md:gap-8">
        {/* Formulário */}
        <div className="xl:w-1/3 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>⚙️</span> {idCustoEdicao ? 'Editar Custo' : 'Criar Personalizado'}
          </h3>
          <form onSubmit={lidarSalvarCusto} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Insumo</label>
              <input type="text" required placeholder="Ex: Caixa de Sapato Especial" value={nomeCusto} onChange={(e) => setNomeCusto(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Valor (R$)</label>
                <input type="number" required step="0.01" placeholder="0.00" value={valorCusto} onChange={(e) => setValorCusto(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Emoji / Ícone</label>
                <input type="text" maxLength={2} value={iconeCusto} onChange={(e) => setIconeCusto(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl text-center focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className={`flex-1 text-white py-3 rounded-xl text-sm font-bold shadow-sm transition-colors ${idCustoEdicao ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {idCustoEdicao ? 'Atualizar Custo' : 'Salvar Custo'}
              </button>
              {idCustoEdicao && <button type="button" onClick={limparFormulario} className="px-5 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors">Cancelar</button>}
            </div>
          </form>
        </div>
        
        {/* Lista Ativa */}
        <div className="xl:w-2/3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Meus Custos Salvos</h3>
          {custosPadrao.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">
              Você ainda não tem custos salvos. Adicione pelos botões rápidos acima!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {custosPadrao.map((custo) => (
                <div key={custo.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={() => iniciarEdicao(custo)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">✏️</button>
                    <button onClick={() => lidarExcluir(custo.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100">🗑️</button>
                  </div>
                  <div className="flex flex-col items-center text-center mt-2">
                    <span className="text-4xl mb-3">{custo.icone}</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">{custo.nome}</h4>
                    <p className="font-black text-blue-600 text-lg">R$ {custo.valor.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}