import React, { useState, useMemo } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Fornecedor, Produto, Compra, ItemCompra } from '../types';

interface FornecedoresProps {
  fornecedores: Fornecedor[];
  produtos: Produto[];
  compras: Compra[];
}

export default function Fornecedores({ fornecedores, produtos, compras }: FornecedoresProps) {
  const [abaAtiva, setAbaAtiva] = useState<'lista' | 'nova_compra'>('nova_compra');

  // --- ESTADOS DE FORNECEDORES ---
  const [idFornEdicao, setIdFornEdicao] = useState<string | null>(null);
  const [nomeForn, setNomeForn] = useState('');
  const [contatoForn, setContatoForn] = useState('');
  const [categoriaForn, setCategoriaForn] = useState('');

  // --- ESTADOS DO CARRINHO DE COMPRAS RÁPIDO ---
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCompra[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');

  // Salvar Fornecedor
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
    if (userId && window.confirm("Excluir este fornecedor?")) await deleteDoc(doc(db, 'usuarios', userId, 'fornecedores', id));
  };

  // --- LÓGICA DO CARRINHO DE COMPRAS RÁPIDO ---
  const adicionarAoCarrinho = () => {
    if (!produtoSelecionado) return;
    const prodRef = produtos.find(p => p.id === produtoSelecionado);
    if (!prodRef) return;
    
    // Se já estiver no carrinho, ignora
    if (carrinho.some(item => item.produtoId === prodRef.id)) return;

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

  const finalizarCompra = async () => {
    if (!fornecedorSelecionado || carrinho.length === 0) return alert("Selecione um fornecedor e adicione itens!");
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    const forn = fornecedores.find(f => f.id === fornecedorSelecionado);
    
    const novaCompra: Partial<Compra> = {
      fornecedorId: fornecedorSelecionado,
      fornecedorNome: forn?.nome || 'Desconhecido',
      dataCompra: new Date().toISOString(),
      itens: carrinho,
      valorTotal: totalCompra,
      statusPagamento: 'pago' // Depois podemos criar a tela de Contas a Pagar
    };

    try {
      await addDoc(collection(db, 'usuarios', userId, 'compras'), novaCompra);
      alert("Entrada de estoque registrada com sucesso no Fluxo de Caixa!");
      setCarrinho([]);
      setFornecedorSelecionado('');
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2"><span>🏭</span> Compras & Fornecedores</h2>
          <p className="text-slate-500 mt-1 text-sm">Registre entradas de material rapidamente para alimentar seu fluxo de caixa.</p>
        </div>
      </header>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button onClick={() => setAbaAtiva('nova_compra')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'nova_compra' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>🛒 Lançar Entrada (Rápido)</button>
        <button onClick={() => setAbaAtiva('lista')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all ${abaAtiva === 'lista' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>📋 Cadastros & Histórico</button>
      </div>

      {abaAtiva === 'nova_compra' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* LADO ESQUERDO: SELEÇÃO E CARRINHO */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-4">1. Dados do Pedido</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fornecedor</label>
                  <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione quem está vendendo...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Buscar Produto / Insumo</label>
                  <div className="flex gap-2">
                    <select value={produtoSelecionado} onChange={(e) => setProdutoSelecionado(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Buscar no estoque...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo} (R$ {p.custoBase.toFixed(2)})</option>)}
                    </select>
                    <button onClick={adicionarAoCarrinho} className="px-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xl shadow-md">+</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]">
              <h3 className="text-lg font-black text-slate-800 mb-4">2. Itens da Nota / Entrada</h3>
              {carrinho.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl"><span className="text-3xl mb-2">🛒</span><p className="font-medium text-sm">Adicione produtos acima para começar.</p></div>
              ) : (
                <div className="space-y-3">
                  {carrinho.map(item => (
                    <div key={item.produtoId} className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex-1 w-full"><p className="font-bold text-slate-800 text-sm truncate">{item.nome}</p></div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Qtd</span>
                          <input type="number" min="1" value={item.quantidade} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'quantidade', parseInt(e.target.value) || 0)} className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-lg text-center font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Custo Un. (R$)</span>
                          <input type="number" step="0.01" value={item.custoUnitario} onChange={(e) => atualizarItemCarrinho(item.produtoId, 'custoUnitario', parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-center font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex flex-col text-right ml-2 min-w-[80px]">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</span>
                          <span className="font-black text-slate-700">R$ {item.subtotal.toFixed(2)}</span>
                        </div>
                        <button onClick={() => removerDoCarrinho(item.produtoId)} className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg font-bold hover:bg-rose-100 ml-2">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: FECHAMENTO */}
          <div className="bg-slate-900 p-6 rounded-2xl shadow-xl h-fit sticky top-6 text-white border border-slate-800">
            <h3 className="text-lg font-black text-white mb-6 border-b border-slate-700 pb-4">3. Resumo Financeiro</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm text-slate-400"><p>Total de Itens:</p><p className="font-bold text-white">{carrinho.reduce((acc, i) => acc + i.quantidade, 0)} un</p></div>
              <div className="flex justify-between text-sm text-slate-400"><p>Fornecedor:</p><p className="font-bold text-white truncate max-w-[150px]">{fornecedorSelecionado ? fornecedores.find(f => f.id === fornecedorSelecionado)?.nome : '---'}</p></div>
            </div>

            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Total a Pagar</p>
              <p className="text-3xl font-black text-emerald-400">R$ {totalCompra.toFixed(2)}</p>
            </div>

            <button onClick={finalizarCompra} disabled={carrinho.length === 0 || !fornecedorSelecionado} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-black text-lg transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed">
              Registrar Compra
            </button>
          </div>
        </div>
      )}

      {abaAtiva === 'lista' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{idFornEdicao ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
            <form onSubmit={lidarSalvarFornecedor} className="space-y-4">
              <div><input type="text" required placeholder="Nome / Razão Social" value={nomeForn} onChange={(e) => setNomeForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><input type="text" placeholder="Contato (WhatsApp / Email)" value={contatoForn} onChange={(e) => setContatoForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><input type="text" placeholder="Ex: Tecidos, Couro, Ferragens" value={categoriaForn} onChange={(e) => setCategoriaForn(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">Salvar Cadastro</button>
            </form>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Seus Fornecedores</h3>
            {fornecedores.length === 0 ? <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">Nenhum fornecedor cadastrado.</div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fornecedores.map(forn => (
                  <div key={forn.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors relative group">
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button onClick={() => { setIdFornEdicao(forn.id); setNomeForn(forn.nome); setContatoForn(forn.contato); setCategoriaForn(forn.categoriaInsumo); }} className="p-1 bg-slate-100 text-slate-600 rounded">✏️</button>
                      <button onClick={() => lidarExcluirFornecedor(forn.id)} className="p-1 bg-rose-50 text-rose-600 rounded">🗑️</button>
                    </div>
                    <h4 className="font-black text-slate-800 text-lg mb-1">{forn.nome}</h4>
                    <p className="text-xs text-slate-500 font-bold mb-3">{forn.categoriaInsumo || 'Geral'}</p>
                    <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-2"><span>📱</span> {forn.contato || 'Sem contato'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}