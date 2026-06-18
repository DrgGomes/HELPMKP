import React, { useState } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { CustoPadrao, Categoria } from '../types';

interface CustosProps {
  custosPadrao: CustoPadrao[];
  categorias: Categoria[];
}

const CUSTOS_1_CLIQUE = [
  { nome: 'Caixa de Papelão', valor: 1.50, icone: '📦' },
  { nome: 'Etiqueta Térmica', valor: 0.15, icone: '🏷️' },
  { nome: 'Impressão DTF', valor: 4.50, icone: '🖨️' },
  { nome: 'Plástico Bolha', valor: 0.80, icone: '🫧' }
];

const CATEGORIAS_1_CLIQUE = ['Calçados', 'Auto Peças', 'Vestuário', 'Eletrônicos', 'Casa e Decoração', 'Acessórios', 'Kits'];

export default function Custos({ custosPadrao, categorias }: CustosProps) {
  // Estados de Custos
  const [idCustoEdicao, setIdCustoEdicao] = useState<string | null>(null);
  const [nomeCusto, setNomeCusto] = useState('');
  const [valorCusto, setValorCusto] = useState('');
  const [iconeCusto, setIconeCusto] = useState('📦');

  // Estados de Categoria
  const [nomeCategoria, setNomeCategoria] = useState('');

  // --- FUNÇÕES DE CUSTOS ---
  const lidarSalvarCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCusto || !valorCusto) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    const dados = { nome: nomeCusto, valor: parseFloat(valorCusto), icone: iconeCusto || '📌' };

    try {
      if (idCustoEdicao) await setDoc(doc(db, 'usuarios', userId, 'custos_padrao', idCustoEdicao), dados);
      else await addDoc(collection(db, 'usuarios', userId, 'custos_padrao'), dados);
      setIdCustoEdicao(null); setNomeCusto(''); setValorCusto(''); setIconeCusto('📦');
    } catch (error) { console.error(error); }
  };

  const adicionarCustoPadrao = async (padrao: any) => {
    const userId = auth.currentUser?.uid as string;
    if (userId) await addDoc(collection(db, 'usuarios', userId, 'custos_padrao'), padrao);
  };

  const lidarExcluirCusto = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Excluir este insumo?")) await deleteDoc(doc(db, 'usuarios', userId, 'custos_padrao', id));
  };

  // --- FUNÇÕES DE CATEGORIAS ---
  const lidarSalvarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCategoria) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;
    await addDoc(collection(db, 'usuarios', userId, 'categorias'), { nome: nomeCategoria });
    setNomeCategoria('');
  };

  const adicionarCategoriaPadrao = async (nome: string) => {
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;
    if (categorias.some(c => c.nome === nome)) return; // Evita duplicar
    await addDoc(collection(db, 'usuarios', userId, 'categorias'), { nome });
  };

  const lidarExcluirCategoria = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Excluir esta categoria?")) await deleteDoc(doc(db, 'usuarios', userId, 'categorias', id));
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-12">
      
      {/* SESSÃO 1: CUSTOS VARIÁVEIS */}
      <section>
        <header className="mb-6">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2"><span>💸</span> Gestão de Insumos</h2>
          <p className="text-slate-500 mt-1 text-sm">Gerencie os valores de embalagens. Eles aparecerão como atalhos nos produtos.</p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {CUSTOS_1_CLIQUE.map((padrao, idx) => (
            <button key={idx} onClick={() => adicionarCustoPadrao(padrao)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm transition-all flex items-center gap-2">
              <span className="text-base">{padrao.icone}</span> {padrao.nome} (+R$ {padrao.valor.toFixed(2)})
            </button>
          ))}
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
          <div className="xl:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">{idCustoEdicao ? 'Editar Custo' : 'Criar Custo Manual'}</h3>
            <form onSubmit={lidarSalvarCusto} className="space-y-4">
              <div><input type="text" required placeholder="Nome do Insumo" value={nomeCusto} onChange={(e) => setNomeCusto(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" required step="0.01" placeholder="Valor R$" value={valorCusto} onChange={(e) => setValorCusto(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="text" maxLength={2} value={iconeCusto} onChange={(e) => setIconeCusto(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xl text-center focus:ring-2 focus:ring-blue-500 outline-none" title="Emoji do custo" />
              </div>
              <button type="submit" className={`w-full text-white py-2.5 rounded-xl text-sm font-bold transition-colors ${idCustoEdicao ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Salvar</button>
            </form>
          </div>
          
          <div className="xl:w-2/3 grid grid-cols-2 md:grid-cols-3 gap-4 h-fit">
            {custosPadrao.map((custo) => (
              <div key={custo.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group text-center">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => { setIdCustoEdicao(custo.id); setNomeCusto(custo.nome); setValorCusto(custo.valor.toString()); setIconeCusto(custo.icone); }} className="p-1 bg-slate-100 text-slate-600 rounded">✏️</button>
                  <button onClick={() => lidarExcluirCusto(custo.id)} className="p-1 bg-rose-50 text-rose-600 rounded">🗑️</button>
                </div>
                <span className="text-3xl block mb-2">{custo.icone}</span>
                <h4 className="font-bold text-slate-800 text-xs leading-tight mb-1">{custo.nome}</h4>
                <p className="font-black text-blue-600 text-sm">R$ {custo.valor.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SESSÃO 2: CATEGORIAS */}
      <section className="pt-8 border-t border-slate-200">
        <header className="mb-6">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2"><span>📂</span> Gestão de Categorias</h2>
          <p className="text-slate-500 mt-1 text-sm">Crie as categorias para organizar seu catálogo e facilitar o filtro.</p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIAS_1_CLIQUE.map((cat, idx) => (
            <button key={idx} onClick={() => adicionarCategoriaPadrao(cat)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
              + {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <form onSubmit={lidarSalvarCategoria} className="flex gap-2">
              <input type="text" required placeholder="Nova categoria..." value={nomeCategoria} onChange={(e) => setNomeCategoria(e.target.value)} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
              <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold">Criar</button>
            </form>
          </div>

          <div className="md:w-2/3 flex flex-wrap gap-3">
            {categorias.length === 0 ? <p className="text-sm text-slate-400">Nenhuma categoria criada.</p> : (
              categorias.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-sm font-bold text-slate-700">{cat.nome}</span>
                  <button onClick={() => lidarExcluirCategoria(cat.id)} className="w-6 h-6 flex items-center justify-center bg-rose-50 text-rose-500 rounded-full hover:bg-rose-100 ml-2">✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

    </div>
  );
}