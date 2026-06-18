import React, { useState } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Fornecedor, Produto, ItemCompra } from '../types';

interface FornecedoresProps {
  fornecedores: Fornecedor[];
  produtos: Produto[];
}

export default function Fornecedores({ fornecedores, produtos }: FornecedoresProps) {
  const [abaAtiva, setAbaAtiva] = useState<'lista' | 'nova_compra'>('nova_compra');
  
  // Estados de Fornecedores
  const [idFornEdicao, setIdFornEdicao] = useState<string | null>(null);
  const [nomeForn, setNomeForn] = useState('');
  const [contatoForn, setContatoForn] = useState('');
  const [categoriaForn, setCategoriaForn] = useState('');

  // Estados do Carrinho
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCompra[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');
  
  // Estados: Financeiro da Compra
  const [numeroVale, setNumeroVale] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);

  // --- FUNÇÕES DE FORNECEDORES ---
  const lidarSalvarFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeForn) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    const dados = { nome: nomeForn, contato: contatoForn, categoriaInsumo: categoriaForn };
    try {
      if (idFornEdicao) await setDoc(doc(db, 'usuarios', userId, 'fornecedores', idFornEdicao), dados);
      else await addDoc(collection(db, 'usuarios', userId, 'fornecedores'), dados);
      setIdFornEdicao(null); setNomeForn(''); setContatoForn(''); setCategoriaForn('');
    } catch (error) { console.error(error); }
  };

  const lidarExcluirFornecedor = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Excluir fornecedor?")) await deleteDoc(doc(db, 'usuarios', userId, 'fornecedores', id));
  };

  // --- FUNÇÕES DE CARRINHO ---
  const adicionarAoCarrinho = () => {
    if (!produtoSelecionado) return;
    const prodRef = produtos.find(p => p.id === produtoSelecionado);
    if (!prodRef || carrinho.some(item => item.produtoId === prodRef.id)) return;

    setCarrinho([...carrinho, { 
      produtoId: prodRef.id, 
      nome: prodRef.titulo, 
      quantidade: 1, 
      custoUnitario: prodRef.custoBase, 
      subtotal: prodRef.custoBase 
    }]);
    setProdutoSelecionado('');
  };

  const atualizarItemCarrinho = (id: string, campo: 'quantidade' | 'custoUnitario', valor: number) => {
    setCarrinho(carrinho.map(item => {
      if (item.produtoId === id) {
        const novoItem = { ...item, [campo]: valor };
        novoItem.subtotal = novoItem.quantidade * novoItem.custoUnitario;
        return novoItem;
      }
      return item;
    }));
  };

  const removerDoCarrinho = (id: string) => setCarrinho(carrinho.filter(item => item.produtoId !== id));
  const totalCompra = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

  // --- FINALIZAR COMPRA ---
  const finalizarCompra = async () => {
    if (!fornecedorSelecionado || carrinho.length === 0) return alert("Selecione fornecedor e adicione itens!");
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;
    const forn = fornecedores.find(f => f.id === fornecedorSelecionado);
    
    try {
      for (const item of carrinho) {
        const prodAtual = produtos.find(p => p.id === item.produtoId);
        const novoEstoque = (prodAtual?.estoque || 0) + item.quantidade;
        await updateDoc(doc(db, 'usuarios', userId, 'produtos', item.produtoId), { estoque: novoEstoque });
      }

      await addDoc(collection(db, 'usuarios', userId, 'compras'), {
        fornecedorId: fornecedorSelecionado,
        fornecedorNome: forn?.nome || 'Desconhecido',
        dataCompra: new Date().toISOString(),
        dataPagamento: dataPagamento,
        numeroVale: numeroVale,
        itens: carrinho,
        valorTotal: totalCompra,
        statusPagamento: 'pendente'
      });

      await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), {
        tipo: 'despesa',
        descricao: `Material: ${forn?.nome} ${numeroVale ? `(Vale: ${numeroVale})` : ''}`,
        valor: totalCompra,
        dataVencimento: dataPagamento,
        status: 'pendente',
        categoria: 'Fornecedores'
      });

      alert("Entrada registrada! Estoque atualizado e fatura lançada no Contas a Pagar.");
      
      setCarrinho([]); 
      setFornecedorSelecionado('');
      setNumeroVale('');
      setDataPagamento(new Date().toISOString().split('T')[0]);
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8">
      <header className="mb-4">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>🏭</span> Compras & Fornecedores</h2>
        <p className="text-slate-500 mt-1">Cadastre compras, suba o estoque e gere contas a pagar num só clique.</p>
      </header>

      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button onClick={() => setAbaAtiva('nova_compra')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'nova_compra' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>🛒 Lançar Entrada (Rápido)</button>
        <button onClick={() => setAbaAtiva('lista')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'lista' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>📋 Cadastrar Fornecedores</button>
      </div>

      {abaAtiva === 'nova_compra' && (
        // ESTRUTURA BLINDADA COM CSS GRID
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          
          {/* COLUNA ESQUERDA: Formulários e Carrinho (Ocupa 7 ou 8 colunas de 12) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
            
            {/* Bloco 1: Fornecedor e Produto */}
            <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-5 border-b border-slate-100 pb-3">1. Dados Básicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fornecedor</label>
                  <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 truncate">
                    <option value="">Selecione quem está vendendo...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Buscar Insumo / Produto</label>
                  <div className="flex gap-2">
                    <select value={produtoSelecionado} onChange={(e) => setProdutoSelecionado(e.target.value)} className="flex-1 min-w-0 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 truncate">
                      <option value="">Buscar no estoque...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                    </select>
                    <button onClick={adicionarAoCarrinho} className="shrink-0 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xl shadow-md transition-colors">+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 2: Itens do Carrinho */}
            <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[250px]">
              <h3 className="text-lg font-black text-slate-800 mb-5 border-b border-slate-100 pb-3">2. Itens da Entrada (Quantidade e Valor Pago)</h3>
              {carrinho.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-32 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"><span className="text-3xl mb-2">🛒</span><p className="font-medium text-sm">Adicione produtos acima para começar a preencher.</p></div>
              ) : (
                <div className="space-y-4">
                  {carrinho.map(item => (
                    <div key={item.produtoId} className="flex flex-col xl:flex-row xl:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative pr-10 xl:pr-14">
                      <div className="flex-1 min-w-0"><p className="font-bold text-slate-800 text-base truncate">{item.nome}</p></div>
                      
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
                        <div className="flex flex-col w-20 sm:w-24 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Qtd.</span>
                          <input type="number" min="1" value={item.quantidade} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'quantidade', parseInt(e.target.value) || 0)} className="w-full px-2 sm:px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-center font-black text-sm sm:text-lg outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" />
                        </div>
                        <div className="flex flex-col w-28 sm:w-32 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Custo Un. (R$)</span>
                          <input type="number" step="0.01" value={item.custoUnitario} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'custoUnitario', parseFloat(e.target.value) || 0)} className="w-full px-2 sm:px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-center font-bold text-sm sm:text-lg outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" />
                        </div>
                        <div className="flex flex-col text-right min-w-[90px] ml-auto">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Subtotal</span>
                          <span className="font-black text-slate-800 text-lg sm:text-xl">R$ {item.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <button onClick={() => removerDoCarrinho(item.produtoId)} className="absolute right-2 sm:right-3 top-4 xl:top-1/2 xl:-translate-y-1/2 w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-600 rounded-lg font-bold hover:bg-rose-200 transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco 3: Dados de Pagamento */}
            <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-5 border-b border-slate-100 pb-3 flex items-center gap-2"><span>💳</span> 3. Informações de Pagamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Número do Vale / Nota</label>
                  <input type="text" placeholder="Ex: Vale 140 / NF 9081" value={numeroVale} onChange={(e) => setNumeroVale(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 truncate" />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Data p/ Pagamento</label>
                  <input type="date" required value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA: Resumo Financeiro (Ocupa 5 ou 4 colunas de 12) */}
          <div className="lg:col-span-5 xl:col-span-4 bg-slate-900 p-6 rounded-2xl shadow-xl h-fit lg:sticky lg:top-6 text-white border border-slate-800 w-full min-w-0">
            <h3 className="text-xl font-black mb-6 border-b border-slate-700 pb-4">Resumo Final</h3>
            
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-6 shadow-inner text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Valor Total a Pagar</p>
              <p className="text-4xl font-black text-emerald-400 truncate">R$ {totalCompra.toFixed(2)}</p>
            </div>

            <div className="space-y-3 mb-8 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              <div className="flex justify-between text-sm text-slate-300"><p>Itens no carrinho:</p><p className="font-bold text-white">{carrinho.reduce((acc, i) => acc + i.quantidade, 0)} un</p></div>
              <div className="flex justify-between text-sm text-slate-300"><p>Data Quitação:</p><p className="font-bold text-white">{dataPagamento.split('-').reverse().join('/')}</p></div>
            </div>

            <button 
              onClick={finalizarCompra} 
              disabled={carrinho.length === 0 || !fornecedorSelecionado} 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black text-lg transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Registrar no Fluxo
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-4 px-2">Ao registrar, o estoque será atualizado e a conta enviada ao setor financeiro.</p>
          </div>

        </div>
      )}

      {abaAtiva === 'lista' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-in">
          <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-bold text-slate-800 mb-5 border-b border-slate-100 pb-3">{idFornEdicao ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
            <form onSubmit={lidarSalvarFornecedor} className="space-y-4">
              <input type="text" required placeholder="Nome / Razão Social" value={nomeForn} onChange={(e) => setNomeForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="Contato (WhatsApp)" value={contatoForn} onChange={(e) => setContatoForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="Categoria (Ex: Borrachas, Caixas)" value={categoriaForn} onChange={(e) => setCategoriaForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-bold transition-all shadow-md">Salvar Cadastro</button>
            </form>
          </div>
          
          <div className="w-full lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {fornecedores.length === 0 ? (
               <div className="md:col-span-2 bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">Nenhum fornecedor cadastrado ainda.</div>
            ) : (
              fornecedores.map(forn => (
                <div key={forn.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-blue-300 transition-all">
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button onClick={() => { setIdFornEdicao(forn.id); setNomeForn(forn.nome); setContatoForn(forn.contato); setCategoriaForn(forn.categoriaInsumo); }} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">✏️</button>
                    <button onClick={() => lidarExcluirFornecedor(forn.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100">🗑️</button>
                  </div>
                  <h4 className="font-black text-slate-800 text-lg mb-1 pr-16 truncate">{forn.nome}</h4>
                  <p className="text-xs text-blue-600 font-bold mb-3 uppercase tracking-wider">{forn.categoriaInsumo || 'Geral'}</p>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2">
                    <span>📱</span><p className="text-sm font-medium text-slate-600">{forn.contato || 'Sem contato'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}