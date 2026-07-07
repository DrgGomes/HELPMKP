import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

  // --- ESTADOS DO MOTOR DE IMPRESSÃO EM LOTE ---
  const [ordensParaImprimir, setOrdensParaImprimir] = useState<Compra[] | null>(null);
  const [selecionadosImpressao, setSelecionadosImpressao] = useState<string[]>([]);

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

  const executarImpressaoProfissional = () => {
    setTimeout(() => window.print(), 800);
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-6 sm:space-y-8 no-print">
      
      {/* CSS DE IMPRESSÃO */}
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          .print-portal { display: none !important; }
        }
        @media print {
          #root { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-portal { display: block !important; width: 100% !important; color: black !important; }
          @page { margin: 10mm; size: auto; }
        }
      `}} />

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span>🚚</span> Cargas
          </h2>
          <p className="text-slate-500 font-medium mt-1 text-xs sm:text-sm">Triagem de portaria e ordens de fábrica.</p>
        </div>
      </header>

      {/* ABAS (SWIPEÁVEIS NO MOBILE) */}
      <div className="flex overflow-x-auto scrollbar-hide gap-2 border-b border-slate-200 pb-px -mx-4 px-4 sm:mx-0 sm:px-0">
        <button onClick={() => setAbaAtiva('gerar')} className={`whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'gerar' ? 'bg-slate-900 text-white border-t-2 border-slate-900 shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>
          <span>🛒</span> Gerar Ordem
        </button>
        <button onClick={() => setAbaAtiva('receber')} className={`whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'receber' ? 'bg-emerald-600 text-white border-t-2 border-emerald-500 shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>
          <span>⚡</span> Bipar Carga
        </button>
        <button onClick={() => setAbaAtiva('lista')} className={`whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'lista' ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>
          <span>📋</span> Fábricas
        </button>
      </div>

      {/* ABA 1: GERAR ORDEM */}
      {abaAtiva === 'gerar' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start animate-fade-in">
          <div className="xl:col-span-5 bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-black text-lg sm:text-xl text-slate-800 tracking-tight mb-6 border-b border-slate-100 pb-4">Nova Ordem</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fábrica</label>
                <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                  <option value="">Selecionar Fábrica...</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Emissão</label>
                  <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vencimento</label>
                  <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vale / NF</label>
                <input type="text" placeholder="Ex: VALE-1234" value={numeroVale} onChange={(e) => setNumeroVale(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-700 outline-none" />
              </div>
              <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 mt-6 space-y-4">
                <h4 className="font-black text-indigo-900 text-sm">Adicionar Insumos</h4>
                <select value={produtoSelecionado} onChange={(e) => { setProdutoSelecionado(e.target.value); const p = produtos.find(x => x.id === e.target.value); if (p) setCustoUnitario(p.custoBase.toString()); }} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-700 outline-none"><option value="">Escolher Produto...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select>
                <div className="flex gap-3">
                  <div className="w-1/3"><input type="number" min="1" placeholder="Qtd" value={quantidadeDesejada} onChange={(e) => setQuantidadeDesejada(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-black text-indigo-700 text-center outline-none" /></div>
                  <div className="w-2/3 relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">R$</span><input type="number" step="0.01" placeholder="0.00" value={custoUnitario} onChange={(e) => setCustoUnitario(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-base text-slate-800 outline-none" /></div>
                </div>
                <button type="button" onClick={adicionarAoCarrinho} className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-wider">Incluir na Lista</button>
              </div>
            </div>
          </div>
          <div className="xl:col-span-7 space-y-4">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 min-h-[400px] flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Itens Mapeados</p>
                {itensCarrinho.length === 0 ? <p className="text-sm font-bold text-slate-400 text-center py-10 sm:py-20">Nenhum item na carga.</p> : (
                  <div className="divide-y divide-slate-100">{itensCarrinho.map((item, idx) => <div key={idx} className="py-3 flex justify-between items-center"><div className="min-w-0 pr-2"><p className="font-bold text-slate-800 text-xs sm:text-sm truncate">{item.nome}</p><p className="text-[10px] text-slate-400 font-bold">{item.quantidade}x R$ {item.custoUnitario.toFixed(2)}</p></div><div className="flex items-center gap-3"><span className="font-black text-slate-700 text-xs sm:text-sm">R$ {item.subtotal.toFixed(2)}</span><button type="button" onClick={() => removerDoCarrinho(idx)} className="text-rose-500 font-bold text-lg">✕</button></div></div>)}</div>
                )}
              </div>
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-center sm:text-left"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Líquido</p><p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">R$ {valorTotalOrdem.toFixed(2)}</p></div>
                <button onClick={finalizarOrdem} disabled={processandoOrdem || itensCarrinho.length === 0} className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 text-slate-900 font-black uppercase tracking-widest rounded-xl text-xs shadow-md disabled:opacity-50">{processandoOrdem ? 'Processando...' : 'Gravar Ordem'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: RECEBER MERCADORIA */}
      {abaAtiva === 'receber' && (
        <div className="animate-fade-in space-y-8">
          
          {comprasSemFatura.length > 0 && (
            <div className="bg-rose-950 border border-rose-500/50 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="text-center md:text-left"><h3 className="text-rose-400 font-black text-sm sm:text-base flex items-center justify-center md:justify-start gap-2"><span>🚨</span> Alerta de Auditoria</h3><p className="text-rose-200/70 text-xs mt-1">Existem ordens que não geraram cobrança no Caixa.</p></div>
              <button onClick={corrigirFaturasAntigas} disabled={processandoRecebimento} className="w-full md:w-auto px-4 py-3 bg-rose-600 text-white font-black uppercase rounded-xl text-[10px] tracking-widest">Sincronizar Caixa</button>
            </div>
          )}

          <div className="bg-[#064e3b] rounded-[2rem] p-6 sm:p-10 text-center shadow-xl border border-emerald-900/50 max-w-4xl mx-auto">
            <span className="text-5xl sm:text-6xl block mb-3 sm:mb-4 drop-shadow-lg">🎯</span>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">Triagem Logística</h3>
            <p className="text-emerald-300 text-xs sm:text-sm mb-6">Bipe o código na folha para liberar a carga.</p>
            <div className="max-w-xl mx-auto">
              <input type="text" placeholder="ORD-123456" value={codigoBip} onChange={(e) => setCodigoBip(e.target.value)} onKeyDown={lidarBip} className="w-full bg-[#022c22] border-2 border-emerald-500/50 text-emerald-400 text-center text-xl sm:text-3xl font-black font-mono py-4 sm:py-5 rounded-xl outline-none placeholder:text-emerald-900/40 focus:border-emerald-400" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4 sm:mb-6"><span className="text-xl sm:text-2xl">📦</span><h3 className="text-lg sm:text-xl font-black text-slate-800">Cargas na Rua</h3></div>
            {comprasAguardando.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 sm:p-12 text-center"><span className="text-4xl block mb-3 opacity-30">🛣️</span><p className="text-slate-500 font-bold text-sm sm:text-lg">Nenhuma carga pendente.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {comprasAguardando.map(compra => {
                  const isAtrasado = compra.dataPagamento && compra.dataPagamento < new Date().toISOString().split('T')[0];
                  return (
                    <div key={compra.id} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3"><span className="bg-amber-100 text-amber-800 text-[8px] sm:text-[9px] font-black px-2 py-1 rounded border border-amber-200 uppercase">Aguardando</span><span className="text-slate-400 font-mono text-[10px] sm:text-xs font-bold">{compra.codigoOrdem}</span></div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800 mb-4">{compra.fornecedorNome}</h3>
                        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-[10px] sm:text-xs font-bold mb-4">
                          <div className="flex justify-between"><span>EMI:</span><span className="text-slate-700">{compra.dataCompra.split('-').reverse().join('/')}</span></div>
                          <div className="flex justify-between"><span>VENC:</span><span className={isAtrasado ? 'text-rose-600 font-black' : 'text-slate-700'}>{compra.dataPagamento?.split('-').reverse().join('/') || '---'}</span></div>
                          {compra.numeroVale && <div className="flex justify-between"><span>NF:</span><span className="text-indigo-600 font-black">{compra.numeroVale}</span></div>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-100">
                        <span className="text-lg sm:text-xl font-black font-mono">R$ {compra.valorTotal.toFixed(2)}</span>
                        <div className="flex gap-1.5 sm:gap-2">
                          <button onClick={() => setOrdensParaImprimir([compra])} className="px-2 sm:px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[9px] sm:text-[10px] font-black uppercase">🖨️ Ficha</button>
                          <button onClick={() => registrarRecebimento(compra)} disabled={processandoRecebimento} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] sm:text-[10px] font-black uppercase">Receber</button>
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

      {/* ABA 3: FORNECEDORES */}
      {abaAtiva === 'lista' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in">
          <div className="xl:col-span-1">
            <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-5 pb-3 border-b border-slate-100">{idFornecedorEdicao ? 'Editar Fábrica' : 'Nova Fábrica'}</h3>
              <form onSubmit={salvarFornecedor} className="space-y-4">
                <div><input type="text" required placeholder="Nome" value={nomeForn} onChange={(e) => setNomeForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                <div><input type="text" placeholder="Contato" value={contatoForn} onChange={(e) => setContatoForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                <div><input type="text" placeholder="Insumo Principal" value={categoriaForn} onChange={(e) => setCategoriaForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" /></div>
                <button type="submit" className="w-full py-3.5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl">{idFornecedorEdicao ? 'Atualizar' : 'Cadastrar'}</button>
              </form>
            </div>
          </div>
          <div className="xl:col-span-2 space-y-3">
            {fornecedores.map(forn => (
              <div key={forn.id} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div className="pr-4"><h4 className="text-base font-black text-slate-800">{forn.nome}</h4><p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1">{forn.contato} • <span className="bg-slate-100 px-1.5 py-0.5 rounded uppercase font-black">{forn.categoriaInsumo || 'Geral'}</span></p></div>
                <div className="flex gap-1 sm:gap-2">
                  <button onClick={() => { setIdFornecedorEdicao(forn.id); setNomeForn(forn.nome); setContatoForn(forn.contato); setCategoriaForn(forn.categoriaInsumo); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center">✏️</button>
                  <button onClick={async () => { if(window.confirm("Excluir?")) await deleteDoc(doc(db, 'usuarios', auth.currentUser!.uid, 'fornecedores', forn.id)); }} className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARQUIVO DE LOG / HISTÓRICO COM LOTE */}
      <div className="mt-10 sm:mt-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div className="flex items-center gap-2 sm:gap-3"><span className="text-xl sm:text-2xl">📋</span><h3 className="text-lg sm:text-xl font-black text-slate-800">Arquivo Geral</h3></div>
          {selecionadosImpressao.length > 0 && (
            <button onClick={() => setOrdensParaImprimir(compras.filter(c => selecionadosImpressao.includes(c.id)))} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md flex items-center justify-center gap-2 animate-fade-in">
              <span>🖨️</span> Imprimir {selecionadosImpressao.length} Selecionadas
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left text-[10px] sm:text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[8px] sm:text-[9px] border-b border-slate-800">
                  <th className="p-3 sm:p-4 w-10 text-center"><input type="checkbox" checked={selecionadosImpressao.length === compras.length && compras.length > 0} onChange={() => setSelecionadosImpressao(selecionadosImpressao.length === compras.length ? [] : compras.map(c => c.id))} className="accent-indigo-500 w-3 h-3 sm:w-4 sm:h-4 rounded" /></th>
                  <th className="p-3 sm:p-4">Código</th>
                  <th className="p-3 sm:p-4">Fábrica</th>
                  <th className="p-3 sm:p-4">Emissão</th>
                  <th className="p-3 sm:p-4">Status</th>
                  <th className="p-3 sm:p-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {compras.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50 ${selecionadosImpressao.includes(c.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="p-3 sm:p-4 text-center"><input type="checkbox" checked={selecionadosImpressao.includes(c.id)} onChange={() => setSelecionadosImpressao(selecionadosImpressao.includes(c.id) ? selecionadosImpressao.filter(id => id !== c.id) : [...selecionadosImpressao, c.id])} className="accent-indigo-600 w-3 h-3 sm:w-4 sm:h-4 rounded" /></td>
                    <td className="p-3 sm:p-4 font-mono text-slate-900">{c.codigoOrdem}</td>
                    <td className="p-3 sm:p-4">{c.fornecedorNome}</td>
                    <td className="p-3 sm:p-4 font-mono">{c.dataCompra.split('-').reverse().join('/')}</td>
                    <td className="p-3 sm:p-4"><span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase border ${c.statusChegada === 'recebido' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>{c.statusChegada}</span></td>
                    <td className="p-3 sm:p-4 font-mono text-right text-slate-900">R$ {c.valorTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PORTAL ENTERPRISE DE IMPRESSÃO (ISOLADO PARA NÃO QUEBRAR O LAYOUT MOBILE) */}
      {ordensParaImprimir && ordensParaImprimir.length > 0 && createPortal(
        <>
          {/* TELA DE PREVIEW NO DISPOSITIVO (NÃO IMPRIME) */}
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex justify-center items-center p-4 animate-fade-in print:hidden">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 p-5 sm:p-6 text-white flex justify-between items-center">
                <div><p className="text-[8px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Preview A4</p><h3 className="text-xl sm:text-2xl font-black">{ordensParaImprimir.length > 1 ? `Lote (${ordensParaImprimir.length})` : ordensParaImprimir[0].codigoOrdem}</h3></div>
                <button onClick={() => { setOrdensParaImprimir(null); setSelecionadosImpressao([]); }} className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-800 rounded-full font-black text-lg flex items-center justify-center">✕</button>
              </div>
              <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100">
                <div className="bg-white p-4 sm:p-8 shadow-sm border border-slate-200 rounded-xl pointer-events-none opacity-80">
                  <p className="text-center font-bold text-slate-500 mb-6 text-[10px] sm:text-sm uppercase tracking-widest">Pré-visualização Simbólica (Clique em Imprimir)</p>
                </div>
              </div>
              <div className="bg-white p-4 sm:p-6 border-t border-slate-200 flex justify-end gap-2 sm:gap-3">
                <button onClick={() => { setOrdensParaImprimir(null); setSelecionadosImpressao([]); }} className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] sm:text-xs font-black uppercase text-slate-600">Cancelar</button>
                <button onClick={executarImpressaoProfissional} className="px-5 py-3 bg-blue-600 text-white font-black uppercase text-[10px] sm:text-xs rounded-xl shadow-lg">🖨️ Imprimir A4</button>
              </div>
            </div>
          </div>

          {/* O CÓDIGO REAL QUE VAI PARA A IMPRESSORA (PERFEITO, SEM CORTES, CÓDIGOS DE ALTA RESOLUÇÃO) */}
          <div className="print-portal bg-white text-black font-sans p-2 w-full">
            {ordensParaImprimir.map((ordem, index) => (
              <div key={`print-${ordem.id}`} style={{ pageBreakInside: 'avoid' }} className={index !== ordensParaImprimir.length - 1 ? 'border-b border-dashed border-slate-400 pb-12 mb-12' : ''}>
                
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                  <div>
                    <h1 className="text-2xl font-black tracking-tight uppercase">Ordem de Fábrica</h1>
                    <p className="text-[10px] font-bold text-slate-600 mt-1">HelpMkp Enterprise ERP</p>
                    <div className="mt-3 space-y-0.5 font-mono text-[10px] text-black">
                      <p><strong>FABRICA:</strong> {ordem.fornecedorNome}</p>
                      <p><strong>EMISSÃO:</strong> {ordem.dataCompra.split('-').reverse().join('/')}</p>
                      <p><strong>VENCIMENTO:</strong> {ordem.dataPagamento?.split('-').reverse().join('/') || '---'}</p>
                      {ordem.numeroVale && <p><strong>VALE:</strong> {ordem.numeroVale}</p>}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ordem.codigoOrdem}`} alt="QR" loading="eager" className="w-16 h-16 mx-auto" />
                    <img src={`https://barcode.tec-it.com/barcode.ashx?data=${ordem.codigoOrdem}&code=Code128`} alt="Barcode" loading="eager" className="h-8 w-auto object-contain mx-auto mt-2" />
                  </div>
                </div>

                <table className="w-full text-left text-[10px] border-collapse mb-4 text-black">
                  <thead>
                    <tr className="border-b border-black font-black uppercase">
                      <th className="p-1">Insumo</th>
                      <th className="p-1 text-center">Qtd</th>
                      <th className="p-1 text-right">Unidade</th>
                      <th className="p-1 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordem.itens.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-1 font-bold">{item.nome}</td>
                        <td className="p-1 text-center font-mono">{item.quantidade}</td>
                        <td className="p-1 text-right font-mono">R$ {item.custoUnitario.toFixed(2)}</td>
                        <td className="p-1 text-right font-mono font-bold">R$ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-black pt-2 flex justify-between items-center text-black">
                  <div className="text-[10px]"><p>Status: {ordem.statusChegada.toUpperCase()}</p></div>
                  <div className="text-right"><p className="text-[8px] font-black uppercase tracking-widest mb-0.5">Total</p><p className="text-xl font-black font-mono">R$ {ordem.valorTotal.toFixed(2)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </>,
        document.body
      )}

    </div>
  );
}