import React, { useState } from 'react';
import { doc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { CustoPadrao, Categoria, CategoriaDespesa } from '../types';

interface CustosProps {
  custosPadrao: CustoPadrao[];
  categorias: Categoria[];
  categoriasDespesa: CategoriaDespesa[];
}

export default function Custos({ custosPadrao, categorias, categoriasDespesa }: CustosProps) {
  const [nomeCusto, setNomeCusto] = useState(''); const [valorCusto, setValorCusto] = useState(''); const [iconeCusto, setIconeCusto] = useState('📦');
  const [nomeCategoria, setNomeCategoria] = useState('');
  
  const [nomeCatDesp, setNomeCatDesp] = useState(''); const [corCatDesp, setCorCatDesp] = useState('#3b82f6');
  const coresPadrao = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#64748b', '#0f172a'];

  const adicionarCustoPadrao = async (e: React.FormEvent) => {
    e.preventDefault(); if (!nomeCusto || !valorCusto) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    await addDoc(collection(db, 'usuarios', userId, 'custos_padrao'), { nome: nomeCusto, valor: parseFloat(valorCusto), icone: iconeCusto });
    setNomeCusto(''); setValorCusto('');
  };

  const apagarCustoPadrao = async (id: string) => { const userId = auth.currentUser?.uid as string; if (userId && window.confirm("Excluir?")) await deleteDoc(doc(db, 'usuarios', userId, 'custos_padrao', id)); };

  const adicionarCategoria = async (e: React.FormEvent) => {
    e.preventDefault(); if (!nomeCategoria) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    await addDoc(collection(db, 'usuarios', userId, 'categorias'), { nome: nomeCategoria });
    setNomeCategoria('');
  };

  const apagarCategoria = async (id: string) => { const userId = auth.currentUser?.uid as string; if (userId && window.confirm("Excluir?")) await deleteDoc(doc(db, 'usuarios', userId, 'categorias', id)); };

  const adicionarCatDesp = async (e: React.FormEvent) => {
    e.preventDefault(); if (!nomeCatDesp) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    await addDoc(collection(db, 'usuarios', userId, 'categorias_despesas'), { nome: nomeCatDesp, cor: corCatDesp });
    setNomeCatDesp('');
  };

  const apagarCatDesp = async (id: string) => { const userId = auth.currentUser?.uid as string; if (userId && window.confirm("Excluir?")) await deleteDoc(doc(db, 'usuarios', userId, 'categorias_despesas', id)); };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>🗂️</span> Ajustes & Categorias</h2>
        <p className="text-slate-500 mt-1">Configure variáveis globais e pastas organizacionais do seu ERP.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="border-b border-slate-100 pb-3 mb-5"><h3 className="font-black text-rose-600 flex items-center gap-2"><span>💸</span> Categorias de Despesas</h3><p className="text-xs text-slate-400 mt-1 font-bold">Usado no Fluxo de Caixa e Gráficos.</p></div>
          <form onSubmit={adicionarCatDesp} className="space-y-4 mb-6">
            <input type="text" required placeholder="Ex: Energia, Combustível, Folha" value={nomeCatDesp} onChange={(e) => setNomeCatDesp(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Cor no Gráfico</p>
              <div className="flex flex-wrap gap-2">
                {coresPadrao.map(cor => (
                  <button key={cor} type="button" onClick={() => setCorCatDesp(cor)} className={`w-8 h-8 rounded-full border-2 transition-all ${corCatDesp === cor ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: cor }}></button>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl shadow-md transition-colors">+ Adicionar Pasta</button>
          </form>
          <div className="space-y-2">
            {categoriasDespesa.length === 0 ? <p className="text-xs text-center text-slate-400 font-bold">Nenhuma categoria criada.</p> : (
              categoriasDespesa.map(cat => (
                <div key={cat.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"><div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor }}></span><p className="font-bold text-slate-700 text-sm">{cat.nome}</p></div><button onClick={() => apagarCatDesp(cat.id)} className="text-slate-300 hover:text-rose-500 font-bold">✕</button></div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="border-b border-slate-100 pb-3 mb-5"><h3 className="font-black text-indigo-600 flex items-center gap-2"><span>📦</span> Custos de Embalagem</h3><p className="text-xs text-slate-400 mt-1 font-bold">Somados automaticamente na criação de produtos.</p></div>
          <form onSubmit={adicionarCustoPadrao} className="space-y-4 mb-6">
            <div className="flex gap-2"><input type="text" placeholder="Ícone" value={iconeCusto} onChange={(e) => setIconeCusto(e.target.value)} className="w-16 text-center px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl" /><input type="text" required placeholder="Ex: Caixa Padrão, Plástico Bolha" value={nomeCusto} onChange={(e) => setNomeCusto(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" /></div>
            <input type="number" step="0.01" required placeholder="Valor Unitário (R$)" value={valorCusto} onChange={(e) => setValorCusto(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-indigo-600 outline-none" />
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl shadow-md transition-colors">+ Salvar Embalagem</button>
          </form>
          <div className="space-y-2">
            {custosPadrao.length === 0 ? <p className="text-xs text-center text-slate-400 font-bold">Nenhum custo padrão.</p> : (
              custosPadrao.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"><div className="flex items-center gap-2"><span className="text-lg">{c.icone}</span><div><p className="font-bold text-slate-700 text-sm leading-none">{c.nome}</p><p className="font-black text-indigo-600 text-xs mt-1">R$ {c.valor.toFixed(2)}</p></div></div><button onClick={() => apagarCustoPadrao(c.id)} className="text-slate-300 hover:text-rose-500 font-bold">✕</button></div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="border-b border-slate-100 pb-3 mb-5"><h3 className="font-black text-slate-800 flex items-center gap-2"><span>👕</span> Categorias de Produtos</h3><p className="text-xs text-slate-400 mt-1 font-bold">Para organizar o seu Estoque de vendas.</p></div>
          <form onSubmit={adicionarCategoria} className="flex gap-2 mb-6">
            <input type="text" required placeholder="Ex: Camisetas, Botas" value={nomeCategoria} onChange={(e) => setNomeCategoria(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" />
            <button type="submit" className="px-6 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl shadow-md">+</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categorias.length === 0 ? <p className="text-xs w-full text-center text-slate-400 font-bold">Nenhuma criada.</p> : (
              categorias.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"><p className="font-bold text-slate-700 text-xs">{cat.nome}</p><button onClick={() => apagarCategoria(cat.id)} className="text-slate-400 hover:text-rose-500 font-black text-[10px]">✕</button></div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}