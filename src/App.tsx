import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Produto, Plataforma } from './types';
import Login from './telas/Login';
import Dashboard from './telas/Dashboard';
import Configuracoes from './telas/Configuracoes';
import Produtos from './telas/Produtos';
import Perfil from './telas/Perfil';

export default function App() {
  const [isLogado, setIsLogado] = useState(false);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [telaAtiva, setTelaAtiva] = useState('produtos_lista');
  const [menuAberto, setMenuAberto] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState('');

  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  useEffect(() => {
    let unsubPlat: () => void = () => {};
    let unsubProd: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLogado(true);
        setEmailUsuario(user.email || '');

        const refPlat = collection(db, 'usuarios', user.uid, 'plataformas');
        unsubPlat = onSnapshot(refPlat, (snapshot) => {
          const listaPlat: Plataforma[] = [];
          snapshot.forEach((doc) => {
            listaPlat.push({ id: doc.id, ...doc.data() } as Plataforma);
          });
          setPlataformas(listaPlat);
        });

        const refProd = collection(db, 'usuarios', user.uid, 'produtos');
        unsubProd = onSnapshot(refProd, (snapshot) => {
          const listaProd: Produto[] = [];
          snapshot.forEach((doc) => {
            listaProd.push({ id: doc.id, ...doc.data() } as Produto);
          });
          setProdutos(listaProd);
        });
      } else {
        setIsLogado(false);
        setEmailUsuario('');
        setPlataformas([]);
        setProdutos([]);
        unsubPlat();
        unsubProd();
      }
      setCarregandoAuth(false);
    });

    return () => {
      unsubscribeAuth();
      unsubPlat();
      unsubProd();
    };
  }, []);

  const lidarSair = async () => {
    if (window.confirm('Deseja realmente sair do sistema?')) {
      await signOut(auth);
    }
  };

  if (carregandoAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
        <div className="relative flex items-center justify-center mb-4">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-500/30 border-t-blue-500"></div>
          <div className="absolute h-6 w-6 rounded-md bg-blue-500 animate-pulse"></div>
        </div>
        <p className="text-slate-400 font-bold tracking-wider text-sm uppercase">
          Carregando HelpMkp
        </p>
      </div>
    );
  }

  if (!isLogado) {
    return <Login aoLogar={() => setIsLogado(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row font-sans text-slate-800 antialiased">
      {/* Header Mobile - Estilo Tecnológico */}
      <div className="md:hidden bg-slate-950 text-white p-4 flex justify-between items-center shadow-lg border-b border-slate-900 z-20">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
          <h1 className="text-xl font-black tracking-tight text-white">
            HelpMkp
          </h1>
        </div>
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {menuAberto ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Menu Lateral - Premium Dark Tech Theme */}
      <div
        className={`${
          menuAberto ? 'block' : 'hidden'
        } md:flex w-full md:w-64 bg-slate-950 text-white p-5 flex-col absolute md:relative z-10 min-h-screen md:min-h-0 border-r border-slate-900 shadow-xl`}
      >
        <div className="flex items-center gap-2.5 mb-9 px-3 hidden md:flex">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            HelpMkp
          </h1>
        </div>

        <nav className="space-y-1 flex-1">
          <button
            onClick={() => {
              setTelaAtiva('dashboard');
              setMenuAberto(false);
            }}
            className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
              telaAtiva === 'dashboard'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15 font-black'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <span>📊</span> Dashboard
          </button>

          <div className="pt-6 pb-2">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
              Produtos
            </p>
          </div>
          <button
            onClick={() => {
              setTelaAtiva('produto_cadastro');
              setMenuAberto(false);
            }}
            className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
              telaAtiva === 'produto_cadastro'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15 font-black'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <span>➕</span> Cadastrar Produto
          </button>
          <button
            onClick={() => {
              setTelaAtiva('produtos_lista');
              setMenuAberto(false);
            }}
            className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
              telaAtiva === 'produtos_lista'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15 font-black'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <span>📦</span> Meus Produtos
          </button>

          <div className="pt-6 pb-2">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
              Ajustes Globais
            </p>
          </div>
          <button
            onClick={() => {
              setTelaAtiva('configuracoes');
              setMenuAberto(false);
            }}
            className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${
              telaAtiva === 'configuracoes'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15 font-black'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <span>⚙️</span> Configurar Taxas
          </button>
        </nav>

        {/* Widget do Usuário no Rodapé do Menu */}
        <div className="pt-4 border-t border-slate-900 mt-auto space-y-2">
          <button
            onClick={() => {
              setTelaAtiva('perfil');
              setMenuAberto(false);
            }}
            className={`w-full p-2.5 rounded-xl transition-all flex items-center gap-3 text-left border ${
              telaAtiva === 'perfil'
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'border-transparent text-slate-400 hover:bg-slate-900/60'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-blue-400 border border-slate-700">
              {emailUsuario ? emailUsuario.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">
                {emailUsuario || 'Usuário'}
              </p>
              <p className="text-[10px] text-slate-500 font-semibold truncate">
                Ver meu perfil
              </p>
            </div>
          </button>
          <button
            onClick={lidarSair}
            className="w-full py-2.5 px-4 bg-slate-900/50 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 border border-slate-900 hover:border-rose-900/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <span>🚪</span> Sair do Sistema
          </button>
        </div>
      </div>

      {/* Área de Conteúdo Principal */}
      <div className="flex-1 overflow-auto bg-slate-50/50">
        <div className="max-w-7xl mx-auto w-full p-5 md:p-8 lg:p-10">
          {telaAtiva === 'dashboard' && (
            <Dashboard produtos={produtos} plataformas={plataformas} />
          )}

          {(telaAtiva === 'produtos_lista' ||
            telaAtiva === 'produto_cadastro') && (
            <Produtos
              telaAtiva={telaAtiva}
              setTelaAtiva={setTelaAtiva}
              produtos={produtos}
              plataformas={plataformas}
            />
          )}

          {telaAtiva === 'configuracoes' && (
            <Configuracoes plataformas={plataformas} />
          )}

          {telaAtiva === 'perfil' && <Perfil />}
        </div>
      </div>
    </div>
  );
}
