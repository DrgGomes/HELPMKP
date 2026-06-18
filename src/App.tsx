import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Produto, Plataforma, CustoPadrao, Categoria, Fornecedor, LancamentoFinanceiro, Compra } from './types';
import Login from './telas/Login';
import Dashboard from './telas/Dashboard';
import Configuracoes from './telas/Configuracoes';
import Produtos from './telas/Produtos';
import Perfil from './telas/Perfil';
import CriadorKit from './telas/CriadorKit';
import Custos from './telas/Custos';
import Fornecedores from './telas/Fornecedores';
import Financeiro from './telas/Financeiro';

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
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);

  useEffect(() => {
    let unsubPlat: () => void = () => {}; let unsubProd: () => void = () => {}; let unsubCustos: () => void = () => {};
    let unsubCat: () => void = () => {}; let unsubForn: () => void = () => {}; let unsubLanc: () => void = () => {}; let unsubComp: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLogado(true); setEmailUsuario(user.email || '');

        unsubPlat = onSnapshot(collection(db, 'usuarios', user.uid, 'plataformas'), (snapshot) => { setPlataformas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plataforma))); });
        unsubProd = onSnapshot(collection(db, 'usuarios', user.uid, 'produtos'), (snapshot) => { setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto))); });
        unsubCustos = onSnapshot(collection(db, 'usuarios', user.uid, 'custos_padrao'), (snapshot) => { setCustosPadrao(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustoPadrao))); });
        unsubCat = onSnapshot(collection(db, 'usuarios', user.uid, 'categorias'), (snapshot) => { setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria))); });
        unsubForn = onSnapshot(collection(db, 'usuarios', user.uid, 'fornecedores'), (snapshot) => { setFornecedores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fornecedor))); });
        unsubLanc = onSnapshot(collection(db, 'usuarios', user.uid, 'lancamentos'), (snapshot) => { setLancamentos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LancamentoFinanceiro))); });
        unsubComp = onSnapshot(collection(db, 'usuarios', user.uid, 'compras'), (snapshot) => { setCompras(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Compra))); });
      } else {
        setIsLogado(false); setEmailUsuario('');
        setPlataformas([]); setProdutos([]); setCustosPadrao([]); setCategorias([]); setFornecedores([]); setLancamentos([]); setCompras([]);
        unsubPlat(); unsubProd(); unsubCustos(); unsubCat(); unsubForn(); unsubLanc(); unsubComp();
      }
      setCarregandoAuth(false);
    });

    return () => { unsubscribeAuth(); unsubPlat(); unsubProd(); unsubCustos(); unsubCat(); unsubForn(); unsubLanc(); unsubComp(); };
  }, []);

  const lidarSair = async () => { if (window.confirm("Sair do sistema?")) await signOut(auth); };

  if (carregandoAuth) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-500/30 border-t-blue-500"></div></div>;
  if (!isLogado) return <Login aoLogar={() => setIsLogado(true)} />;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row font-sans text-slate-800 antialiased">
      <div className="md:hidden bg-slate-950 text-white p-4 flex justify-between items-center z-20"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div><h1 className="text-xl font-black text-white">HelpMkp</h1></div><button onClick={() => setMenuAberto(!menuAberto)} className="p-2 text-slate-400">☰</button></div>
      <div className={`${menuAberto ? 'block' : 'hidden'} md:flex w-full md:w-64 bg-slate-950 text-white p-5 flex-col absolute md:relative z-10 min-h-screen md:min-h-0 border-r border-slate-900 shadow-xl overflow-y-auto`}>
        <div className="flex items-center gap-2.5 mb-9 px-3 hidden md:flex"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div><h1 className="text-2xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">HelpMkp</h1></div>
        <nav className="space-y-1 flex-1">
          <button onClick={() => { setTelaAtiva('dashboard'); setMenuAberto(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${telaAtiva === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900'}`}><span>📊</span> Dashboard</button>
          <div className="pt-6 pb-2"><p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Estoque & Vendas</p></div>
          <button onClick={() => { setTelaAtiva('financeiro'); setMenuAberto(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${telaAtiva === 'financeiro' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900'}`}><span>💰</span> Fluxo de Caixa</button>
          <button onClick={() => { setTelaAtiva('fornecedores'); setMenuAberto(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${telaAtiva === 'fornecedores' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900'}`}><span>🚚</span> Compras & Entradas</button>
          <button onClick={() => { setTelaAtiva('produto_cadastro'); setMenuAberto(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${telaAtiva === 'produto_cadastro' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900'}`}><span>➕</span> Cadastrar Produto</button>
          <button onClick={() => { setTelaAtiva('produtos_lista'); setMenuAberto(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${telaAtiva === 'produtos_lista' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900'}`}><span>📦</span> Meus Produtos</button>
          <div className="pt-6 pb-2"><p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Ajustes Globais</p></div>
          <button onClick={() => { setTelaAtiva('ajustes_categorias'); setMenuAberto(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${telaAtiva === 'ajustes_categorias' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900'}`}><span>🗂️</span> Ajustes & Categorias</button>
          <button onClick={() => { setTelaAtiva('configuracoes'); setMenuAberto(false); }} className={`w-full text-left py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${telaAtiva === 'configuracoes' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900'}`}><span>⚙️</span> Configurar Taxas</button>
        </nav>
        <div className="pt-4 border-t border-slate-900 mt-auto space-y-2">
          <button onClick={() => { setTelaAtiva('perfil'); setMenuAberto(false); }} className={`w-full p-2.5 rounded-xl transition-all flex items-center gap-3 text-left border ${telaAtiva === 'perfil' ? 'bg-slate-900 border-slate-800 text-white' : 'border-transparent text-slate-400 hover:bg-slate-900/60'}`}><div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-blue-400 border border-slate-700">{emailUsuario ? emailUsuario.charAt(0).toUpperCase() : 'U'}</div><div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-200 truncate">{emailUsuario || 'Usuário'}</p><p className="text-[10px] text-slate-500 font-semibold truncate">Meu perfil</p></div></button>
          <button onClick={lidarSair} className="w-full py-2.5 px-4 bg-slate-900/50 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 border border-slate-900 hover:border-rose-900/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"><span>🚪</span> Sair</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-50/50">
        <div className="max-w-7xl mx-auto w-full p-5 md:p-8 lg:p-10">
          
          {/* ATUALIZADO: Passando setTelaAtiva pro Dashboard */}
          {telaAtiva === 'dashboard' && <Dashboard produtos={produtos} plataformas={plataformas} lancamentos={lancamentos} setTelaAtiva={setTelaAtiva} />}
          
          {telaAtiva === 'financeiro' && <Financeiro lancamentos={lancamentos} fornecedores={fornecedores} compras={compras} />}
          {telaAtiva === 'fornecedores' && <Fornecedores fornecedores={fornecedores} produtos={produtos} compras={compras} />}
          {(telaAtiva === 'produtos_lista' || telaAtiva === 'produto_cadastro') && <Produtos telaAtiva={telaAtiva} setTelaAtiva={setTelaAtiva} produtos={produtos} plataformas={plataformas} custosPadrao={custosPadrao} categorias={categorias} />}
          {telaAtiva === 'configuracoes' && <Configuracoes plataformas={plataformas} />}
          {telaAtiva === 'ajustes_categorias' && <Custos custosPadrao={custosPadrao} categorias={categorias} />}
          {telaAtiva === 'perfil' && <Perfil />}
          {telaAtiva === 'criador_kit' && <CriadorKit produtosDisponiveis={produtos} setTelaAtiva={setTelaAtiva} />}
        </div>
      </div>
    </div>
  );
}