import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Produto, Plataforma, CustoPadrao, Categoria, CategoriaDespesa, Fornecedor, LancamentoFinanceiro, Compra, Midia } from './types';
import Login from './telas/Login';
import Dashboard from './telas/Dashboard';
import Configuracoes from './telas/Configuracoes';
import Produtos from './telas/Produtos';
import Perfil from './telas/Perfil';
import CriadorKit from './telas/CriadorKit';
import Custos from './telas/Custos';
import Fornecedores from './telas/Fornecedores';
import Financeiro from './telas/Financeiro';
import CalculadoraRapida from './telas/CalculadoraRapida';
import BackupManager from './telas/BackupManager';
import GaleriaMidia from './telas/GaleriaMidia';
import CriadorAnuncio from './telas/CriadorAnuncio'; // IMPORT DO NOVO ATIVO

export default function App() {
  const [isLogado, setIsLogado] = useState(false);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [telaAtiva, setTelaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState('');
  
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [custosPadrao, setCustosPadrao] = useState<CustoPadrao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<CategoriaDespesa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [midias, setMidias] = useState<Midia[]>([]);

  useEffect(() => {
    let unsubPlat: () => void = () => {}; let unsubProd: () => void = () => {}; let unsubCustos: () => void = () => {};
    let unsubCat: () => void = () => {}; let unsubCatDesp: () => void = () => {}; let unsubForn: () => void = () => {}; 
    let unsubLanc: () => void = () => {}; let unsubComp: () => void = () => {}; let unsubMidias: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLogado(true); setEmailUsuario(user.email || '');
        unsubPlat = onSnapshot(collection(db, 'usuarios', user.uid, 'plataformas'), (snapshot) => { setPlataformas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plataforma))); });
        unsubProd = onSnapshot(collection(db, 'usuarios', user.uid, 'produtos'), (snapshot) => { setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto))); });
        unsubCustos = onSnapshot(collection(db, 'usuarios', user.uid, 'custos_padrao'), (snapshot) => { setCustosPadrao(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustoPadrao))); });
        unsubCat = onSnapshot(collection(db, 'usuarios', user.uid, 'categorias'), (snapshot) => { setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria))); });
        unsubCatDesp = onSnapshot(collection(db, 'usuarios', user.uid, 'categorias_despesas'), (snapshot) => { setCategoriasDespesa(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoriaDespesa))); });
        unsubForn = onSnapshot(collection(db, 'usuarios', user.uid, 'fornecedores'), (snapshot) => { setFornecedores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fornecedor))); });
        unsubLanc = onSnapshot(collection(db, 'usuarios', user.uid, 'lancamentos'), (snapshot) => { setLancamentos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LancamentoFinanceiro))); });
        unsubComp = onSnapshot(collection(db, 'usuarios', user.uid, 'compras'), (snapshot) => { setCompras(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Compra))); });
        unsubMidias = onSnapshot(collection(db, 'usuarios', user.uid, 'midias'), (snapshot) => { setMidias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Midia))); });
      } else {
        setIsLogado(false); setEmailUsuario('');
        setPlataformas([]); setProdutos([]); setCustosPadrao([]); setCategorias([]); setCategoriasDespesa([]); setFornecedores([]); setLancamentos([]); setCompras([]); setMidias([]);
        unsubPlat(); unsubProd(); unsubCustos(); unsubCat(); unsubCatDesp(); unsubForn(); unsubLanc(); unsubComp(); unsubMidias();
      }
      setCarregandoAuth(false);
    });

    return () => { unsubscribeAuth(); unsubPlat(); unsubProd(); unsubCustos(); unsubCat(); unsubCatDesp(); unsubForn(); unsubLanc(); unsubComp(); unsubMidias(); };
  }, []);

  const lidarSair = async () => { if (window.confirm("Deseja desconectar?")) await signOut(auth); };

  if (carregandoAuth) return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute w-full h-full border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="text-3xl">🚀</span>
      </div>
      <p className="mt-6 text-blue-400 font-black tracking-widest uppercase text-xs animate-pulse">Iniciando Motor 5.0...</p>
    </div>
  );

  if (!isLogado) return <Login aoLogar={() => setIsLogado(true)} />;

  const faturasAtrasadas = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pendente' && l.dataVencimento < new Date().toISOString().split('T')[0]).length;

  return (
    <div className="min-h-screen bg-[#f4f7fb] flex font-sans text-slate-800 antialiased overflow-hidden selection:bg-blue-500/30">
      
      {/* SIDEBAR ULTRA PREMIUM */}
      <div className={`fixed inset-y-0 left-0 z-[110] w-72 bg-slate-950 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${menuAberto ? 'translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)]' : '-translate-x-full'} border-r border-white/5`}>
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none"></div>

        <div className="flex items-center justify-between p-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-xl font-black text-white">H</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white leading-none">HelpMkp</h1>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-1">Enterprise 5.0</p>
            </div>
          </div>
          <button onClick={() => setMenuAberto(false)} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-slate-400 hover:text-white">✕</button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-6 relative z-10 scrollbar-hide">
          <div className="space-y-1">
            <button onClick={() => { setTelaAtiva('dashboard'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'dashboard' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">📊</span><span>Visão Geral</span>
            </button>
          </div>
          
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Inteligência & Mídia</p>
            <button onClick={() => { setTelaAtiva('calculadora'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'calculadora' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🧮</span><span>Calculadora IA</span>
            </button>
            <button onClick={() => { setTelaAtiva('criador_anuncio'); setMenuAberto(false); }} className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'criador_anuncio' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <div className="flex items-center gap-3"><span className="text-lg">⚡</span><span>Criador Anúncio</span></div>
              <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase font-black tracking-wider">Massa</span>
            </button>
            <button onClick={() => { setTelaAtiva('galeria'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'galeria' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">📸</span><span>Galeria de Fotos</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Estoque & Compras</p>
            <button onClick={() => { setTelaAtiva('produto_cadastro'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'produto_cadastro' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">✨</span><span>Criar Produto</span>
            </button>
            <button onClick={() => { setTelaAtiva('produtos_lista'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'produtos_lista' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">📦</span><span>Meu Estoque</span>
            </button>
            <button onClick={() => { setTelaAtiva('fornecedores'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'fornecedores' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🏭</span><span>Fornecedores & Cargas</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Motor Financeiro</p>
            <button onClick={() => { setTelaAtiva('financeiro'); setMenuAberto(false); }} className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'financeiro' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <div className="flex items-center gap-3"><span className="text-lg">💸</span><span>Fluxo de Caixa</span></div>
              {faturasAtrasadas > 0 && <span className="w-5 h-5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-black rounded-full">{faturasAtrasadas}</span>}
            </button>
          </div>
          
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Infraestrutura</p>
            <button onClick={() => { setTelaAtiva('ajustes_categorias'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'ajustes_categorias' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🗂️</span><span>Pastas & Custos</span>
            </button>
            <button onClick={() => { setTelaAtiva('backups'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'backups' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🛡️</span><span>Segurança & Backup</span>
            </button>
            <button onClick={() => { setTelaAtiva('configuracoes'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'configuracoes' ? 'bg-slate-700/50 text-white border border-slate-600' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">⚙️</span><span>Conexões & Taxas</span>
            </button>
          </div>
        </nav>

        <div className="p-4 relative z-10 border-t border-white/5 pb-20 md:pb-4">
          <button onClick={() => { setTelaAtiva('perfil'); setMenuAberto(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
              <span className="text-blue-400 font-black text-lg">{emailUsuario ? emailUsuario.charAt(0).toUpperCase() : 'U'}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-slate-200 truncate">{emailUsuario || 'Usuário Admin'}</p>
              <p className="text-[10px] font-medium text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online</p>
            </div>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 sm:h-20 px-4 sm:px-6 lg:px-10 flex items-center justify-between z-30 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 sticky top-0">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace Atual</p>
              <h2 className="text-base sm:text-lg font-black text-slate-800 leading-tight">Fábrica & E-commerce</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setTelaAtiva('financeiro')} className="relative w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center text-slate-600">
              🔔{faturasAtrasadas > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>}
            </button>
            <button onClick={lidarSair} className="hidden sm:flex w-10 h-10 bg-rose-50 text-rose-600 rounded-full items-center justify-center font-bold">🚪</button>
          </div>
        </header>

        {/* TASKBAR MOBILE RESPONSIVA */}
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50 flex items-end justify-around px-2 pb-6 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
          <button onClick={() => setTelaAtiva('dashboard')} className={`flex flex-col items-center gap-1 p-2 ${telaAtiva === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <span className="text-xl">📊</span><span className="text-[9px] font-black uppercase">Início</span>
          </button>
          <button onClick={() => setTelaAtiva('criador_anuncio')} className={`flex flex-col items-center gap-1 p-2 ${telaAtiva === 'criador_anuncio' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <span className="text-xl">⚡</span><span className="text-[9px] font-black uppercase">Anúncio AI</span>
          </button>
          <button onClick={() => setTelaAtiva('fornecedores')} className="relative -top-6 flex flex-col items-center gap-1">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${telaAtiva === 'fornecedores' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'}`}><span className="text-2xl">🚚</span></div>
            <span className={`text-[10px] font-black uppercase absolute -bottom-5 ${telaAtiva === 'fornecedores' ? 'text-indigo-600' : 'text-slate-500'}`}>Cargas</span>
          </button>
          <button onClick={() => setTelaAtiva('financeiro')} className={`flex flex-col items-center gap-1 p-2 ${telaAtiva === 'financeiro' ? 'text-emerald-500' : 'text-slate-400'}`}>
            <span className="text-xl">💸</span><span className="text-[9px] font-black uppercase">Caixa</span>
          </button>
          <button onClick={() => setMenuAberto(true)} className="flex flex-col items-center gap-1 p-2 text-slate-400">
            <span className="text-xl">☰</span><span className="text-[9px] font-black uppercase">Menu</span>
          </button>
        </div>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f4f7fb] pb-28 md:pb-0">
          <div className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 md:p-8 lg:p-10">
            {telaAtiva === 'dashboard' && <Dashboard produtos={produtos} plataformas={plataformas} lancamentos={lancamentos} categoriasDespesa={categoriasDespesa} setTelaAtiva={setTelaAtiva} />}
            {telaAtiva === 'calculadora' && <CalculadoraRapida plataformas={plataformas} />}
            {telaAtiva === 'financeiro' && <Financeiro lancamentos={lancamentos} fornecedores={fornecedores} compras={compras} categoriasDespesa={categoriasDespesa} />}
            {telaAtiva === 'fornecedores' && <Fornecedores fornecedores={fornecedores} produtos={produtos} compras={compras} />}
            {(telaAtiva === 'produtos_lista' || telaAtiva === 'produto_cadastro') && <Produtos telaAtiva={telaAtiva} setTelaAtiva={setTelaAtiva} produtos={produtos} plataformas={plataformas} custosPadrao={custosPadrao} categorias={categorias} />}
            {telaAtiva === 'configuracoes' && <Configuracoes plataformas={plataformas} />}
            {telaAtiva === 'ajustes_categorias' && <Custos custosPadrao={custosPadrao} categorias={categorias} categoriasDespesa={categoriasDespesa} />}
            {telaAtiva === 'perfil' && <Perfil />}
            {telaAtiva === 'backups' && <BackupManager produtos={produtos} compras={compras} lancamentos={lancamentos} custosPadrao={custosPadrao} />}
            {telaAtiva === 'criador_kit' && <CriadorKit produtosDisponiveis={produtos} setTelaAtiva={setTelaAtiva} />}
            {telaAtiva === 'galeria' && <GaleriaMidia midias={midias} />}
            
            {/* INJEÇÃO DO NOVO ATIVO NO CORPO DO CORE DE ATIVOS */}
            {telaAtiva === 'criador_anuncio' && <CriadorAnuncio produtos={produtos} plataformas={plataformas} />}
          </div>
        </main>
      </div>
    </div>
  );
}