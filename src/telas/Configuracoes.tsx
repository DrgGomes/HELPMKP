import React, { useState } from 'react';
import { supabase } from '../supabase';
import type { Plataforma } from '../types';

interface ConfiguracoesProps {
  plataformas: Plataforma[];
  setPlataformas?: (v: Plataforma[]) => void;
}

export default function Configuracoes({ plataformas, setPlataformas }: ConfiguracoesProps) {
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [comissao, setComissao] = useState('');
  const [comissaoAfiliado, setComissaoAfiliado] = useState('0');
  const [taxaFixa, setTaxaFixa] = useState('');
  const [freteFixo, setFreteFixo] = useState('');
  const [logo, setLogo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  const lidarSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;
    const userId = await getUserId();
    if (!userId) return;
    setSalvando(true);

    const dados = {
      nome,
      logo: logo || `https://ui-avatars.com/api/?name=${nome}&background=random`,
      comissao: parseFloat(comissao) || 0,
      comissao_afiliado: parseFloat(comissaoAfiliado) || 0,
      taxa_fixa: parseFloat(taxaFixa) || 0,
      frete_fixo: parseFloat(freteFixo) || 0,
    };

    try {
      if (idEdicao) {
        const { data, error } = await supabase.from('plataformas').update(dados).eq('id', idEdicao).eq('user_id', userId).select();
        if (error) throw error;
        if (data && setPlataformas) {
          setPlataformas(plataformas.map(p => p.id === idEdicao ? {
            ...p, nome: data[0].nome, logo: data[0].logo, comissao: Number(data[0].comissao),
            comissaoAfiliado: Number(data[0].comissao_afiliado), taxaFixa: Number(data[0].taxa_fixa), freteFixo: Number(data[0].frete_fixo)
          } : p));
        }
      } else {
        const { data, error } = await supabase.from('plataformas').insert({ ...dados, user_id: userId }).select();
        if (error) throw error;
        if (data && setPlataformas) {
          const nova: Plataforma = {
            id: data[0].id, nome: data[0].nome, logo: data[0].logo,
            comissao: Number(data[0].comissao), comissaoAfiliado: Number(data[0].comissao_afiliado),
            taxaFixa: Number(data[0].taxa_fixa), freteFixo: Number(data[0].frete_fixo)
          };
          setPlataformas([...plataformas, nova]);
        }
      }
      limparFormulario();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar a plataforma.');
    }
    setSalvando(false);
  };

  const iniciarEdicao = (plat: Plataforma) => {
    setIdEdicao(plat.id); setNome(plat.nome); setLogo(plat.logo);
    setComissao(plat.comissao.toString()); setComissaoAfiliado(plat.comissaoAfiliado.toString());
    setTaxaFixa(plat.taxaFixa.toString()); setFreteFixo(plat.freteFixo.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => {
    setIdEdicao(null); setNome(''); setLogo(''); setComissao('');
    setComissaoAfiliado('0'); setTaxaFixa(''); setFreteFixo('');
  };

  const excluirPlataforma = async (id: string) => {
    const userId = await getUserId();
    if (!userId || !window.confirm("Excluir esta plataforma?")) return;
    try {
      const { error } = await supabase.from('plataformas').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      if (setPlataformas) setPlataformas(plataformas.filter(p => p.id !== id));
    } catch (error) {
      console.error(error); alert('Erro ao excluir.');
    }
  };

  const gerarBackup = async () => {
    const userId = await getUserId();
    if (!userId) return;
    try {
      const tabelas = ['plataformas', 'produtos', 'custos_padrao', 'categorias', 'categorias_despesas', 'fornecedores', 'lancamentos', 'compras', 'midias'];
      const dadosBackup: Record<string, any[]> = {};
      for (const tabela of tabelas) {
        const { data, error } = await supabase.from(tabela).select('*').eq('user_id', userId);
        if (error) throw error;
        dadosBackup[tabela] = data || [];
      }
      const backupFinal = { timestamp: new Date().toISOString(), dados: dadosBackup };
      const blob = new Blob([JSON.stringify(backupFinal, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COFRE_HELPMKP_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar o backup.");
    }
  };

  const restaurarBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm("⚠️ ALERTA: Isso vai SOBRESCREVER o seu banco de dados atual com as informações do arquivo. Tem certeza absoluta?")) {
      event.target.value = '';
      return;
    }
    const userId = await getUserId();
    if (!userId) return;
    try {
      const leitor = new FileReader();
      leitor.onload = async (e) => {
        try {
          const conteudo = e.target?.result as string;
          const backupRestaurado = JSON.parse(conteudo);
          if (!backupRestaurado.dados) throw new Error("Arquivo de backup inválido.");
          let operacoes = 0;
          for (const [nomeTabela, itens] of Object.entries(backupRestaurado.dados)) {
            const arrItens = itens as any[];
            if (arrItens.length === 0) continue;
            const itensComUserId = arrItens.map(item => {
              const { id, ...rest } = item;
              return { ...rest, user_id: userId };
            });
            const { error } = await supabase.from(nomeTabela).upsert(itensComUserId);
            if (error) console.warn(`Erro ao restaurar tabela ${nomeTabela}:`, error.message);
            else operacoes += itensComUserId.length;
          }
          if (operacoes > 0) {
            alert(`✅ Restauração Concluída! ${operacoes} registros foram salvos. Recarregue a página.`);
            window.location.reload();
          } else {
            alert("O arquivo de backup estava vazio.");
          }
        } catch (err) {
          console.error(err);
          alert("Erro ao ler o arquivo. Tem certeza que é um backup do HelpMkp?");
        }
      };
      leitor.readAsText(file);
    } catch (error) {
      console.error(error);
      alert("Erro catastrófico ao restaurar.");
    }
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2"><span>⚙️</span> Ajustes Globais & Cofre</h2>
        <p className="text-slate-500 mt-1">Configure suas taxas de venda e proteja os dados do seu sistema.</p>
      </header>

      {/* COFRE DE DADOS */}
      <div className="bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-800 text-white flex flex-col lg:flex-row gap-8 items-center justify-between">
        <div className="lg:w-1/2">
          <h3 className="text-2xl font-black text-emerald-400 mb-2 flex items-center gap-2"><span>🛡️</span> Cofre de Dados (Backup)</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Baixe uma cópia completa de segurança de <strong>todos</strong> os seus produtos, finanças, compras e fornecedores.
          </p>
          <button onClick={gerarBackup} className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-black rounded-xl transition-all shadow-lg shadow-emerald-600/30">
            💾 Baixar Cópia de Segurança (.json)
          </button>
        </div>
        <div className="w-px h-32 bg-slate-800 hidden lg:block"></div>
        <div className="lg:w-1/2 bg-slate-950 p-6 rounded-2xl border border-rose-900/30 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-600"></div>
          <h4 className="font-bold text-rose-500 mb-2 uppercase tracking-widest text-xs">Zona de Risco - Restaurar</h4>
          <p className="text-slate-500 text-xs mb-4">Subir um arquivo de backup irá sobrescrever as informações atuais do sistema. Use com extrema cautela.</p>
          <label className="block text-center px-6 py-3 border-2 border-dashed border-slate-700 hover:border-rose-500 rounded-xl cursor-pointer transition-colors">
            <span className="font-bold text-slate-300">📂 Clique para Subir Arquivo de Backup</span>
            <input type="file" accept=".json" onChange={restaurarBackup} className="hidden" />
          </label>
        </div>
      </div>

      {/* PLATAFORMAS */}
      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>🛍️</span> Canais de Venda (Marketplaces)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* FORM */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="font-bold text-slate-800 mb-4">{idEdicao ? 'Editar' : 'Nova'} Plataforma</h3>
            <form onSubmit={lidarSalvar} className="space-y-4">
              <input type="text" required placeholder="Nome (Ex: Mercado Livre)" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-blue-400" />
              <input type="url" placeholder="URL da Logo (Opcional)" value={logo} onChange={(e) => setLogo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-xs" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comissão Base (%)</label><input type="number" step="0.01" value={comissao} onChange={(e) => setComissao(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comissão Afiliado (%)</label><input type="number" step="0.01" value={comissaoAfiliado} onChange={(e) => setComissaoAfiliado(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none text-blue-600" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Taxa Fixa (R$)</label><input type="number" step="0.01" value={taxaFixa} onChange={(e) => setTaxaFixa(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none text-rose-600" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Frete Fixo (R$)</label><input type="number" step="0.01" value={freteFixo} onChange={(e) => setFreteFixo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none text-rose-600" /></div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={salvando} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black shadow-md disabled:opacity-50">{salvando ? 'Salvando...' : (idEdicao ? 'Salvar' : 'Adicionar')}</button>
                {idEdicao && <button type="button" onClick={limparFormulario} className="px-4 bg-slate-200 text-slate-700 rounded-xl font-bold">Cancelar</button>}
              </div>
            </form>
          </div>

          {/* LISTA */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plataformas.length === 0 ? <div className="sm:col-span-2 lg:col-span-3 bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400 font-bold">Nenhum canal de venda cadastrado.</div> : (
              plataformas.map(plat => (
                <div key={plat.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group flex flex-col">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button onClick={() => iniciarEdicao(plat)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">✏️</button>
                    <button onClick={() => excluirPlataforma(plat.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100">🗑️</button>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <img src={plat.logo} alt={plat.nome} className="w-10 h-10 rounded-lg border border-slate-100 object-cover" />
                    <h4 className="font-black text-slate-800 leading-tight truncate">{plat.nome}</h4>
                  </div>
                  <div className="space-y-2 mt-auto">
                    <div className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg"><span className="font-bold text-slate-500">Taxa Global</span><span className="font-black text-slate-800">{(plat.comissao + plat.comissaoAfiliado).toFixed(1)}%</span></div>
                    {(plat.taxaFixa > 0 || plat.freteFixo > 0) && (
                      <div className="flex justify-between items-center text-xs bg-rose-50 p-2 rounded-lg border border-rose-100"><span className="font-bold text-rose-600">Custos Fixos</span><span className="font-black text-rose-700">+R$ {(plat.taxaFixa + plat.freteFixo).toFixed(2)}</span></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}