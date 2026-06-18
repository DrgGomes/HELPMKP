import { useState } from 'react';
import { doc, addDoc, collection, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { LancamentoFinanceiro } from '../types';

interface FinanceiroProps {
  lancamentos: LancamentoFinanceiro[];
}

export default function Financeiro({ lancamentos }: FinanceiroProps) {
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('Geral');

  const lidarSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor) return;
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;

    await addDoc(collection(db, 'usuarios', userId, 'lancamentos'), {
      tipo,
      descricao,
      valor: parseFloat(valor),
      dataVencimento,
      status: 'pendente',
      categoria
    });

    setDescricao(''); setValor('');
  };

  const alternarStatus = async (lanc: LancamentoFinanceiro) => {
    const userId = auth.currentUser?.uid as string;
    if (!userId) return;
    await updateDoc(doc(db, 'usuarios', userId, 'lancamentos', lanc.id), {
      status: lanc.status === 'pago' ? 'pendente' : 'pago'
    });
  };

  const excluirLancamento = async (id: string) => {
    const userId = auth.currentUser?.uid as string;
    if (userId && window.confirm("Excluir este registro?")) await deleteDoc(doc(db, 'usuarios', userId, 'lancamentos', id));
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>💰</span> Fluxo de Caixa</h2>
        <p className="text-slate-500 mt-1">Gerencie suas Contas a Pagar e a Receber.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
          <h3 className="font-bold text-slate-800 mb-4">Novo Lançamento</h3>
          <form onSubmit={lidarSalvar} className="space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button type="button" onClick={() => setTipo('despesa')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'despesa' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Despesa</button>
              <button type="button" onClick={() => setTipo('receita')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'receita' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Receita</button>
            </div>
            <input type="text" required placeholder="Descrição (Ex: Boleto Fornecedor X)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="number" required step="0.01" placeholder="Valor R$" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
              <input type="text" placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" />
            </div>
            <button type="submit" className={`w-full py-3 rounded-xl font-black text-white transition-all ${tipo === 'despesa' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>Lançar no Caixa</button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Próximos Vencimentos</h3>
            {lancamentos.length === 0 ? <p className="text-slate-400 text-sm">Nenhum lançamento no caixa.</p> : (
              <div className="space-y-3">
                {lancamentos.sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()).map(lanc => (
                  <div key={lanc.id} className={`flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border ${lanc.status === 'pago' ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${lanc.tipo === 'despesa' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                        <p className={`font-bold ${lanc.status === 'pago' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{lanc.descricao}</p>
                      </div>
                      <p className="text-xs text-slate-500">Vence: {lanc.dataVencimento.split('-').reverse().join('/')} • {lanc.categoria}</p>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <span className={`font-black text-lg ${lanc.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}`}>R$ {lanc.valor.toFixed(2)}</span>
                      <button onClick={() => alternarStatus(lanc)} className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${lanc.status === 'pago' ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}>
                        {lanc.status === 'pago' ? '✅ Liquidado' : '💳 Pagar/Receber'}
                      </button>
                      <button onClick={() => excluirLancamento(lanc.id)} className="text-rose-400 hover:text-rose-600">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}