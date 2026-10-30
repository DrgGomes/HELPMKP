        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-fade-in print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Calendário Drag & Drop</h3>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200"><button onClick={() => setModoArrastar('vencimento')} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${modoArrastar === 'vencimento' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>Alvo: Vencimento</button><button onClick={() => setModoArrastar('emissao')} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${modoArrastar === 'emissao' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>Alvo: Emissão</button></div>
              <div className="flex gap-2 bg-slate-900 p-1.5 rounded-2xl shadow-lg border border-slate-800"><button onClick={() => mudarMesCal(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">◀</button><h3 className="text-sm font-black text-white w-32 text-center uppercase tracking-widest self-center">{new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'short' })} {calAno}</h3><button onClick={() => mudarMesCal(1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">▶</button></div>
            </div>
          </div>
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200"><div className="min-w-[900px]">
            <div className="grid grid-cols-7 bg-slate-900 text-white overflow-hidden">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="p-4 text-center text-xs font-black uppercase tracking-widest">{d}</div>)}</div>
            <div className="grid grid-cols-7 bg-slate-50">
              {diasCalendario.map((dataStr, index) => {
                if (!dataStr) return <div key={`e-${index}`} className="bg-slate-100 border-r border-b border-slate-200 min-h-[140px]"></div>;
                const faturasDoDia = lancamentosDoCalendario.filter(l => (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)) === dataStr);
                const isHoje = dataStr === new Date().toISOString().split('T')[0];
                return (
                  <div key={dataStr} onDragOver={lidarDragOver} onDrop={(e) => lidarDrop(e, dataStr)} className={`min-h-[140px] p-2 border-r border-b border-slate-200 transition-colors hover:bg-blue-50/50 ${isHoje ? 'bg-indigo-50/30' : 'bg-white'}`}>
                    <p className={`text-xs font-black mb-2 flex justify-between ${isHoje ? 'text-indigo-600' : 'text-slate-400'}`}><span>{parseInt(dataStr.split('-')[2])}</span> {isHoje && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>}</p>
                    <div className="space-y-1.5">{faturasDoDia.map(fat => (
                      <div key={fat.id} draggable onDragStart={(e) => lidarDragStart(e, fat.id)} className={`p-1.5 text-[10px] rounded-lg shadow-sm cursor-grab border ${fat.status === 'pago' ? 'opacity-40 grayscale' : ''} ${fat.tipo === 'despesa' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                        <p className="truncate font-bold mb-0.5">{fat.descricao}</p><p className="font-black font-mono tracking-tight">R$ {fat.valor.toFixed(2)}</p>
                      </div>
                    ))}</div>
                  </div>
                );
              })}
            </div>
          </div></div>
          <div className="mt-8 flex flex-col md:flex-row justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Resumo: {new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'long' })}</p>
            <div className="flex gap-8 relative z-10">
              <div className="text-right"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Receitas (+)</p><p className="font-black text-white text-2xl font-mono">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'receita' && (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)).startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
              <div className="w-px bg-slate-800"></div>
              <div className="text-right"><p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Despesas (-)</p><p className="font-black text-white text-2xl font-mono">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'despesa' && (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)).startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
            </div>
          </div>
        </div>
      )}

      <div id="relatorio-financeiro-pdf" className="hidden print:block w-full bg-white text-slate-900">
        <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-8">
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Extrato Financeiro</h1>
            <p className="text-slate-500 font-bold mt-2 text-sm">Documento Extraído: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Receitas Validadas</p>
              <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight">R$ {resumoFiltrado.receitas.toFixed(2)}</p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saídas Processadas</p>
              <p className="text-2xl font-black text-rose-600 font-mono tracking-tight">R$ {resumoFiltrado.despesas.toFixed(2)}</p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Líquido</p>
              <p className={`text-2xl font-black font-mono tracking-tight ${resumoFiltrado.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {resumoFiltrado.saldo.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Data Emissão</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Data Venc.</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Descrição da Transação</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Centro de Custo</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Status</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px] text-right">Valor Operado</th>
            </tr>
          </thead>
          <tbody>
            {lancamentosFiltrados.map(l => (
              <tr key={l.id} className="border-b border-slate-200">
                <td className="p-3 font-mono">{l.dataLancamento ? l.dataLancamento.split('-').reverse().join('/') : '---'}</td>
                <td className="p-3 font-mono font-bold">{l.dataVencimento.split('-').reverse().join('/')}</td>
                <td className="p-3 font-bold text-slate-800">{l.descricao}</td>
                <td className="p-3 text-slate-500">{l.categoria}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${l.status === 'pago' ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-600'}`}>{l.status}</span></td>
                <td className={`p-3 text-right font-black font-mono text-lg ${l.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}`}>{l.tipo === 'despesa' ? '-' : '+'} R$ {l.valor.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compraModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-center items-center p-4 animate-fade-in no-print">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl"></div>
              <div className="relative z-10"><p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Detalhes do Vale</p><h3 className="text-3xl font-black tracking-tight">{compraModal.codigoOrdem}</h3></div>
              <button onClick={() => setCompraModal(null)} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full font-black text-xl flex items-center justify-center transition-colors relative z-10">✕</button>
            </div>
            <div className="p-8 overflow-y-auto"><div className="grid grid-cols-2 gap-6 mb-8 border-b border-slate-100 pb-8"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fornecedor</p><p className="font-black text-slate-800 text-xl">{compraModal.fornecedorNome}</p></div><div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NF / Vale Relacionado</p><p className="font-black text-slate-800 text-xl font-mono">{compraModal.numeroVale || 'N/A'}</p></div></div>
              <div className="space-y-3 mb-6">{compraModal.itens.map(item => (<div key={item.produtoId} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100"><div><p className="font-black text-slate-800">{item.nome}</p><p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{item.quantidade} UN x R$ {item.custoUnitario.toFixed(2)}</p></div><span className="font-black text-slate-900 text-lg font-mono tracking-tight">R$ {item.subtotal.toFixed(2)}</span></div>))}</div>
            </div>
            <div className="bg-slate-50 p-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-6 mt-auto"><button onClick={() => excluirValeInteiro(compraModal.id)} className="px-6 py-3 text-rose-600 hover:text-white bg-white hover:bg-rose-600 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-widest transition-colors w-full sm:w-auto">🗑️ Excluir Vale Completo</button><div className="text-center sm:text-right w-full sm:w-auto"><p className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-1">Total do Vale</p><p className="text-4xl font-black text-slate-900 font-mono tracking-tight">R$ {compraModal.valorTotal.toFixed(2)}</p></div></div>
          </div>
        </div>
      )}
    </div>
  );
}
