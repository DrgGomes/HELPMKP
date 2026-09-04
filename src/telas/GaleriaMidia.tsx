import React, { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import type { Midia } from '../types';

interface GaleriaMidiaProps {
  midias: Midia[];
}

export default function GaleriaMidia({ midias }: GaleriaMidiaProps) {
  const IMGBB_API_KEY: string = '8452a49c251c1d2f8a93fe3b00e994d9';
  const [abaAtiva, setAbaAtiva] = useState<'galeria' | 'upload'>('galeria');
  const [modoUpload, setModoUpload] = useState<'arquivo' | 'link'>('arquivo');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previewsImagem, setPreviewsImagem] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [albumSelecionado, setAlbumSelecionado] = useState('');
  const [novoAlbum, setNovoAlbum] = useState('');
  const [processando, setProcessando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroAlbum, setFiltroAlbum] = useState('Todos');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [processandoLote, setProcessandoLote] = useState(false);

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  const albunsExistentes = useMemo(() => {
    const lista = midias.map(m => m.album).filter(Boolean);
    return Array.from(new Set(lista)).sort();
  }, [midias]);

  const midiasFiltradas = useMemo(() => {
    return midias.filter(m => {
      const matchBusca = m.titulo.toLowerCase().includes(busca.toLowerCase());
      const matchAlbum = filtroAlbum === 'Todos' || m.album === filtroAlbum;
      return matchBusca && matchAlbum;
    }).sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());
  }, [midias, busca, filtroAlbum]);

  const lidarMudancaArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const arquivosArray = Array.from(e.target.files);
      setArquivos(arquivosArray);
      const linksPreviews = arquivosArray.map(file => URL.createObjectURL(file));
      setPreviewsImagem(linksPreviews);
    }
  };

  const lidarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumSelecionado && !novoAlbum) return alert("Selecione ou crie um Álbum para organizar as mídias.");
    const userId = await getUserId();
    if (!userId) return;
    setProcessando(true);
    try {
      const albumFinal = novoAlbum.trim() !== '' ? novoAlbum.trim() : albumSelecionado;
      if (modoUpload === 'arquivo') {
        if (arquivos.length === 0) {
          setProcessando(false);
          return alert("Selecione as imagens.");
        }
        let contagemSucesso = 0;
        await Promise.all(arquivos.map(async (arquivoIndividual, index) => {
          try {
            const formData = new FormData();
            formData.append('image', arquivoIndividual);
            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
              method: 'POST',
              body: formData
            });
            const imgbbData = await imgbbResponse.json();
            if (!imgbbData.success) throw new Error("Erro");
            const urlDownload = imgbbData.data.url;
            const urlThumb = imgbbData.data.thumb?.url || imgbbData.data.url;
            const tituloFinal = arquivos.length > 1 && titulo ? `${titulo} (${index + 1})` : titulo || arquivoIndividual.name;
            const { error } = await supabase.from('midias').insert({
              user_id: userId,
              titulo: tituloFinal,
              url: urlDownload,
              url_thumb: urlThumb,
              album: albumFinal,
              data_criacao: new Date().toISOString(),
            });
            if (error) throw error;
            contagemSucesso++;
          } catch (uploadError) {
            console.error(uploadError);
          }
        }));
        alert(`✅ Concluído! ${contagemSucesso} imagens carregadas.`);
      } else {
        if (!url) {
          setProcessando(false);
          return alert("Cole a URL.");
        }
        const { error } = await supabase.from('midias').insert({
          user_id: userId,
          titulo: titulo || 'Sem Título',
          url: url,
          url_thumb: url,
          album: albumFinal,
          data_criacao: new Date().toISOString(),
        });
        if (error) throw error;
        alert("✅ Mídia salva com sucesso!");
      }
      setTitulo(''); setUrl(''); setNovoAlbum(''); setArquivos([]); setPreviewsImagem([]);
      setAbaAtiva('galeria');
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar.");
    } finally {
      setProcessando(false);
    }
  };

  const excluirMidia = async (id: string) => {
    const userId = await getUserId(); if (!userId) return;
    if (window.confirm("Remover permanentemente?")) {
      const { error } = await supabase.from('midias').delete().eq('id', id).eq('user_id', userId);
      if (error) { console.error(error); alert('Erro ao excluir.'); }
    }
  };

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert("🔗 Link copiado!");
  };

  const forcarDownload = async (link: string, nome: string) => {
    try {
      const response = await fetch(link);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${nome.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(link, '_blank');
    }
  };

  const selecionarTodasFiltradas = () => {
    setSelecionados(selecionados.length === midiasFiltradas.length ? [] : midiasFiltradas.map(m => m.id));
  };

  const baixarLoteSelecionadas = async () => {
    if (selecionados.length === 0) return;
    alert(`O download em lote de ${selecionados.length} imagens vai começar.`);
    setProcessandoLote(true);
    const midiasParaBaixar = midiasFiltradas.filter(m => selecionados.includes(m.id));
    for (let i = 0; i < midiasParaBaixar.length; i++) {
      const midia = midiasParaBaixar[i];
      try {
        const response = await fetch(midia.url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${midia.titulo.replace(/\s+/g, '_')}_${i + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        await new Promise(resolve => setTimeout(resolve, 400));
      } catch (e) {
        console.error(e);
      }
    }
    setProcessandoLote(false); setSelecionados([]); setModoSelecao(false);
  };

  const excluirLoteSelecionadas = async () => {
    if (selecionados.length === 0) return;
    const userId = await getUserId(); if (!userId) return;
    if (!window.confirm(`Excluir definitivamente ${selecionados.length} imagens?`)) return;
    setProcessandoLote(true);
    try {
      const { error } = await supabase.from('midias').delete().in('id', selecionados).eq('user_id', userId);
      if (error) throw error;
      setSelecionados([]); setModoSelecao(false);
    } catch (e) {
      console.error(e); alert('Erro ao excluir em lote.');
    }
    setProcessandoLote(false);
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3"><span>📸</span> Asset Manager</h2>
          <p className="text-slate-500 font-medium mt-1 text-xs sm:text-sm">Central de criativos de alta performance.</p>
        </div>
      </header>

      <div className="flex overflow-x-auto scrollbar-hide gap-2 border-b border-slate-200 pb-px -mx-4 px-4 sm:mx-0 sm:px-0">
        <button onClick={() => setAbaAtiva('galeria')} className={`whitespace-nowrap px-6 py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'galeria' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50'}`}><span>🖼️</span> Explorar Galeria</button>
        <button onClick={() => setAbaAtiva('upload')} className={`whitespace-nowrap px-6 py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'upload' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50'}`}><span>☁️</span> Carregamento em Massa</button>
      </div>

      {abaAtiva === 'upload' && (
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200 max-w-5xl flex flex-col lg:flex-row gap-10 animate-fade-in">
          <div className="flex-1 w-full min-w-0">
            <h3 className="font-black text-xl text-slate-800 mb-6 border-b border-slate-100 pb-4">Importação de Arquivos</h3>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 border border-slate-200 shadow-inner">
              <button type="button" onClick={() => { setModoUpload('arquivo'); setUrl(''); setPreviewsImagem([]); setArquivos([]); }} className={`flex-1 py-3.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 ${modoUpload === 'arquivo' ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>💻 Dispositivo</button>
              <button type="button" onClick={() => { setModoUpload('link'); setArquivos([]); setPreviewsImagem([]); }} className={`flex-1 py-3.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 ${modoUpload === 'link' ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>🔗 Link URL</button>
            </div>
            <form onSubmit={lidarUpload} className="space-y-6">
              {modoUpload === 'arquivo' && (
                <div className="animate-fade-in">
                  <label className="flex flex-col items-center justify-center w-full h-48 sm:h-56 border-2 border-indigo-300 border-dashed rounded-2xl cursor-pointer bg-indigo-50/50 hover:bg-indigo-50 transition-colors overflow-hidden">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                      <span className="text-5xl mb-2">📂</span>
                      <p className="mb-1 text-sm text-slate-600 font-bold"><span className="text-indigo-600">Clique para selecionar várias</span></p>
                      <p className="text-[10px] text-slate-400 font-black mt-1">{arquivos.length > 0 ? `🎉 ${arquivos.length} Preparadas` : 'Suporta lote de fotos'}</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={lidarMudancaArquivo} />
                  </label>
                </div>
              )}
              {modoUpload === 'link' && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">URL Absoluta da Mídia</label>
                  <input type="url" placeholder="https://..." value={url} onChange={(e) => { setUrl(e.target.value); setPreviewsImagem([e.target.value]); }} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Título Base</label>
                  <input type="text" placeholder="Nome do criativo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Álbum</label>
                  <select value={albumSelecionado} onChange={(e) => { setAlbumSelecionado(e.target.value); setNovoAlbum(''); }} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
                    <option value="">Selecionar...</option>
                    {albunsExistentes.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100">
                <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">Ou crie um Novo Álbum</label>
                <input type="text" placeholder="Ex: Coleção Inverno" value={novoAlbum} onChange={(e) => { setNovoAlbum(e.target.value); setAlbumSelecionado(''); }} className="w-full px-4 py-3.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold outline-none" />
              </div>
              <div className="pt-4">
                <button type="submit" disabled={processando || (modoUpload === 'arquivo' && arquivos.length === 0) || (modoUpload === 'link' && !url)} className="w-full py-4 sm:py-5 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs sm:text-sm rounded-xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {processando ? '🚀 Carregando lote...' : '☁️ Iniciar Carregamento'}
                </button>
              </div>
            </form>
          </div>
          <div className="hidden lg:flex w-80 flex-col justify-start border-l border-slate-100 pl-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Fila de Upload ({previewsImagem.length})</p>
            {previewsImagem.length > 0 ? (
              <div className="w-full grid grid-cols-2 gap-3 max-h-[450px] overflow-y-auto pr-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                {previewsImagem.map((src, i) => (
                  <div key={i} className="aspect-square bg-white rounded-xl border border-slate-200 p-1 overflow-hidden shadow-sm">
                    <img src={src} alt="Fila" className="w-full h-full object-cover rounded-lg" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full aspect-[4/5] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                <span className="text-5xl mb-2">👁️</span><span className="text-xs font-bold text-center">Fila vazia.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {abaAtiva === 'galeria' && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex-1">
                <input type="text" placeholder="🔍 Buscar imagem pelo nome..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none" />
              </div>
              <div className="sm:w-64">
                <select value={filtroAlbum} onChange={(e) => setFiltroAlbum(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none">
                  <option value="Todos">📦 Todos os Álbuns</option>
                  {albunsExistentes.map(a => <option key={a} value={a}>📁 {a}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }} className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl border shadow-sm transition-colors whitespace-nowrap ${modoSelecao ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-900 text-white'}`}>
              {modoSelecao ? '✕ Sair' : '📦 Seleção em Lote'}
            </button>
          </div>

          {modoSelecao && (
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row flex-wrap gap-4 items-center justify-between border border-slate-800">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <button onClick={selecionarTodasFiltradas} className="text-[10px] font-black uppercase tracking-widest bg-white/10 text-white px-4 py-2.5 rounded-xl border border-white/20">Marcar Tudo</button>
                <span className="text-sm font-black text-indigo-200 bg-black/20 px-3 py-1.5 rounded-lg">{selecionados.length} Selecionadas</span>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button onClick={excluirLoteSelecionadas} disabled={processandoLote || selecionados.length === 0} className="px-5 py-2.5 bg-rose-500 text-white font-black uppercase rounded-xl text-xs disabled:opacity-50">
                  {processandoLote ? '⏳' : '🗑️'} Excluir
                </button>
                <button onClick={baixarLoteSelecionadas} disabled={processandoLote || selecionados.length === 0} className="px-6 py-2.5 bg-blue-500 text-white font-black uppercase rounded-xl text-xs shadow-lg disabled:opacity-50">
                  {processandoLote ? '⏳ Baixando...' : '⬇️ Baixar Lote'}
                </button>
              </div>
            </div>
          )}

          {midiasFiltradas.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <span className="text-6xl mb-4 grayscale block opacity-40">📭</span><p className="text-xl font-black text-slate-400">Nenhuma mídia aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {midiasFiltradas.map((midia) => {
                const isSelected = selecionados.includes(midia.id);
                return (
                  <div key={midia.id} onClick={() => { if (modoSelecao) { if (isSelected) setSelecionados(selecionados.filter(id => id !== midia.id)); else setSelecionados([...selecionados, midia.id]); } }} className={`group relative bg-white rounded-2xl shadow-sm border overflow-hidden transition-all aspect-square sm:aspect-[4/5] flex flex-col ${modoSelecao ? 'cursor-pointer' : 'border-slate-200'} ${isSelected ? 'border-4 border-indigo-500 scale-[0.98]' : ''}`}>
                    {modoSelecao && (
                      <div className="absolute top-3 left-3 z-20"><input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 accent-indigo-600 rounded" /></div>
                    )}
                    <div className="flex-1 relative overflow-hidden bg-slate-100">
                      <img src={midia.url_thumb || midia.url} alt={midia.titulo} loading="lazy" className={`w-full h-full object-cover transition-transform duration-500 ${!modoSelecao ? 'group-hover:scale-110' : ''}`} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f5f9'/><text x='50%27' y='50%27' font-size='12' font-family='sans-serif' font-weight='bold' fill='%2394a3b8' text-anchor='middle' dy='.3em'>FOTO INDISPONÍVEL</text></svg>"; }} />
                      {!modoSelecao && (
                        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2.5 p-4">
                          <button onClick={(e) => { e.stopPropagation(); forcarDownload(midia.url, midia.titulo); }} className="w-full py-2.5 bg-emerald-500 text-slate-900 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl shadow-lg">⬇️ Baixar</button>
                          <button onClick={(e) => { e.stopPropagation(); copiarLink(midia.url); }} className="w-full py-2.5 bg-white/10 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl border border-white/20">🔗 Link</button>
                          <button onClick={(e) => { e.stopPropagation(); excluirMidia(midia.id); }} className="absolute top-3 right-3 w-8 h-8 bg-rose-500 text-white rounded-lg flex items-center justify-center">✕</button>
                        </div>
                      )}
                    </div>
                    <div className={`p-3 sm:p-4 border-t relative z-10 ${isSelected ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-100'}`}>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm truncate" title={midia.titulo}>{midia.titulo}</p>
                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1.5 truncate">📁 {midia.album}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}