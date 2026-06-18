import React, { useState } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Fornecedor, Produto, ItemCompra, Compra } from '../types';

interface FornecedoresProps {
  fornecedores: Fornecedor[];
  produtos: Produto[];
  compras: Compra[];
}

export default function Fornecedores({ fornecedores, produtos, compras }: FornecedoresProps) {
  const [abaAtiva, setAbaAtiva] = useState<'nova_ordem' | 'receber_bipe' | 'lista'>('nova_ordem');
  
  // Estados Fornecedores
  const [idFornEdicao, setIdFornEdicao] = useState<string | null>(null);
  const [nomeForn, setNomeForn] = useState('');
  const [contatoForn, setContatoForn] = useState('');
  const [categoriaForn, setCategoriaForn] = useState('');

  // Estados Carrinho (Ordem de Compra)
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCompra[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  const [numeroVale, setNumeroVale] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [ordemImpressao, setOrdemImpressao] = useState<Compra | null>(null);

  // Estados Recebimento (Bipe)
  const [codigoBipe, setCodigoBipe] = useState('');
  const [ordemEmConferencia, setOrdemEmConferencia] = useState<Compra | null>(null);
  const [itensConferidos, setItensConferidos] = useState<Record<string, boolean>>({});

  // --- LOGICA DE FORNECEDORES ---
  const lidarSalvarFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeForn) return;
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    const dados = { nome: nomeForn, contato: contatoForn, categoriaInsumo: categoriaForn };
    if (idFornEdicao) await setDoc(doc(db, 'usuarios', userId, 'fornecedores', idFornEdicao), dados);
    else await addDoc(collection(db, 'usuarios', userId, 'fornecedores'), dados);
    setIdFornEdicao(null); setNomeForn(''); setContatoForn(''); setCategoriaForn('');
  };
  
  const lidarExcluirFornecedor = async (id: string) => { 
    const userId = auth.currentUser?.uid as string; 
    if (userId && window.confirm("Excluir?")) await deleteDoc(doc(db, 'usuarios', userId, 'fornecedores', id)); 
  };

  // --- LOGICA DE GERAR ORDEM (ETAPA 1) ---
  const adicionarAoCarrinho = () => {
    if (!produtoSelecionado) return;
    const prodRef = produtos.find(p => p.id === produtoSelecionado);
    if (!prodRef || carrinho.some(item => item.produtoId === prodRef.id)) return;
    setCarrinho([...carrinho, { produtoId: prodRef.id, nome: prodRef.titulo, quantidade: 1, custoUnitario: prodRef.custoBase, subtotal: prodRef.custoBase }]);
    setProdutoSelecionado('');
  };
  
  const atualizarItemCarrinho = (id: string, campo: 'quantidade' | 'custoUnitario', valor: number) => {
    setCarrinho(carrinho.map(item => { if (item.produtoId === id) { const novoItem = { ...item, [campo]: valor }; novoItem.subtotal = novoItem.quantidade * novoItem.custoUnitario; return novoItem; } return item; }));
  };
  
  const removerDoCarrinho = (id: string) => setCarrinho(carrinho.filter(item => item.produtoId !== id));
  
  const totalCompra = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

  const gerarOrdemDeCompra = async () => {
    if (!fornecedorSelecionado || carrinho.length === 0) return alert("Preencha os dados!");
    const userId = auth.currentUser?.uid as string; if (!userId) return;
    const forn = fornecedores.find(f => f.id === fornecedorSelecionado);
    
    const codigoUnico = 'ORD-' + Math.floor(Date.now() / 1000);

    const novaOrdem: Omit<Compra, 'id'> = {
      codigoOrdem: codigoUnico,
      statusChegada: 'aguardando',
      fornecedorId: fornecedorSelecionado,
      fornecedorNome: forn?.nome || 'Desconhecido',
      dataCompra: new Date().toISOString(),
      dataPagamento: dataPagamento,
      numeroVale: numeroVale,
      itens: carrinho,
      valorTotal: totalCompra,
      statusPagamento: 'pendente'
    };

    try {
      const docRef = await addDoc(collection(db, 'usuarios', userId, 'compras'), novaOrdem);
      setOrdemImpressao({ id: docRef.id, ...novaOrdem });
      setCarrinho([]); setFornecedorSelecionado(''); setNumeroVale('');
      alert(`Ordem ${codigoUnico} gerada com sucesso! Você já pode imprimir o PDF ou aguardar a mercadoria chegar.`);
    } catch (error) { console.error(error); }
  };

  // --- LOGICA DE RECEBER E BIPAR (ETAPA 2) ---
  const lidarBipeEntrada = (e: React.FormEvent) => {
    e.preventDefault();
    const ordem = compras.find(c => c.codigoOrdem === codigoBipe.trim());
    if (!ordem) {
      alert("Ordem de compra não encontrada!");
      setCodigoBipe(''); return;
    }
    if (ordem.statusChegada === 'recebido') {
      alert("ATENÇÃO: Esta ordem já foi recebida e contabilizada anteriormente!");
      setCodigoBipe(''); return;
    }
    setOrdemEmConferencia(ordem);
    setItensConferidos({}); 
    setCodigoBipe('');
  };

  const confirmarEntradaNoSistema = async () => {
    if (!ordemEmConferencia) return;
    const todosConferidos = ordemEmConferencia.itens.every(item => itensConferidos[item.produtoId]);
    if (!todosConferidos) return alert("Você precisa conferir todos os itens antes de dar entrada!");

    const userId = auth.currentUser?.uid as string; if (!userId) return;

    try {
      // 1. ATUALIZA ESTOQUE
      for (const item of ordemEmConferencia.itens) {
        const prodAtual = produtos.find(p => p.id === item.produtoId);
        if (prodAtual) {
          await updateDoc(doc(db, 'usuarios', userId, 'produtos', item.produtoId), { estoque: (prodAtual.estoque || 0) + item.quantidade });
        }
      }

      // 2. LANÇA CONTA A PAGAR (COM OS DADOS INJETADOS)
      await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), {
        tipo: 'despesa',
        descricao: `Fatura ${ordemEmConferencia.codigoOrdem} (${ordemEmConferencia.fornecedorNome})`,
        valor: ordemEmConferencia.valorTotal,
        dataVencimento: ordemEmConferencia.dataPagamento || new Date().toISOString().split('T')[0],
        status: 'pendente',
        categoria: 'Fornecedores',
        fornecedorId: ordemEmConferencia.fornecedorId, // INJEÇÃO 1
        compraId: ordemEmConferencia.id                // INJEÇÃO 2
      });

      // 3. ATUALIZA O STATUS DA ORDEM PARA RECEBIDO
      await updateDoc(doc(db, 'usuarios', userId, 'compras', ordemEmConferencia.id), { statusChegada: 'recebido' });

      alert("SUCESSO! Estoque atualizado e fatura lançada no Caixa.");
      setOrdemEmConferencia(null);
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6">
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print { body * { visibility: hidden; } #pdf-ordem, #pdf-ordem * { visibility: visible; } #pdf-ordem { position: absolute; left: 0; top: 0; width: 100%; color: #000; padding: 20px; } .no-print { display: none !important; } }
      `}} />

      <header className="mb-4 no-print">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>🚚</span> Compras & Entradas</h2>
        <p className="text-slate-500 mt-1">Crie Ordens de Compra e dê entrada no estoque bipando o código de barras.</p>
      </header>

      <div className="flex gap-2 border-b border-slate-200 pb-px no-print">
        <button onClick={() => setAbaAtiva('nova_ordem')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'nova_ordem' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>🛒 1. Gerar Ordem (PDF)</button>
        <button onClick={() => setAbaAtiva('receber_bipe')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all flex items-center gap-2 ${abaAtiva === 'receber_bipe' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><span>⚡</span> 2. Receber por Bipe</button>
        <button onClick={() => setAbaAtiva('lista')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'lista' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>📋 Fornecedores</button>
      </div>

      {/* --- ABA 1: GERAR ORDEM E IMPRIMIR PDF --- */}
      {abaAtiva === 'nova_ordem' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full no-print">
            <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
              <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 mb-5 border-b border-slate-100 pb-3">Montar Pedido</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="min-w-0">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Para qual Fornecedor?</label>
                    <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 truncate"><option value="">Selecione...</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Adicionar Produtos</label>
                    <div className="flex gap-2"><select value={produtoSelecionado} onChange={(e) => setProdutoSelecionado(e.target.value)} className="flex-1 min-w-0 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none truncate"><option value="">Buscar no estoque...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select><button onClick={adicionarAoCarrinho} className="shrink-0 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xl shadow-md">+</button></div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[250px]">
                <h3 className="text-lg font-black text-slate-800 mb-5 border-b border-slate-100 pb-3">Itens e Quantidades</h3>
                {carrinho.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"><p className="font-medium text-sm">Carrinho Vazio.</p></div> : (
                  <div className="space-y-4">
                    {carrinho.map(item => (
                      <div key={item.produtoId} className="flex flex-col xl:flex-row xl:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative pr-10">
                        <div className="flex-1 min-w-0"><p className="font-bold text-slate-800 truncate">{item.nome}</p></div>
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
                          <div className="flex flex-col w-20 shrink-0"><span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Qtd</span><input type="number" min="1" value={item.quantidade} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'quantidade', parseInt(e.target.value) || 0)} className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-center font-black outline-none" /></div>
                          <div className="flex flex-col w-28 shrink-0"><span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Custo Un (R$)</span><input type="number" step="0.01" value={item.custoUnitario} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'custoUnitario', parseFloat(e.target.value) || 0)} className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-center font-bold outline-none" /></div>
                          <div className="flex flex-col text-right min-w-[90px] ml-auto"><span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subtotal</span><span className="font-black text-slate-800 text-lg">R$ {item.subtotal.toFixed(2)}</span></div>
                        </div>
                        <button onClick={() => removerDoCarrinho(item.produtoId)} className="absolute right-2 top-4 xl:top-1/2 xl:-translate-y-1/2 w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-600 rounded-lg font-bold">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 mb-5 border-b border-slate-100 pb-3">Pagamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="min-w-0"><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Previsão do Vale/NF</label><input type="text" placeholder="Ex: NF 9081" value={numeroVale} onChange={(e) => setNumeroVale(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                  <div className="min-w-0"><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Vencimento Combinado</label><input type="date" required value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 bg-slate-900 p-6 rounded-2xl shadow-xl h-fit lg:sticky lg:top-6 text-white border border-slate-800 w-full min-w-0">
              <h3 className="text-xl font-black mb-6 border-b border-slate-700 pb-4">Ação</h3>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 text-center"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total da Ordem</p><p className="text-4xl font-black text-blue-400 truncate">R$ {totalCompra.toFixed(2)}</p></div>
              <button onClick={gerarOrdemDeCompra} disabled={carrinho.length === 0 || !fornecedorSelecionado} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black text-lg shadow-lg disabled:opacity-50">Emitir Ordem (PDF)</button>
              <p className="text-center text-[10px] text-slate-400 mt-4 px-2">A ordem ficará "Aguardando" até você bipar na tela de recebimento.</p>
              
              {ordemImpressao && (
                <button onClick={() => window.print()} className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-3 rounded-xl font-black flex items-center justify-center gap-2 animate-fade-in shadow-lg shadow-emerald-500/30">
                  🖨️ Imprimir Ordem {ordemImpressao.codigoOrdem}
                </button>
              )}
            </div>
          </div>

          {/* O PDF DA ORDEM DE COMPRA (Invisível no app) */}
          {ordemImpressao && (
            <div id="pdf-ordem" className="hidden print:block bg-white p-8 border border-slate-300">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 uppercase tracking-widest">Ordem de Compra</h1>
                  <p className="text-slate-500 font-bold mt-2">HelpMkp E-commerce e Indústria</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-800">{ordemImpressao.codigoOrdem}</p>
                  <p className="text-sm font-bold text-slate-500">Data: {new Date(ordemImpressao.dataCompra).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                  <p className="font-bold text-slate-400 uppercase mb-1">Fornecedor</p>
                  <p className="font-black text-lg">{ordemImpressao.fornecedorNome}</p>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg text-right">
                  <p className="font-bold text-slate-400 uppercase mb-1">Condição de Pagamento</p>
                  <p className="font-black text-lg">Vencimento: {ordemImpressao.dataPagamento?.split('-').reverse().join('/')}</p>
                  <p className="font-bold text-slate-600">NF/Vale: {ordemImpressao.numeroVale || 'A definir'}</p>
                </div>
              </div>

              <table className="w-full text-left text-sm border-collapse mb-12">
                <thead><tr className="border-b border-slate-400 bg-slate-100 font-bold uppercase"><th className="p-3">Descrição do Item</th><th className="p-3 text-center">Quantidade</th><th className="p-3 text-right">Custo Un.</th><th className="p-3 text-right">Subtotal</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {ordemImpressao.itens.map(item => (
                    <tr key={item.produtoId}><td className="p-3 font-bold text-slate-700">{item.nome}</td><td className="p-3 text-center font-black">{item.quantidade} un</td><td className="p-3 text-right">R$ {item.custoUnitario.toFixed(2)}</td><td className="p-3 text-right font-black">R$ {item.subtotal.toFixed(2)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-slate-900"><td colSpan={3} className="p-3 text-right font-bold text-slate-500 uppercase">Valor Total do Pedido:</td><td className="p-3 text-right text-2xl font-black">R$ {ordemImpressao.valorTotal.toFixed(2)}</td></tr></tfoot>
              </table>

              <div className="border-t border-slate-300 pt-8 flex justify-between items-center">
                <div className="w-2/3">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-2">Bipe para dar entrada no sistema (Código de Barras)</p>
                  <img src={`https://barcode.orcascan.com/?type=code128&data=${ordemImpressao.codigoOrdem}`} alt="Barcode" className="h-16" />
                </div>
                <div className="w-1/3 text-right flex flex-col items-end">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-2">Ou QR Code</p>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${ordemImpressao.codigoOrdem}`} alt="QR Code" className="w-24 h-24" />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- ABA 2: RECEBER MERCADORIA PELO BIPE --- */}
      {abaAtiva === 'receber_bipe' && (
        <div className="max-w-4xl mx-auto space-y-6 no-print animate-fade-in">
          
          <div className="bg-emerald-900 p-8 rounded-3xl shadow-2xl border border-emerald-800 text-white text-center">
            <span className="text-5xl block mb-4 animate-bounce">🎯</span>
            <h3 className="text-2xl font-black mb-2">Bipe a Ordem de Compra</h3>
            <p className="text-emerald-300/80 mb-6 text-sm">Com o caminhão na porta, passe o leitor na folha do pedido ou digite o código abaixo.</p>
            
            <form onSubmit={lidarBipeEntrada} className="max-w-md mx-auto">
              <input 
                type="text" 
                placeholder="Ex: ORD-171829" 
                value={codigoBipe}
                onChange={(e) => setCodigoBipe(e.target.value)}
                className="w-full text-center px-4 py-5 bg-emerald-950 border-2 border-emerald-700 rounded-2xl outline-none focus:border-emerald-400 font-mono font-black tracking-widest text-2xl text-emerald-400 placeholder:text-emerald-800 shadow-inner"
                autoFocus
              />
            </form>
          </div>

          {ordemEmConferencia && (
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-fade-in">
              <div className="flex justify-between items-end border-b border-slate-200 pb-5 mb-6">
                <div>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 font-black text-[10px] rounded-lg uppercase tracking-widest">Aguardando Entrada</span>
                  <h3 className="text-2xl font-black text-slate-800 mt-2">{ordemEmConferencia.fornecedorNome}</h3>
                  <p className="text-slate-500 font-mono font-bold">{ordemEmConferencia.codigoOrdem}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase">Fatura</p>
                  <p className="text-2xl font-black text-rose-600">R$ {ordemEmConferencia.valorTotal.toFixed(2)}</p>
                </div>
              </div>

              <h4 className="font-bold text-slate-800 mb-4">Conferência Física:</h4>
              <div className="space-y-3 mb-8">
                {ordemEmConferencia.itens.map(item => (
                  <label key={item.produtoId} className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-colors ${itensConferidos[item.produtoId] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                    <input 
                      type="checkbox" 
                      className="w-6 h-6 accent-emerald-500" 
                      checked={itensConferidos[item.produtoId] || false}
                      onChange={(e) => setItensConferidos({...itensConferidos, [item.produtoId]: e.target.checked})}
                    />
                    <div className="flex-1">
                      <p className={`font-bold ${itensConferidos[item.produtoId] ? 'text-emerald-800' : 'text-slate-700'}`}>{item.nome}</p>
                      <p className="text-xs text-slate-500 font-bold">Confirme se chegaram <span className="text-slate-800 bg-slate-200 px-1 rounded">{item.quantidade} unidades</span>.</p>
                    </div>
                  </label>
                ))}
              </div>

              <button 
                onClick={confirmarEntradaNoSistema}
                disabled={!ordemEmConferencia.itens.every(i => itensConferidos[i.produtoId])}
                className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-2xl font-black text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/20"
              >
                📥 Confirmar Entrada no Sistema
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- ABA 3: LISTA DE FORNECEDORES --- */}
      {abaAtiva === 'lista' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start no-print">
          <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-bold text-slate-800 mb-5 border-b border-slate-100 pb-3">{idFornEdicao ? 'Editar' : 'Novo'} Fornecedor</h3>
            <form onSubmit={lidarSalvarFornecedor} className="space-y-4">
              <input type="text" required placeholder="Nome / Razão Social" value={nomeForn} onChange={(e) => setNomeForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input type="text" placeholder="Contato (WhatsApp)" value={contatoForn} onChange={(e) => setContatoForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input type="text" placeholder="Categoria (Ex: Borrachas, Caixas)" value={categoriaForn} onChange={(e) => setCategoriaForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <button type="submit" className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-bold">Salvar</button>
            </form>
          </div>
          <div className="w-full lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {fornecedores.map(forn => (
              <div key={forn.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start">
                  <h4 className="font-black text-lg">{forn.nome}</h4>
                  <button onClick={() => lidarExcluirFornecedor(forn.id)} className="text-rose-400 hover:text-rose-600">🗑️</button>
                </div>
                <p className="text-xs text-blue-600 font-bold mb-3 uppercase tracking-wider">{forn.categoriaInsumo || 'Geral'}</p>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2"><span>📱</span><p className="text-sm font-medium">{forn.contato || 'Sem contato'}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}