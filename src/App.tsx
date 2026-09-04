import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Produto, Plataforma, CustoPadrao, Categoria, CategoriaDespesa, Fornecedor, LancamentoFinanceiro, Compra, Midia } from './types';
import Login from './telas/Login';
import Dashboard from './telas/Dashboard';
import Configuracoes from './telas/Configuracoes';
import { Produtos } from './telas/Produtos';
import Perfil from './telas/Perfil';
import CriadorKit from './telas/CriadorKit';
import Custos from './telas/Custos';
import Fornecedores from './telas/Fornecedores';
import Financeiro from './telas/Financeiro';
import CalculadoraRapida from './telas/CalculadoraRapida';
import BackupManager from './telas/BackupManager';
import GaleriaMidia from './telas/GaleriaMidia';
import CriadorAnuncio from './telas/CriadorAnuncio';

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

  const carregarDados = useCallback(async (userId: string) => {
    const [platRes, prodRes, custosRes, catRes, catDespRes, fornRes, lancRes, compRes, midRes] = await Promise.all([
      supabase.from('plataformas').select('*').eq('user_id', userId),
      supabase.from('produtos').select('*').eq('user_id', userId),
      supabase.from('custos_padrao').select('*').eq('user_id', userId),
      supabase.from('categorias').select('*').eq('user_id', userId),
      supabase.from('categorias_despesas').select('*').eq('user_id', userId),
      supabase.from('fornecedores').select('*').eq('user_id', userId),
      supabase.from('lancamentos').select('*').eq('user_id', userId),
      supabase.from('compras').select('*').eq('user_id', userId),
      supabase.from('midias').select('*').eq('user_id', userId),
    ]);

    if (platRes.data) setPlataformas(platRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, comissao: Number(i.comissao || 0), comissaoAfiliado: Number(i.comissao_afiliado || 0),
      taxaFixa: Number(i.taxa_fixa || 0), freteFixo: Number(i.frete_fixo || 0), logo: i.logo || '',
      cor: i.cor, textoCor: i.texto_cor,
    })));
    if (prodRes.data) setProdutos(prodRes.data.map((i: any) => ({
      id: i.id, foto: i.foto || '', titulo: i.titulo, codigo: i.codigo, categoria: i.categoria,
      custoAds: Number(i.custo_ads || 0), custoBase: Number(i.custo_base || 0), custosAdicionais: i.custos_adicionais || [],
      custoTotal: Number(i.custo_total || 0), tipoLucro: i.tipo_lucro, valorLucro: Number(i.valor_lucro || 0),
      isKit: i.is_kit, estoque: Number(i.estoque || 0), estoqueMinimo: Number(i.estoque_minimo || 0),
    })));
    if (custosRes.data) setCustosPadrao(custosRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, valor: Number(i.valor || 0), icone: i.icone || '📦',
    })));
    if (catRes.data) setCategorias(catRes.data.map((i: any) => ({ id: i.id, nome: i.nome })));
    if (catDespRes.data) setCategoriasDespesa(catDespRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, cor: i.cor || '#3b82f6',
    })));
    if (fornRes.data) setFornecedores(fornRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, contato: i.contato || '', categoriaInsumo: i.categoria_insumo || '',
    })));
    if (lancRes.data) setLancamentos(lancRes.data.map((i: any) => ({
      id: i.id, tipo: i.tipo, descricao: i.descricao, valor: Number(i.valor || 0),
      dataVencimento: i.data_vencimento, dataLancamento: i.data_lancamento, status: i.status,
      categoria: i.categoria || '', fornecedorId: i.fornecedor_id, compraId: i.compra_id,
      recorrente: i.recorrente, grupoRecorrenciaId: i.grupo_recorrencia_id,
    })));
    if (compRes.data) setCompras(compRes.data.map((i: any) => ({
      id: i.id, codigoOrdem: i.codigo_ordem, statusChegada: i.status_chegada,
      fornecedorId: i.fornecedor_id, fornecedorNome: i.fornecedor_nome, dataCompra: i.data_compra,
      dataPagamento: i.data_pagamento, numeroVale: i.numero_vale, itens: i.itens || [],
      valorTotal: Number(i.valor_total || 0), statusPagamento: i.status_pagamento, faturaGerada: i.fatura_gerada,
    })));
    if (midRes.data) setMidias(midRes.data.map((i: any) => ({
      id: i.id, titulo: i.titulo || '', url: i.url, url_thumb: i.url_thumb,
      album: i.album || '', dataCriacao: i.data_criacao || i.created_at,
    })));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsLogado(true);
        setEmailUsuario(session.user.email || '');
        await carregarDados(session.user.id);
      } else {
        setIsLogado(false);
        setEmailUsuario('');
        setPlataformas([]); setProdutos([]); setCustosPadrao([]); setCategorias([]);
        setCategoriasDespesa([]); setFornecedores([]); setLancamentos([]); setCompras([]); setMidias([]);
      }
      setCarregandoAuth(false);
    });

    return () => { subscription.unsubscribe(); };
  }, [carregarDados]);

  const lidarSair = async () => {
    if (window.confirm("Deseja desconectar?")) {
      await supabase.auth.signOut();
    }
  };

  if (carregandoAuth) return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute w-full h-full border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="text-3xl">🚀</span>
      </div>
    </div>
  );

  if (!isLogado) return <Login aoLogar={() => setIsLogado(true)} />;

  const faturasAtrasadas = lancamentos.filter(l => l.tipo === 'despesa' && l.status === 'pendente' && l.dataVencimento < new Date().toISOString().split('T')[0]).length;

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans text-slate-800 antialiased overflow-hidden selection:bg-blue-500/30">

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-[110] w-72 bg-slate-950 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${menuAberto ? 'translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.5)]' : '-translate-x-full'} border-r border-white/5`}>
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none"></div>

        <div className="flex items-center justify-between p-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-black text-lg">H</span>
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
            <p className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Principal</p>
            <button onClick={() => { setTelaAtiva('dashboard'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'dashboard' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">📊</span><span>Dashboard</span>
            </button>
            <button onClick={() => { setTelaAtiva('calculadora'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'calculadora' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🧮</span><span>Calculadora</span>
            </button>
            <button onClick={() => { setTelaAtiva('criador_anuncio'); setMenuAberto(false); }} className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'criador_anuncio' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <div className="flex items-center gap-3"><span className="text-lg">🤖</span><span>AI Copilot</span></div>
              <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">NEW</span>
            </button>
            <button onClick={() => { setTelaAtiva('galeria'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'galeria' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🖼️</span><span>Galeria</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Catálogo</p>
            <button onClick={() => { setTelaAtiva('produto_cadastro'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'produto_cadastro' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">➕</span><span>Novo Produto</span>
            </button>
            <button onClick={() => { setTelaAtiva('produtos_lista'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'produtos_lista' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">📦</span><span>Meus Produtos</span>
            </button>
            <button onClick={() => { setTelaAtiva('criador_kit'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'criador_kit' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🎯</span><span>Criar Kit</span>
            </button>
          </div>

          <div className="space-y-1">
            <p className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Operação</p>
            <button onClick={() => { setTelaAtiva('financeiro'); setMenuAberto(false); }} className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'financeiro' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <div className="flex items-center gap-3"><span className="text-lg">💸</span><span>Fluxo de Caixa</span></div>
              {faturasAtrasadas > 0 && <span className="w-5 h-5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-black rounded-full">{faturasAtrasadas}</span>}
            </button>
            <button onClick={() => { setTelaAtiva('fornecedores'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'fornecedores' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🚚</span><span>Fornecedores</span>
            </button>
            <button onClick={() => { setTelaAtiva('ajustes_categorias'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'ajustes_categorias' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">⚙️</span><span>Ajustes</span>
            </button>
            <button onClick={() => { setTelaAtiva('configuracoes'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'configuracoes' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🔧</span><span>Plataformas</span>
            </button>
            <button onClick={() => { setTelaAtiva('backups'); setMenuAberto(false); }} className={`w-full group flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${telaAtiva === 'backups' ? 'bg-white/10 text-white border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span className="text-lg">🛡️</span><span>Backups</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/5">
          <button onClick={() => { setTelaAtiva('perfil'); setMenuAberto(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
              <span className="text-sm font-black text-white">{emailUsuario.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white truncate">{emailUsuario}</p>
              <p className="text-[10px] font-medium text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online</p>
            </div>
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-50">
          <button onClick={() => setMenuAberto(true)} className="md:hidden w-9 h-9 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-slate-600">☰</button>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setTelaAtiva('financeiro')} className="relative w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center text-slate-600">
              🔔{faturasAtrasadas > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>}
            </button>
            <button onClick={lidarSair} className="hidden sm:flex w-10 h-10 bg-rose-50 text-rose-600 rounded-full items-center justify-center font-bold">🚪</button>
          </div>
        </header>

        {/* TASKBAR MOBILE */}
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50 flex items-end justify-around px-2 pb-6 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
          <button onClick={() => { setTelaAtiva('dashboard'); }} className="flex flex-col items-center gap-1 p-2 text-slate-400">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${telaAtiva === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'}`}><span className="text-2xl">📊</span></div>
          </button>
          <button onClick={() => { setTelaAtiva('produtos_lista'); }} className="flex flex-col items-center gap-1 p-2 text-slate-400">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${telaAtiva === 'produtos_lista' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'}`}><span className="text-2xl">📦</span></div>
          </button>
          <button onClick={() => setMenuAberto(true)} className="flex flex-col items-center gap-1 p-2 text-slate-400">
            <span className="text-xl">☰</span><span className="text-[9px] font-black uppercase">Menu</span>
          </button>
          <button onClick={() => { setTelaAtiva('fornecedores'); }} className="flex flex-col items-center gap-1 p-2 text-slate-400">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${telaAtiva === 'fornecedores' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'}`}><span className="text-2xl">🚚</span></div>
          </button>
          <button onClick={() => { setTelaAtiva('financeiro'); }} className="flex flex-col items-center gap-1 p-2 text-slate-400">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${telaAtiva === 'financeiro' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}><span className="text-2xl">💸</span></div>
          </button>
        </div>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f4f7fb] pb-28 md:pb-0">
          <div className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 md:p-8 lg:p-10">
            {telaAtiva === 'dashboard' && <Dashboard produtos={produtos} plataformas={plataformas} lancamentos={lancamentos} categoriasDespesa={categoriasDespesa} setTelaAtiva={setTelaAtiva} />}
            {telaAtiva === 'calculadora' && <CalculadoraRapida plataformas={plataformas} />}
            {telaAtiva === 'financeiro' && <Financeiro lancamentos={lancamentos} fornecedores={fornecedores} compras={compras} categoriasDespesa={categoriasDespesa} />}
            {telaAtiva === 'fornecedores' && <Fornecedores fornecedores={fornecedores} produtos={produtos} compras={compras} />}
            {(telaAtiva === 'produtos_lista' || telaAtiva === 'produto_cadastro') && <Produtos custosPadrao={custosPadrao} categorias={categorias} />}
            {telaAtiva === 'configuracoes' && <Configuracoes plataformas={plataformas} />}
            {telaAtiva === 'ajustes_categorias' && <Custos custosPadrao={custosPadrao} categorias={categorias} categoriasDespesa={categoriasDespesa} setCustosPadrao={setCustosPadrao} setCategorias={setCategorias} setCategoriasDespesa={setCategoriasDespesa} />}
            {telaAtiva === 'perfil' && <Perfil />}
            {telaAtiva === 'backups' && <BackupManager produtos={produtos} compras={compras} lancamentos={lancamentos} custosPadrao={custosPadrao} />}
            {telaAtiva === 'criador_kit' && <CriadorKit produtosDisponiveis={produtos} setTelaAtiva={setTelaAtiva} />}
            {telaAtiva === 'galeria' && <GaleriaMidia midias={midias} />}
            {telaAtiva === 'criador_anuncio' && <CriadorAnuncio produtos={produtos} plataformas={plataformas} />}
          </div>
        </main>
      </div>
    </div>
  );
}