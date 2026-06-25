import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Produto, Plataforma, CustoPadrao, Categoria, CategoriaDespesa, Fornecedor, LancamentoFinanceiro, Compra } from './types';
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

  useEffect(() => {
    let unsubPlat: () => void = () => {}; let unsubProd: () => void = () => {}; let unsubCustos: () => void = () => {};
    let unsubCat: () => void = () => {}; let unsubCatDesp: () => void = () => {}; let unsubForn: () => void = () => {}; 
    let unsubLanc: () => void = () => {}; let unsubComp: () => void = () => {};

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
      } else {
        setIsLogado(false); setEmailUsuario('');
        setPlataformas([]); setProdutos([]); setCustosPadrao([]); setCategorias([]); setCategoriasDespesa([]); setFornecedores([]); setLancamentos([]); setCompras([]);
        unsubPlat(); unsubProd(); unsubCustos(); unsubCat(); unsubCatDesp(); unsubForn(); unsubLanc(); unsubComp();
      }
      setCarregandoAuth(false);
    });

    return () => { unsubscribeAuth(); unsubPlat(); unsubProd(); unsubCustos(); unsubCat(); unsubCatDesp(); unsubForn(); unsubLanc(); unsubComp(); };
  }, []);

  const lidarSair = async () => { if (window.confirm("Deseja desconectar da sua sessão segura?")) await signOut(auth); };

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
      
      {/* SIDEBAR ULTRA PREMIUM (VERSÃO 5.0) */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${menuAberto ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} border-r border-white/5`}>
        
        {/* Efeito de Vidro e Brilho */}
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
          <button onClick={() => setMenuAberto(false)} className="md:hidden text-slate-400 hover:text-white">✕</button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-6 relative z-10 scrollbar-hide">
          
          <div className="space-y-1">
            <button onClick={() => { setTelaAtiva('dashboard'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'dashboard' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className={`text-lg transition-transform duration-300 ${telaAtiva === 'dashboard' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-hover:scale-110'}`}>📊</span>
              <span>Visão Geral</span>
            </button>
          </div>
          
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Inteligência & Vendas</p>
            <button onClick={() => { setTelaAtiva('calculadora'); setMenuAberto(false); }} className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'calculadora' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <div className="flex items-center gap-3"><span className="text-lg group-hover:scale-110 transition-transform">🧮</span><span>Calculadora IA</span></div>
              <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase font-black tracking-wider">Novo</span>
            </button>
            <button onClick={() => { setTelaAtiva('produto_cadastro'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'produto_cadastro' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg group-hover:scale-110 transition-transform">✨</span><span>Criar Produto</span>
            </button>
            <button onClick={() => { setTelaAtiva('produtos_lista'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'produtos_lista' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg group-hover:scale-110 transition-transform">📦</span><span>Meu Estoque</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Motor Financeiro</p>
            <button onClick={() => { setTelaAtiva('financeiro'); setMenuAberto(false); }} className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'financeiro' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <div className="flex items-center gap-3"><span className="text-lg group-hover:scale-110 transition-transform">💸</span><span>Fluxo de Caixa</span></div>
              {faturasAtrasadas > 0 && <span className="w-5 h-5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-black rounded-full animate-pulse">{faturasAtrasadas}</span>}
            </button>
            <button onClick={() => { setTelaAtiva('fornecedores'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'fornecedores' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg group-hover:scale-110 transition-transform">🏭</span><span>Fornecedores</span>
            </button>
          </div>
          
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Infraestrutura</p>
            <button onClick={() => { setTelaAtiva('ajustes_categorias'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'ajustes_categorias' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg group-hover:scale-110 transition-transform">🗂️</span><span>Pastas & Custos</span>
            </button>
            <button onClick={() => { setTelaAtiva('configuracoes'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'configuracoes' ? 'bg-slate-700/50 text-white border border-slate-600' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg group-hover:scale-110 transition-transform">⚙️</span><span>Conexões & Taxas</span>
            </button>
          </div>
        </nav>

        {/* Perfil Inferior Elegante */}
        <div className="p-4 relative z-10 border-t border-white/5">
          <button onClick={() => { setTelaAtiva('perfil'); setMenuAberto(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700 group-hover:border-blue-500 transition-colors overflow-hidden">
              <span className="text-blue-400 font-black text-lg">{emailUsuario ? emailUsuario.charAt(0).toUpperCase() : 'U'}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-slate-200 truncate">{emailUsuario || 'Usuário Admin'}</p>
              <p className="text-[10px] font-medium text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sistema Online</p>
            </div>
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL COM TOPBAR 5.0 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Overlay Mobile */}
        {menuAberto && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setMenuAberto(false)}></div>}

        {/* TopBar Flutuante (Novo) */}
        <header className="h-20 px-6 lg:px-10 flex items-center justify-between z-30 bg-white/50 backdrop-blur-md border-b border-slate-200/50 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMenuAberto(true)} className="md:hidden w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-600 border border-slate-200">☰</button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace Atual</p>
              <h2 className="text-lg font-black text-slate-800 leading-tight">Fábrica & E-commerce</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden md:flex bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-600">Sincronizado</span>
            </div>
            <button onClick={() => setTelaAtiva('financeiro')} className="relative w-10 h-10 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 transition-colors">
              🔔
              {faturasAtrasadas > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>}
            </button>
            <button onClick={lidarSair} className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center font-bold hover:bg-rose-500 hover:text-white transition-colors tooltip-trigger" title="Desconectar">
              🚪
            </button>
          </div>
        </header>

        {/* Cointainer das Telas (Mais espaço respirável) */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f4f7fb]">
          <div className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 md:p-8 lg:p-10 pb-32">
            {telaAtiva === 'dashboard' && <Dashboard produtos={produtos} plataformas={plataformas} lancamentos={lancamentos} categoriasDespesa={categoriasDespesa} setTelaAtiva={setTelaAtiva} />}
            {telaAtiva === 'calculadora' && <CalculadoraRapida plataformas={plataformas} />}
            {telaAtiva === 'financeiro' && <Financeiro lancamentos={lancamentos} fornecedores={fornecedores} compras={compras} categoriasDespesa={categoriasDespesa} />}
            {telaAtiva === 'fornecedores' && <Fornecedores fornecedores={fornecedores} produtos={produtos} compras={compras} />}
            {(telaAtiva === 'produtos_lista' || telaAtiva === 'produto_cadastro') && <Produtos telaAtiva={telaAtiva} setTelaAtiva={setTelaAtiva} produtos={produtos} plataformas={plataformas} custosPadrao={custosPadrao} categorias={categorias} />}
            {telaAtiva === 'configuracoes' && <Configuracoes plataformas={plataformas} />}
            {telaAtiva === 'ajustes_categorias' && <Custos custosPadrao={custosPadrao} categorias={categorias} categoriasDespesa={categoriasDespesa} />}
            {telaAtiva === 'perfil' && <Perfil />}
            {telaAtiva === 'criador_kit' && <CriadorKit produtosDisponiveis={produtos} setTelaAtiva={setTelaAtiva} />}
          </div>
        </main>
      </div>
    </div>
  );
}