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
  const [idFornEdicao, setIdFornEdicao] = useState<string | null>(null);
  const [nomeForn, setNomeForn] = useState('');
  const [contatoForn, setContatoForn] = useState('');
  const [categoriaForn, setCategoriaForn] = useState('');

  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCompra[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');

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

  const adicionarAoCarrinho = () => {
    if (!produtoSelecionado) return;
    const prodRef = produtos.find(p => p.id === produtoSelecionado);
    if (!prodRef || carrinho.some(item => item.produtoId === prodRef.id)) return;

    setCarrinho([...carrinho, { produtoId: prodRef.id, nome: prodRef.titulo, quantidade: 1, custoUnitario: prodRef.custoBase, subtotal: prodRef.custoBase }]);
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

  const finalizarCompra = async () => {
    if (!fornecedorSelecionado || carrinho.length === 0) return alert("Selecione fornecedor e itens!");
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;
    const forn = fornecedores.find(f => f.id === fornecedorSelecionado);
    
    try {
      // 1. ATUALIZA O ESTOQUE DOS PRODUTOS
      for (const item of carrinho) {
        const prodAtual = produtos.find(p => p.id === item.produtoId);
        const novoEstoque = (prodAtual?.estoque || 0) + item.quantidade;
        await updateDoc(doc(db, 'usuarios', userId, 'produtos', item.produtoId), { estoque: novoEstoque });
      }

      // 2. LANÇA A CONTA A PAGAR NO CAIXA
      await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), {
        tipo: 'despesa',
        descricao: `Compra: ${forn?.nome} (${carrinho.reduce((a, b) => a + b.quantidade, 0)} itens)`,
        valor: totalCompra,
        dataVencimento: new Date().toISOString().split('T')[0], // Sugere vencimento para hoje
        status: 'pendente',
        categoria: 'Fornecedores'
      });

      alert("Entrada Registrada! Estoque atualizado e fatura enviada ao Contas a Pagar.");
      setCarrinho([]); setFornecedorSelecionado('');
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
      <header className="mb-2">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>🏭</span> Compras & Fornecedores</h2>
        <p className="text-slate-500 mt-1">Lançou aqui, o estoque sobe e a conta a pagar é gerada automaticamente.</p>
      </header>
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button onClick={() => setAbaAtiva('nova_compra')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'nova_compra' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>🛒 Lançar Entrada (Rápido)</button>
        <button onClick={() => setAbaAtiva('lista')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'lista' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>📋 Fornecedores</button>
      </div>

      {abaAtiva === 'nova_compra' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-4">1. Dados do Pedido</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"><option value="">Selecione o Fornecedor...</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
                <div className="flex gap-2"><select value={produtoSelecionado} onChange={(e) => setProdutoSelecionado(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"><option value="">Buscar Insumo/Produto...</option>{produtos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select><button onClick={adicionarAoCarrinho} className="px-5 bg-blue-600 text-white font-black rounded-xl">+</button></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]">
              <h3 className="text-lg font-black text-slate-800 mb-4">2. Itens da Entrada</h3>
              {carrinho.length === 0 ? <p className="text-center text-slate-400 mt-10">Carrinho vazio.</p> : (
                <div className="space-y-3">
                  {carrinho.map(item => (
                    <div key={item.produtoId} className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex-1"><p className="font-bold text-sm truncate">{item.nome}</p></div>
                      <div className="flex items-center gap-3">
                        <input type="number" min="1" value={item.quantidade} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'quantidade', parseInt(e.target.value) || 0)} className="w-20 px-3 py-2 border rounded-lg text-center font-bold" title="Quantidade" />
                        <input type="number" step="0.01" value={item.custoUnitario} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'custoUnitario', parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 border rounded-lg text-center font-bold" title="Custo Unitário" />
                        <span className="font-black w-24 text-right">R$ {item.subtotal.toFixed(2)}</span>
                        <button onClick={() => removerDoCarrinho(item.produtoId)} className="text-rose-500 font-bold ml-2">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl shadow-xl h-fit sticky top-6 text-white border border-slate-800">
            <h3 className="text-lg font-black mb-6 border-b border-slate-700 pb-4">3. Resumo</h3>
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase">Valor Total a Pagar</p>
              <p className="text-3xl font-black text-emerald-400">R$ {totalCompra.toFixed(2)}</p>
            </div>
            <button onClick={finalizarCompra} disabled={carrinho.length === 0 || !fornecedorSelecionado} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black text-lg disabled:opacity-50">Registrar Compra</button>
          </div>
        </div>
      )}

      {abaAtiva === 'lista' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 h-fit">
            <h3 className="font-bold mb-4">{idFornEdicao ? 'Editar' : 'Novo'} Fornecedor</h3>
            <form onSubmit={lidarSalvarFornecedor} className="space-y-4">
              <input type="text" required placeholder="Nome / Razão Social" value={nomeForn} onChange={(e) => setNomeForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input type="text" placeholder="Contato (WhatsApp)" value={contatoForn} onChange={(e) => setContatoForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input type="text" placeholder="Ex: Borrachas, Caixas" value={categoriaForn} onChange={(e) => setCategoriaForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">Salvar</button>
            </form>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fornecedores.map(forn => (
              <div key={forn.id} className="bg-white p-5 rounded-2xl border border-slate-200 relative group">
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button onClick={() => { setIdFornEdicao(forn.id); setNomeForn(forn.nome); setContatoForn(forn.contato); setCategoriaForn(forn.categoriaInsumo); }} className="p-1 bg-slate-100 rounded">✏️</button>
                  <button onClick={() => lidarExcluirFornecedor(forn.id)} className="p-1 bg-rose-50 rounded">🗑️</button>
                </div>
                <h4 className="font-black text-lg mb-1">{forn.nome}</h4>
                <p className="text-xs text-slate-500 font-bold mb-3">{forn.categoriaInsumo || 'Geral'}</p>
                <p className="text-sm bg-slate-50 p-2 rounded-lg border">{forn.contato || 'Sem contato'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}