import { useState } from 'react';
import type { Produto, Compra, LancamentoFinanceiro, CustoPadrao } from '../types';

interface BackupManagerProps {
  produtos: Produto[];
  compras: Compra[];
  lancamentos: LancamentoFinanceiro[];
  custosPadrao: CustoPadrao[];
}

export default function BackupManager({ produtos, compras, lancamentos, custosPadrao }: BackupManagerProps) {
  const [exportando, setExportando] = useState<string | null>(null);

  // Mecanismo de Download Nativo via Blob Chunks
  const dispararDownloadJSON = (dados: any, nomeArquivo: string) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(dados, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `${nomeArquivo}-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const executarBackupSet = (tipo: 'produtos' | 'compras' | 'caixa' | 'custos' | 'master') => {
    setExportando(tipo);
    
    setTimeout(() => {
      switch (tipo) {
        case 'produtos':
          dispararDownloadJSON(produtos, 'backup-matriz-produtos');
          break;
        case 'compras':
          dispararDownloadJSON(compras, 'backup-ordens-compra');
          break;
        case 'caixa':
          dispararDownloadJSON(lancamentos, 'backup-fluxo-caixa');
          break;
        case 'custos':
          dispararDownloadJSON(custosPadrao, 'backup-config-custos');
          break;
        case 'master':
          // Dump completo consolidado para clonar infraestrutura
          const masterDump = {
            versaoSaaS: "5.0",
            dataExportacao: new Date().toISOString(),
            produtos,
            compras,
            lancamentos,
            custosPadrao
          };
          dispararDownloadJSON(masterDump, 'master-dump-total');
          break;
      }
      setExportando(null);
    }, 600);
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8 pb-32">
      
      {/* HEADER DE ALTA INFRAESTRUTURA */}
      <header className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center gap-3.5 mb-2">
          <span className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-md text-xl">🛡️</span>
          <div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-transparent bg-clip-text">
              Central de Custódia e Backups
            </h2>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Data Management Module</p>
          </div>
        </div>
        <p className="text-slate-500 font-medium max-w-2xl mt-4 text-sm leading-relaxed">
          Exporte partições isoladas ou realize dumps completos do banco de dados para clonar a estrutura operacional em ambientes de homologação e testes de estresse.
        </p>
      </header>

      {/* GRID DE ISOLAMENTO DE BACKUPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD 1: PRODUTOS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-3xl">📦</span>
              <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                {produtos.length} registros
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-800">Catálogo de Produtos</h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
              Inclui tabelas de CPV (Custo de Fabricação), histórico de insumos dinâmicos vinculados, códigos de barras e metas de lucro salvas.
            </p>
          </div>
          <button
            onClick={() => executarBackupSet('produtos')}
            disabled={exportando !== null}
            className="mt-6 w-full py-3 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 hover:border-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40"
          >
            {exportando === 'produtos' ? '⚡ Compilando Chunks...' : 'Baixar Matriz (.json)'}
          </button>
        </div>

        {/* CARD 2: ORDENS DE COMPRA */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-3xl">🚚</span>
              <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                {compras.length} registros
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-800">Ordens de Compra e Vales</h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
              Estruturas completas de lotes recebidos, romaneios logísticos com datas de emissão, prazos de vencimento acordados e número de notas.
            </p>
          </div>
          <button
            onClick={() => executarBackupSet('compras')}
            disabled={exportando !== null}
            className="mt-6 w-full py-3 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 hover:border-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40"
          >
            {exportando === 'compras' ? '⚡ Compilando Chunks...' : 'Baixar Logística (.json)'}
          </button>
        </div>

        {/* CARD 3: FLUXO DE CAIXA */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-3xl">💸</span>
              <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                {lancamentos.length} registros
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-800">Entradas & Saídas (Extrato)</h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
              Histórico consolidado do livro caixa, conciliações de marketplaces, despesas fixas da fábrica e status de liquidação de boletos.
            </p>
          </div>
          <button
            onClick={() => executarBackupSet('caixa')}
            disabled={exportando !== null}
            className="mt-6 w-full py-3 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 hover:border-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40"
          >
            {exportando === 'caixa' ? '⚡ Compilando Chunks...' : 'Baixar Livro Caixa (.json)'}
          </button>
        </div>

        {/* CARD 4: CONFIGURAÇÕES E CUSTOS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-3xl">⚙️</span>
              <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                {custosPadrao.length} presets
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-800">Infraestrutura & Custos Padrão</h3>
            <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
              Backup operacional contendo configurações globais de embalagens, taxas de insumos base (como Impressão DTF) e pastas contábeis.
            </p>
          </div>
          <button
            onClick={() => executarBackupSet('custos')}
            disabled={exportando !== null}
            className="mt-6 w-full py-3 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 hover:border-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-40"
          >
            {exportando === 'custos' ? '⚡ Compilando Chunks...' : 'Baixar Presets (.json)'}
          </button>
        </div>

      </div>

      {/* MASTER DATA DUMP INTEGRAL */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-8 rounded-[2rem] shadow-2xl border border-indigo-500/20 flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-black uppercase tracking-wider rounded-md font-mono">
            Full Node Extraction
          </span>
          <h3 className="text-2xl font-black text-white mt-3">Master Dump Total Consolidado</h3>
          <p className="text-slate-400 text-xs font-medium mt-1 max-w-xl leading-relaxed">
            Gera um único arquivo master unificando as 4 partições acima. O arquivo definitivo para migrar dados entre contas e realizar simulações limpas sem poluir o ambiente ativo.
          </p>
        </div>
        <button
          onClick={() => executarBackupSet('master')}
          disabled={exportando !== null}
          className="w-full lg:w-auto px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/30 transition-all transform hover:scale-[1.03] disabled:opacity-40 whitespace-nowrap relative z-10"
        >
          {exportando === 'master' ? '🚀 Extraindo Core...' : '💾 Baixar Backup Geral (Completo)'}
        </button>
      </div>

    </div>
  );
}