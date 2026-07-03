import React, { useState, useMemo } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Fornecedor, Produto, Compra, ItemCompra } from '../types';

export default function Fornecedores({ fornecedores, produtos, compras }: { fornecedores: Fornecedor[], produtos: Produto[], compras: Compra[] }) {
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

  // --- ESTADO DO MODAL DE IMPRESSÃO ---
  const [ordemParaImprimir, setOrdemParaImprimir] = useState<Compra | null>(null);

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
      
      await addDoc(collection(db, 'usuarios', userId, 'compras'), {
        codigoOrdem: codigoGerado,
        statusChegada: 'aguardando',
        fornecedorId: forn.id,
        fornecedorNome: forn.nome,
        dataCompra: dataEmissao,
        dataPagamento: dataVencimento,
        numeroVale: numeroVale,
        itens: itensCarrinho,
        valorTotal: valorTotalOrdem,
        statusPagamento: 'pendente',
        faturaGerada: false 
      });

      alert(`✅ Ordem ${codigoGerado} gerada e enviada para aguardo!`);
      
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

  // AUDITORIA FINANCEIRA
  const comprasSemFatura = useMemo(() => {
    return compras.filter(c => c.statusChegada === 'recebido' && c.faturaGerada !== true);
  }, [compras]);

  const comprasAguardando = useMemo(() => {
    return compras.filter(c => c.statusChegada === 'aguardando').sort((a, b) => new Date(b.dataCompra).getTime() - new Date(a.dataCompra).getTime());
  }, [compras]);

  // LÓGICA: RECEBER MERCADORIA
  const registrarRecebimento = async (compra: Compra) => {
    const userId = auth.currentUser?.uid; if (!userId) return;
    
    if (!window.confirm(`Confirmar entrada no estoque da ordem ${compra.codigoOrdem} e lançar faturamento?`)) return;

    setProcessandoRecebimento(true);
    try {
      const batch = writeBatch(db);
      const compraRef = doc(db, 'usuarios', userId, 'compras', compra.id);
      batch.update(compraRef, { statusChegada: 'recebido', faturaGerada: true });

      for (const item of compra.itens) {
        const prodExistente = produtos.find(p => p.id === item.produtoId);
        if (prodExistente) {
          const prodRef = doc(db, 'usuarios', userId, 'produtos', prodExistente.id);
          const novoEstoque = (prodExistente.estoque || 0) + item.quantidade;
          batch.update(prodRef, { estoque: novoEstoque });
        }
      }

      const faturaRef = doc(collection(db, 'usuarios', userId, 'lancamentos'));
      batch.set(faturaRef, {
        tipo: 'despesa',
        descricao: `Fatura ${compra.numeroVale ? `(Vale: ${compra.numeroVale})` : compra.codigoOrdem} - ${compra.fornecedorNome}`,
        valor: compra.valorTotal,
        dataVencimento: compra.dataPagamento || compra.dataCompra || new Date().toISOString().split('T')[0],
        dataLancamento: compra.dataCompra || new Date().toISOString().split('T')[0],
        status: 'pendente',
        categoria: 'Compras de Estoque',
        fornecedorId: compra.fornecedorId,
        compraId: compra.id
      });

      await batch.commit();
      alert(`📦 Carga processada com sucesso no estoque e lançada no financeiro.`);
      setCodigoBip('');
    } catch (e) {
      console.error(e);
      alert("Erro ao processar recebimento.");
    }
    setProcessandoRecebimento(false);
  };

  const corrigirFaturasAntigas = async () => {
    const userId = auth.currentUser?.uid; if (!userId) return;
    setProcessandoRecebimento(true);
    try {
      const batch = writeBatch(db);
      comprasSemFatura.forEach(compra => {
        const compraRef = doc(db, 'usuarios', userId, 'compras', compra.id);
        batch.update(compraRef, { faturaGerada: true });

        const faturaRef = doc(collection(db, 'usuarios', userId, 'lancamentos'));
        batch.set(faturaRef, {
          tipo: 'despesa',
          descricao: `Fatura ${compra.numeroVale ? `(Vale: ${compra.numeroVale})` : compra.codigoOrdem} - ${compra.fornecedorNome}`,
          valor: compra.valorTotal,
          dataVencimento: compra.dataPagamento || compra.dataCompra || new Date().toISOString().split('T')[0],
          dataLancamento: compra.dataCompra || new Date().toISOString().split('T')[0],
          status: 'pendente',
          categoria: 'Compras de Estoque',
          fornecedorId: compra.fornecedorId,
          compraId: compra.id
        });
      });
      await batch.commit();
      alert("✅ Sincronização retroativa executada com sucesso.");
    } catch(e) {
      console.error(e);
    }
    setProcessandoRecebimento(false);
  };

  const lidarBip = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const ordemEncontrada = comprasAguardando.find(c => c.codigoOrdem === codigoBip.trim());
      if (ordemEncontrada) registrarRecebimento(ordemEncontrada);
      else alert("Ordem não localizada.");
    }
  };

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
      
      {/* CSS DE IMPRESSÃO - CORRIGIDO E ISOLADO */}
      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } #ordem-compra-print, #ordem-compra-print * { visibility: visible !important; } #ordem-compra-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; padding: 0px !important; } .no-print { display: none !important; } }`}} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span>🚚</span> Compras & Entradas
          </h2>
          <p className="text-slate-500 font-medium mt-1">Gere requisições de fábrica, realize triagem logística por código de barras e controle remessas.</p>
        </div>
      </header>

      {/* ABAS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px no-print">
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start animate-fade-in no-print">
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
                <select value={produtoSelecionado} onChange={(e) => { setProdutoSelecionado(e.target.value); const p = produtos.find(x => x.id === e.target.value); if (p) setCustoUnitario(p.custoBase.toString()); }} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-700 outline-none"><option value="">Escolher Produto...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select>
                <div className="flex gap-3">
                  <div className="w-1/3"><input type="number" min="1" placeholder="Qtd" value={quantidadeDesejada} onChange={(e) => setQuantidadeDesejada(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-black text-indigo-700 outline-none text-center" /></div>
                  <div className="w-2/3 relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">R$</span><input type="number" step="0.01" placeholder="0.00" value={custoUnitario} onChange={(e) => setCustoUnitario(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-slate-800 outline-none focus:border-indigo-500" /></div>
                </div>
                <button type="button" onClick={adicionarAoCarrinho} className="w-full py-2.5 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-colors hover:bg-indigo-700">Incluir na Lista</button>
              </div>
            </div>
          </div>
          <div className="xl:col-span-7 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 min-h-[400px] flex flex-col justify-between">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Itens Mapeados na Ordem</p>
                {itensCarrinho.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-20">Nenhum insumo adicionado.</p> : (
                  <div className="divide-y divide-slate-100">{itensCarrinho.map((item, idx) => <div key={idx} className="py-3 flex justify-between items-center"><div className="min-w-0"><p className="font-bold text-slate-800 text-sm truncate">{item.nome}</p><p className="text-[10px] text-slate-400 font-bold">{item.quantidade}x R$ {item.custoUnitario.toFixed(2)}</p></div><div className="flex items-center gap-4"><span className="font-black text-slate-700 text-sm">R$ {item.subtotal.toFixed(2)}</span><button type="button" onClick={() => removerDoCarrinho(idx)} className="text-rose-500 font-bold text-sm hover:text-rose-600">✕</button></div></div>)}</div>
                )}
              </div>
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total Líquido</p><p className="text-3xl font-black text-slate-900 font-mono">R$ {valorTotalOrdem.toFixed(2)}</p></div>
                <button onClick={finalizarOrdem} disabled={processandoOrdem || itensCarrinho.length === 0} className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black uppercase tracking-widest rounded-xl text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-colors">{processandoOrdem ? 'Processando...' : 'Gravar e Enviar Ordem'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: RECEBER MERCADORIA */}
      {abaAtiva === 'receber' && (
        <div className="animate-fade-in space-y-10 no-print">
          {comprasSemFatura.length > 0 && (
            <div className="bg-rose-950 border border-rose-500/50 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl animate-pulse">
              <div><h3 className="text-rose-400 font-black text-lg flex items-center gap-2"><span>🚨</span> Alerta de Auditoria</h3><p className="text-rose-200/70 font-medium text-sm mt-1">Existem ordens recebidas que não geraram lançamento financeiro automático. Clique ao lado para regularizar.</p></div>
              <button onClick={corrigirFaturasAntigas} disabled={processandoRecebimento} className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest rounded-xl text-xs whitespace-nowrap transition-colors disabled:opacity-50">{processandoRecebimento ? 'Processando...' : 'Sincronizar com Caixa'}</button>
            </div>
          )}

          <div className="bg-[#064e3b] rounded-[2.5rem] p-10 text-center shadow-xl border border-emerald-900/50 max-w-4xl mx-auto">
            <span className="text-6xl block mb-4 drop-shadow-lg">🎯</span>
            <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Bipe a Ordem de Compra</h3>
            <p className="text-emerald-300 font-medium mb-8">Passe o leitor de código de barras físico no vale impresso para dar entrada automática.</p>
            <div className="max-w-xl mx-auto">
              <input type="text" placeholder="Ex: ORD-171829" value={codigoBip} onChange={(e) => setCodigoBip(e.target.value)} onKeyDown={lidarBip} className="w-full bg-[#022c22] border-2 border-emerald-500/50 text-emerald-400 text-center text-3xl font-black font-mono py-6 rounded-2xl outline-none placeholder:text-emerald-900/40 focus:border-emerald-400 transition-colors" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6"><span className="text-2xl">🚚</span><h3 className="text-xl font-black text-slate-800">Ordens Aguardando Chegada</h3></div>
            {comprasAguardando.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center"><span className="text-5xl block mb-4 opacity-40">🛣️</span><p className="text-slate-500 font-bold text-lg">Nenhum caminhão pendente de triagem.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {comprasAguardando.map(compra => {
                  const isAtrasado = compra.dataPagamento && compra.dataPagamento < new Date().toISOString().split('T')[0];
                  return (
                    <div key={compra.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="flex justify-between items-start mb-4"><span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2.5 py-1 rounded-md border border-amber-200 uppercase">Aguardando</span><span className="text-slate-400 font-mono text-xs font-bold">{compra.codigoOrdem}</span></div>
                        <h3 className="text-lg font-black text-slate-800 mb-4">{compra.fornecedorNome}</h3>
                        <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono text-xs font-bold mb-6">
                          <div className="flex justify-between"><span>EMISSÃO:</span><span className="text-slate-700">{compra.dataCompra.split('-').reverse().join('/')}</span></div>
                          <div className="flex justify-between"><span>FATURA:</span><span className={isAtrasado ? 'text-rose-600 font-black' : 'text-slate-700'}>{compra.dataPagamento?.split('-').reverse().join('/') || '---'}</span></div>
                          {compra.numeroVale && <div className="flex justify-between"><span>VALE / NF:</span><span className="text-indigo-600 font-black">{compra.numeroVale}</span></div>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <span className="text-xl font-black font-mono tracking-tight">R$ {compra.valorTotal.toFixed(2)}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setOrdemParaImprimir(compra)} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl text-xs font-black shadow-sm transition-colors" title="Visualizar e Imprimir Ficha">🖨️ Ficha</button>
                          <button onClick={() => registrarRecebimento(compra)} disabled={processandoRecebimento} className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50">Receber</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: CRUD LISTA FORNECEDORES */}
      {abaAtiva === 'lista' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in no-print">
          <div className="xl:col-span-1">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-24">
              <h3 className="text-xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-3">{idFornecedorEdicao ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
              <form onSubmit={salvarFornecedor} className="space-y-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome da Fábrica</label><input type="text" required value={nomeForn} onChange={(e) => setNomeForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp / Contato</label><input type="text" value={contatoForn} onChange={(e) => setContatoForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Insumo Principal</label><input type="text" value={categoriaForn} onChange={(e) => setCategoriaForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" /></div>
                <div className="pt-2"><button type="submit" className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-md">{idFornecedorEdicao ? 'Atualizar Ficha' : 'Cadastrar Fábrica'}</button></div>
              </form>
            </div>
          </div>
          <div className="xl:col-span-2 space-y-4">
            {fornecedores.map(forn => (
              <div key={forn.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-indigo-200 transition-colors">
                <div><h4 className="text-lg font-black text-slate-800 leading-tight">{forn.nome}</h4><p className="text-xs font-bold text-slate-500 mt-1">{forn.contato} • <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase font-black">{forn.categoriaInsumo || 'Geral'}</span></p></div>
                <div className="flex gap-2">
                  <button onClick={() => { setIdFornecedorEdicao(forn.id); setNomeForn(forn.nome); setContatoForn(forn.contato); setCategoriaForn(forn.categoriaInsumo); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-10 h-10 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-xl border border-slate-200 flex items-center justify-center transition-colors">✏️</button>
                  <button onClick={async () => { if(window.confirm("Excluir fornecedor?")) await deleteDoc(doc(db, 'usuarios', auth.currentUser!.uid, 'fornecedores', forn.id)); }} className="w-10 h-10 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl border border-rose-200 flex items-center justify-center transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTÓRICO COMPLETO DE ORDENS DE COMPRA */}
      <div className="mt-12 no-print">
        <div className="flex items-center gap-3 mb-6"><span className="text-2xl">📋</span><h3 className="text-xl font-black text-slate-800">Histórico de Ordens / Arquivo Log</h3></div>
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[9px] border-b border-slate-800">
                  <th className="p-4">Código Ordem</th>
                  <th className="p-4">Fornecedor</th>
                  <th className="p-4">Emissão</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4">Vale / NF</th>
                  <th className="p-4">Status Logístico</th>
                  <th className="p-4 text-right">Valor Total</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {compras.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-black text-slate-900">{c.codigoOrdem}</td>
                    <td className="p-4 font-black">{c.fornecedorNome}</td>
                    <td className="p-4 font-mono">{c.dataCompra.split('-').reverse().join('/')}</td>
                    <td className="p-4 font-mono">{c.dataPagamento?.split('-').reverse().join('/') || '---'}</td>
                    <td className="p-4 font-mono text-indigo-600">{c.numeroVale || '---'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${c.statusChegada === 'recebido' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                        {c.statusChegada}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-right font-black text-slate-900">R$ {c.valorTotal.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => setOrdemParaImprimir(c)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-lg border border-slate-200 transition-colors text-[10px] font-black uppercase tracking-widest shadow-sm">🖨️ Ficha</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL / ESPELHO DE IMPRESSÃO DA ORDEM DE COMPRA */}
      {ordemParaImprimir && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-center items-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center no-print">
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Visualização de Documento Fiscal</p>
                <h3 className="text-2xl font-black">{ordemParaImprimir.codigoOrdem}</h3>
              </div>
              <button onClick={() => setOrdemParaImprimir(null)} className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full font-black text-xl flex items-center justify-center transition-colors">✕</button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              
              <div id="ordem-compra-print" className="bg-white text-black p-2 font-sans">
                <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-6">
                  <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase">Ordem de Compra / Mercadoria</h1>
                    <p className="text-xs font-bold text-slate-500 mt-1">HelpMkp Enterprise ERP - Automação Industrial</p>
                    <div className="mt-4 space-y-1 font-mono text-xs">
                      <p><strong>FORNECEDOR:</strong> {ordemParaImprimir.fornecedorNome}</p>
                      <p><strong>EMISSÃO:</strong> {ordemParaImprimir.dataCompra.split('-').reverse().join('/')}</p>
                      <p><strong>VENCIMENTO:</strong> {ordemParaImprimir.dataPagamento?.split('-').reverse().join('/') || '---'}</p>
                      {ordemParaImprimir.numeroVale && <p><strong>VALE / COORDENAÇÃO NF:</strong> {ordemParaImprimir.numeroVale}</p>}
                    </div>
                  </div>
                  
                  <div className="text-center space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${ordemParaImprimir.codigoOrdem}`} 
                        alt="QR Code da Ordem" 
                        className="w-24 h-24 mx-auto border-2 border-white shadow-sm"
                      />
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mt-1">QR Rastreio</p>
                    </div>
                    <div>
                      <img 
                        src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${ordemParaImprimir.codigoOrdem}&scale=2&rotate=N&includetext`} 
                        alt="Código de Barras da Ordem" 
                        className="h-10 object-contain mx-auto"
                      />
                    </div>
                  </div>
                </div>

                <table className="w-full text-left text-xs border-collapse mb-8">
                  <thead>
                    <tr className="border-b-2 border-black bg-slate-100 font-black uppercase text-[10px] tracking-wider">
                      <th className="p-3">Insumo / Descrição do Produto</th>
                      <th className="p-3 text-center">Quantidade</th>
                      <th className="p-3 text-right">Custo Unitário</th>
                      <th className="p-3 text-right">Subtotal Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-bold text-slate-800">
                    {ordemParaImprimir.itens.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3">{item.nome}</td>
                        <td className="p-3 text-center font-mono">{item.quantidade} UN</td>
                        <td className="p-3 text-right font-mono">R$ {item.custoUnitario.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-black">R$ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-black pt-4 flex justify-between items-center">
                  <div className="text-xs font-medium text-slate-500">
                    <p>Status da Remessa: {ordemParaImprimir.statusChegada.toUpperCase()}</p>
                    <p className="mt-1">Autenticação: {ordemParaImprimir.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo Total Consolidado</p>
                    <p className="text-3xl font-black font-mono tracking-tight">R$ {ordemParaImprimir.valorTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3 mt-auto no-print">
              <button onClick={() => setOrdemParaImprimir(null)} className="px-5 py-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 transition-colors shadow-sm">Voltar</button>
              <button onClick={() => window.print()} className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all transform hover:scale-105">
                🖨️ Imprimir A4
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}