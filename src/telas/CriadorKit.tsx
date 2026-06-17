import { useState } from 'react';

export default function CriadorKit({ produtosDisponiveis }: any) {
  const [selecionados, setSelecionados] = useState<any[]>([]);

  const custoTotal = selecionados.reduce((acc, p) => acc + p.custoTotal, 0);

  return (
    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl mt-8">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">📦 Criador de Kits Inteligentes</h2>
      <div className="space-y-2">
        {produtosDisponiveis.map((p: any) => (
          <div key={p.id} className="flex justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
            <span className="font-medium text-slate-200">{p.titulo}</span>
            <input 
              type="checkbox" 
              className="w-5 h-5 accent-blue-500"
              onChange={(e) => {
                if (e.target.checked) setSelecionados([...selecionados, p]);
                else setSelecionados(selecionados.filter((item) => item.id !== p.id));
              }} 
            />
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-slate-700">
        <p className="text-slate-400 text-sm">Custo base do kit (soma dos produtos):</p>
        <p className="text-2xl font-black text-white mt-1">R$ {custoTotal.toFixed(2)}</p>
        <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20">
          Precificar este Kit
        </button>
      </div>
    </div>
  );
}