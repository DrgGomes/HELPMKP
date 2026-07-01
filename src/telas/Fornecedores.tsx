import React, { useState, useMemo } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Fornecedor, Produto, Compra, ItemCompra } from '../types';

interface FornecedoresProps {
  fornecedores: Fornecedor[];
  produtos: Produto[];
  compras: Compra[];
}

export default function Fornecedores({ fornecedores, produtos, compras }: FornecedoresProps) {
  const [abaAtiva, setAbaAtiva] = useState<'gerar' | 'receber' | 'lista'>('receber');

  // --- ESTADOS PARA ABA: GERAR ORDEM ---
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [numeroVale, setNumeroVale] = useState('');
  const [itensCarrinho, setItensCarrinho] = useState<ItemCompra[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [quantidadeDesejada, setQuantidadeDesejada] = useState(1);
  const [custoUnitario, setCustoUnitario] = useState('');
  const [processandoOrdem, setProcessandoOrdem] = useState(false);

  // --- ESTADOS PARA ABA: RECEBER ---
  const [codigoBip, setCodigoBip] = useState('');
  const [processandoRecebimento, setProcessandoRecebimento] = useState(false);

  // --- ESTADOS PARA ABA: LISTA FORNECEDORES ---
  const [idFornecedorEdicao, setIdFornecedorEdicao] = useState<string | null>(null);
  const [nomeForn, setNomeForn] = useState('');
  const [contatoForn, setContatoForn] = useState('');
  const [categoriaForn, setCategoriaForn] = useState('');

  // LÓGICA: GERAR ORDEM DE COMPRA
  const adicionarAoCarrinho = () => {
    if (!produtoSelecionado || quantidadeDesejada <= 0 || !custoUnitario) return;
    const prod = produtos.find(p => p.id === produtoSelecionado);
    if (!prod) return;

    const custo = parseFloat(custoUnitario);
    const novoItem: ItemCompra = {
      produtoId: prod.id,
      nome: prod.titulo,
      quantidade: quantidadeDesejada,
      custoUnitario: custo,
      subtotal: quantidadeDesejada * custo
    };

    setItensCarrinho([...itensCarrinho, novoItem]);
    setProdutoSelecionado('');
    setQuantidadeDesejada(1);
    setCustoUnitario('');
  };

  const removerDoCarrinho = (index: number) => {
    const novos = [...itensCarrinho];
    novos.splice(index, 1);
    setItensCarrinho(novos);
  };

  const valorTotalOrdem = itensCarrinho.reduce((acc, item) => acc + item.subtotal, 0);

  const finalizarOrdem = async () => {
    if (!fornecedorSelecionado || itensCarrinho.length === 0) return alert("Selecione um fornecedor e adicione itens.");
    const userId = auth.currentUser?.uid; if (!userId) return;

    const forn = fornecedores.find(f => f.id === fornecedorSelecionado);
    if (!forn) return;

    setProcessandoOrdem(true);
    try {
      const codigoGerado = `ORD-${Date.now()}`;
      
      // 1. Cria a Ordem de Compra
      const compraRef = await addDoc(collection(db, 'usuarios', userId, 'compras'), {
        codigoOrdem: codigoGerado,
        statusChegada: 'aguardando',
        fornecedorId: forn.id,
        fornecedorNome: forn.nome,
        dataCompra: dataEmissao,
        dataPagamento: dataVencimento,
        numeroVale: numeroVale,
        itens: itensCarrinho,
        valorTotal: valorTotalOrdem,
        statusPagamento: 'pendente'
      });

      // 2. Injeta automaticamente a fatura no Fluxo de Caixa Mestre
      await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), {
        tipo: 'despesa',
        descricao: `Fatura ${numeroVale ? `(Vale: ${numeroVale})` : codigoGerado} - ${forn.nome}`,
        valor: valorTotalOrdem,
        dataVencimento: dataVencimento || dataEmissao,
        dataLancamento: dataEmissao,
        status: 'pendente',
        categoria: 'Compras de Estoque',
        fornecedorId: forn.id,
        compraId: compraRef.id
      });

      alert(`✅ Ordem ${codigoGerado} gerada com sucesso e fatura lançada no financeiro!`);
      
      // Limpar form
      setItensCarrinho([]); setFornecedorSelecionado(''); setNumeroVale('');
      setDataEmissao(new Date().toISOString().split('T')[0]);
      setDataVencimento(new Date().toISOString().split('T')[0]);
      setAbaAtiva('receber');

    } catch (e) {
      console.error(e);
      alert("Falha ao gerar ordem.");
    }
    setProcessandoOrdem(false);
  };

  // LÓGICA: RECEBER MERCADORIA E ATUALIZAR ESTOQUE
  const comprasAguardando = useMemo(() => {
    return compras.filter(c => c.statusChegada === 'aguardando').sort((a, b) => new Date(b.dataCompra).getTime() - new Date(a.dataCompra).getTime());
  }, [compras]);

  const registrarRecebimento = async (compra: Compra) => {
    const userId = auth.currentUser?.uid; if (!userId) return;
    
    if (!window.confirm(`Confirmar entrada no estoque da ordem ${compra.codigoOrdem}?`)) return;

    setProcessandoRecebimento(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Muda o status da ordem para recebido
      const compraRef = doc(db, 'usuarios', userId, 'compras', compra.id);
      batch.update(compraRef, { statusChegada: 'recebido' });

      // 2. Soma as quantidades no estoque real dos produtos
      for (const item of compra.itens) {
        const prodExistente = produtos.find(p => p.id === item.produtoId);
        if (prodExistente) {
          const prodRef = doc(db, 'usuarios', userId, 'produtos', prodExistente.id);
          const novoEstoque = (prodExistente.estoque || 0) + item.quantidade;
          batch.update(prodRef, { estoque: novoEstoque });
        }
      }

      await batch.commit();
      alert(`📦 Sucesso! Estoque atualizado com os itens da ${compra.codigoOrdem}.`);
      setCodigoBip('');
    } catch (e) {
      console.error(e);
      alert("Erro ao processar recebimento.");
    }
    setProcessandoRecebimento(false);
  };

  const lidarBip = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const ordemEncontrada = comprasAguardando.find(c => c.codigoOrdem === codigoBip.trim());
      if (ordemEncontrada) {
        registrarRecebimento(ordemEncontrada);
      } else {
        alert("Ordem não encontrada ou já recebida.");
      }
    }
  };

  // LÓGICA: FORNECEDORES CRUD
  const salvarFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeForn) return;
    const userId = auth.currentUser?.uid; if (!userId) return;

    const dados = { nome: nomeForn, contato: contatoForn, categoriaInsumo: categoriaForn };
    if (idFornecedorEdicao) {
      await updateDoc(doc(db, 'usuarios', userId, 'fornecedores', idFornecedorEdicao), dados);
    } else {
      await addDoc(collection(db, 'usuarios', userId, 'fornecedores'), dados);
    }
    setIdFornecedorEdicao(null); setNomeForn(''); setContatoForn(''); setCategoriaForn('');
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-8 pb-32">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span>🚚</span> Compras & Entradas
          </h2>
          <p className="text-slate-500 font-medium mt-1">Gere ordens de compra e dê entrada no estoque bipando o código ou clicando nos pendentes.</p>
        </div>
      </header>

      {/* ABAS MODERNAS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px">
        <button onClick={() => setAbaAtiva('gerar')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'gerar' ? 'bg-slate-900 text-white border-t-2 border-slate-900 shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>
          <span>🛒</span> 1. Gerar Ordem
        </button>
        <button onClick={() => setAbaAtiva('receber')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'receber' ? 'bg-emerald-600 text-white border-t-2 border-emerald-500 shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>
          <span>⚡</span> 2. Receber Mercadoria
        </button>
        <button onClick={() => setAbaAtiva('lista')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'lista' ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>
          <span>📋</span> Fornecedores
        </button>
      </div>

      {/* ABA 1: GERAR ORDEM */}
      {abaAtiva === 'gerar' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start animate-fade-in">
          
          <div className="xl:col-span-5 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-black text-xl text-slate-800 tracking-tight mb-6 border-b border-slate-100 pb-4">Nova Ordem de Compra</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fornecedor / Fábrica</label>
                <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                  <option value="">Selecionar Fábrica...</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data de Emissão</label>
                  <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vencimento da Fatura</label>
                  <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Número do Vale / NF (Opcional)</label>
                <input type="text" placeholder="Ex: VALE-1234" value={numeroVale} onChange={(e) => setNumeroVale(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 font-mono text-slate-700" />
              </div>

              <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 mt-6 space-y-4">
                <h4 className="font-black text-indigo-900 text-sm">Adicionar Itens</h4>
                <div>
                  <select value={produtoSelecionado} onChange={(e) => {
                    setProdutoSelecionado(e.target.value);
                    const p = produtos.find(x => x.id === e.target.value);
                    if (p) setCustoUnitario(p.custoBase.toString());
                  }} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
                    <option value="">Escolher Produto...</option>
                    {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="w-1/3">
                    <input type="number" min="1" placeholder="Qtd" value={quantidadeDesejada} onChange={(e) => setQuantidadeDesejada(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-black text-indigo-700 outline-none text-center" />
                  </div>
                  <div className="w-2/3 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">R$</span>
                    <input type="number" step="0.01" placeholder="Custo Un." value={custoUnitario} onChange={(e) => setCustoUnitario(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-black text-slate-700 outline-none" />
                  </div>
                </div>
                <button type="button" onClick={adicionarAoCarrinho} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors">
                  + Incluir na Ordem
                </button>
              </div>
            </div>
          </div>

          <div className="xl:col-span-7 space-y-6">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-white font-black text-xl flex items-center gap-2">🛒 Resumo da Carga</h3>
                <span className="px-3 py-1 bg-slate-800 text-slate-300 font-mono text-xs rounded-lg border border-slate-700">{itensCarrinho.length} itens</span>
              </div>

              <div className="bg-[#0b1120] rounded-2xl border border-slate-800 min-h-[250px] p-4 relative z-10">
                {itensCarrinho.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 py-10">
                    <span className="text-4xl mb-2">📥</span>
                    <p className="font-mono text-sm uppercase tracking-widest">Carrinho Vazio</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {itensCarrinho.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-900/80 p-4 rounded-xl border border-slate-800 group hover:border-slate-600 transition-colors">
                        <div>
                          <p className="font-bold text-slate-200 text-sm">{item.nome}</p>
                          <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-widest">{item.quantidade} un x R$ {item.custoUnitario.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono font-black text-emerald-400 text-lg tracking-tight">R$ {item.subtotal.toFixed(2)}</span>
                          <button onClick={() => removerDoCarrinho(idx)} className="text-slate-600 hover:text-rose-500 transition-colors">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-6 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Investir</p>
                  <p className="text-4xl font-black text-white font-mono tracking-tight">R$ {valorTotalOrdem.toFixed(2)}</p>
                </div>
                <button onClick={finalizarOrdem} disabled={processandoOrdem || itensCarrinho.length === 0} className="w-full sm:w-auto px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:grayscale">
                  {processandoOrdem ? 'Gerando...' : 'Finalizar Ordem'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: RECEBER MERCADORIA E ATUALIZAR ESTOQUE */}
      {abaAtiva === 'receber' && (
        <div className="animate-fade-in space-y-10">
          
          {/* O LEITOR DE SCANNER HACKER */}
          <div className="bg-[#064e3b] rounded-[2.5rem] p-10 text-center shadow-xl border border-emerald-900/50 relative overflow-hidden max-w-4xl mx-auto">
            <div className="absolute top-0 right-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <span className="text-6xl block mb-4 relative z-10 drop-shadow-lg">🎯</span>
            <h3 className="text-3xl font-black text-white mb-2 relative z-10 tracking-tight">Bipe a Ordem de Compra</h3>
            <p className="text-emerald-300 font-medium mb-8 relative z-10">Com o caminhão na porta, passe o leitor de código de barras ou digite o código da ordem.</p>
            
            <div className="max-w-xl mx-auto relative z-10">
              <input 
                type="text" 
                placeholder="Ex: ORD-171829" 
                value={codigoBip} 
                onChange={(e) => setCodigoBip(e.target.value)}
                onKeyDown={lidarBip}
                className="w-full bg-[#022c22] border-2 border-emerald-500/50 text-emerald-400 text-center text-3xl font-black font-mono py-6 rounded-2xl shadow-inner focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-emerald-900/50"
              />
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-4">Aperte Enter para processar a carga</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🚚</span>
              <h3 className="text-xl font-black text-slate-800">Ordens Aguardando Chegada</h3>
            </div>
            
            {comprasAguardando.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                <span className="text-5xl grayscale opacity-50 block mb-4">🛣️</span>
                <p className="text-slate-500 font-bold text-lg">Nenhum caminhão a caminho.</p>
                <p className="text-slate-400 text-sm mt-1">Todas as ordens foram recebidas ou não há pedidos na fábrica.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {comprasAguardando.map(compra => (
                  <div key={compra.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-400"></div>
                    
                    <div className="flex justify-between items-start mb-5">
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm border border-amber-200">NO CAMINHÃO</span>
                      <span className="text-slate-400 font-mono text-xs font-bold">{compra.codigoOrdem}</span>
                    </div>

                    <h3 className="text-lg font-black text-slate-800 mb-5">{compra.fornecedorNome}</h3>
                    
                    {/* AQUI ESTÁ A LISTA DE DATAS E VALE (FORMATO TERMINAL) */}
                    <div className="space-y-3 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] bg-slate-200 px-1.5 py-0.5 rounded">EMIT</span>
                        <span className="font-mono font-bold text-slate-700">{compra.dataCompra.split('-').reverse().join('/')}</span>
                      </div>
                      
                      {compra.dataPagamento && (
                        <div className="flex justify-between items-center text-xs">
                          <span className={`font-black uppercase tracking-widest text-[9px] px-1.5 py-0.5 rounded ${compra.dataPagamento < new Date().toISOString().split('T')[0] ? 'bg-rose-500 text-white shadow-[0_0_8px_rgba(225,29,72,0.5)]' : 'bg-slate-200 text-slate-400'}`}>VENC</span>
                          <span className={`font-mono font-bold ${compra.dataPagamento < new Date().toISOString().split('T')[0] ? 'text-rose-600' : 'text-slate-700'}`}>{compra.dataPagamento.split('-').reverse().join('/')}</span>
                        </div>
                      )}
                      
                      {compra.numeroVale && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] bg-slate-200 px-1.5 py-0.5 rounded">VALE</span>
                          <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{compra.numeroVale}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 border-dashed">
                        <span className="font-black text-slate-500 uppercase tracking-widest text-[9px]">Volume da Carga</span>
                        <span className="font-black text-slate-800">{compra.itens.length} SKU(s)</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-auto border-t border-slate-100 pt-4">
                      <span className="text-2xl font-black font-mono tracking-tight text-slate-900">R$ {compra.valorTotal.toFixed(2)}</span>
                      <button onClick={() => registrarRecebimento(compra)} disabled={processandoRecebimento} className="px-5 py-3 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm">
                        <span>📦</span> Entrar Estoque
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: FORNECEDORES CRUD */}
      {abaAtiva === 'lista' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in">
          <div className="xl:col-span-1">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-24">
              <h3 className="text-xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-3">{idFornecedorEdicao ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
              <form onSubmit={salvarFornecedor} className="space-y-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome da Fábrica</label><input type="text" required value={nomeForn} onChange={(e) => setNomeForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp / Contato</label><input type="text" value={contatoForn} onChange={(e) => setContatoForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Insumo Principal (Ex: Borracha)</label><input type="text" value={categoriaForn} onChange={(e) => setCategoriaForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" /></div>
                <div className="pt-2"><button type="submit" className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-md">{idFornecedorEdicao ? 'Atualizar Ficha' : 'Cadastrar Fábrica'}</button></div>
              </form>
            </div>
          </div>
          
          <div className="xl:col-span-2 space-y-4">
            {fornecedores.map(forn => (
              <div key={forn.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-indigo-200 transition-colors">
                <div>
                  <h4 className="text-lg font-black text-slate-800 leading-tight">{forn.nome}</h4>
                  <p className="text-xs font-bold text-slate-500 mt-1">{forn.contato} • <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">{forn.categoriaInsumo || 'Geral'}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setIdFornecedorEdicao(forn.id); setNomeForn(forn.nome); setContatoForn(forn.contato); setCategoriaForn(forn.categoriaInsumo); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-10 h-10 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-xl border border-slate-200 flex items-center justify-center transition-colors">✏️</button>
                  <button onClick={async () => { if(window.confirm("Excluir fornecedor?")) await deleteDoc(doc(db, 'usuarios', auth.currentUser!.uid, 'fornecedores', forn.id)); }} className="w-10 h-10 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl border border-rose-200 flex items-center justify-center transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}