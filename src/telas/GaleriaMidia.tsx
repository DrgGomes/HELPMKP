import React, { useState, useMemo } from 'react';
import { collection, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Midia } from '../types';

interface GaleriaMidiaProps {
  midias: Midia[];
}

export default function GaleriaMidia({ midias }: GaleriaMidiaProps) {
  const [abaAtiva, setAbaAtiva] = useState<'galeria' | 'upload'>('galeria');
  
  // Estados de Upload
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [albumSelecionado, setAlbumSelecionado] = useState('');
  const [novoAlbum, setNovoAlbum] = useState('');
  const [processando, setProcessando] = useState(false);

  // Estados de Filtro
  const [busca, setBusca] = useState('');
  const [filtroAlbum, setFiltroAlbum] = useState('Todos');

  // Extrai álbuns únicos das mídias cadastradas
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

  const lidarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || (!albumSelecionado && !novoAlbum)) return alert("Preencha a URL e defina um Álbum.");
    const userId = auth.currentUser?.uid; if (!userId) return;

    setProcessando(true);
    try {
      const albumFinal = novoAlbum.trim() !== '' ? novoAlbum.trim() : albumSelecionado;
      
      await addDoc(collection(db, 'usuarios', userId, 'midias'), {
        titulo: titulo || 'Sem Título',
        url: url,
        album: albumFinal,
        dataCriacao: new Date().toISOString()
      });

      alert("🖼️ Mídia salva com sucesso na galeria!");
      setTitulo(''); setUrl(''); setNovoAlbum(''); setAbaAtiva('galeria');
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar a imagem.");
    }
    setProcessando(false);
  };

  const excluirMidia = async (id: string) => {
    const userId = auth.currentUser?.uid; if (!userId) return;
    if (window.confirm("Remover esta imagem da galeria?")) {
      await deleteDoc(doc(db, 'usuarios', userId, 'midias', id));
    }
  };

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert("🔗 Link copiado! Pronto para colar no e-commerce.");
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
      // Fallback em caso de bloqueio CORS da imagem original
      window.open(link, '_blank');
    }
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-32">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span>📸</span> Asset Manager
          </h2>
          <p className="text-slate-500 font-medium mt-1 text-xs sm:text-sm">Central de criativos, fotos de produtos e banners de campanhas.</p>
        </div>
      </header>

      {/* ABAS */}
      <div className="flex overflow-x-auto scrollbar-hide gap-2 border-b border-slate-200 pb-px -mx-4 px-4 sm:mx-0 sm:px-0">
        <button onClick={() => setAbaAtiva('galeria')} className={`whitespace-nowrap px-6 py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'galeria' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
          <span>🖼️</span> Explorar Galeria
        </button>
        <button onClick={() => setAbaAtiva('upload')} className={`whitespace-nowrap px-6 py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'upload' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
          <span>☁️</span> Novo Upload / Link
        </button>
      </div>

      {abaAtiva === 'upload' && (
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200 max-w-3xl animate-fade-in">
          <h3 className="font-black text-xl text-slate-800 mb-6 border-b border-slate-100 pb-4">Importar Mídia</h3>
          
          <form onSubmit={lidarUpload} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">URL da Imagem (Link Direto)</label>
              <input type="url" required placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Título / Identificação</label>
                <input type="text" placeholder="Ex: Banners TikTok Promo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Álbum Existente</label>
                <select value={albumSelecionado} onChange={(e) => { setAlbumSelecionado(e.target.value); setNovoAlbum(''); }} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors">
                  <option value="">Selecionar...</option>
                  {albunsExistentes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
              <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">Ou crie um Novo Álbum</label>
              <input type="text" placeholder="Ex: Fotos Calçados Paris" value={novoAlbum} onChange={(e) => { setNovoAlbum(e.target.value); setAlbumSelecionado(''); }} className="w-full px-4 py-3.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" />
            </div>

            <div className="pt-4">
              <button type="submit" disabled={processando} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50">
                {processando ? 'Salvando...' : '💾 Salvar no Servidor'}
              </button>
            </div>
          </form>

          {url && (
            <div className="mt-8 border-t border-slate-100 pt-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Preview da Imagem</p>
              <div className="w-full h-64 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center">
                <img src={url} alt="Preview" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            </div>
          )}
        </div>
      )}

      {abaAtiva === 'galeria' && (
        <div className="animate-fade-in space-y-6">
          
          {/* BARRA DE FILTROS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input type="text" placeholder="🔍 Buscar imagem..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
            </div>
            <div className="sm:w-64">
              <select value={filtroAlbum} onChange={(e) => setFiltroAlbum(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                <option value="Todos">📦 Todos os Álbuns</option>
                {albunsExistentes.map(a => <option key={a} value={a}>📁 {a}</option>)}
              </select>
            </div>
          </div>

          {midiasFiltradas.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <span className="text-6xl mb-4 grayscale block opacity-40">📭</span>
              <p className="text-xl font-black text-slate-400">Nenhuma mídia encontrada neste álbum.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {midiasFiltradas.map((midia) => (
                <div key={midia.id} className="group relative bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all aspect-square sm:aspect-[4/5] flex flex-col">
                  
                  {/* IMAGEM COM MÁSCARA HOVER */}
                  <div className="flex-1 relative overflow-hidden bg-slate-100">
                    <img src={midia.url} alt={midia.titulo} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    
                    {/* OVERLAY DE AÇÕES (Aparece ao passar o mouse ou focar) */}
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-4">
                      <button onClick={() => forcarDownload(midia.url, midia.titulo)} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                        ⬇️ Baixar Imagem
                      </button>
                      <button onClick={() => copiarLink(midia.url)} className="w-full py-2.5 bg-white/20 hover:bg-white/30 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl border border-white/20 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75">
                        🔗 Copiar Link URL
                      </button>
                      <button onClick={() => excluirMidia(midia.id)} className="absolute top-2 right-2 w-8 h-8 bg-rose-500/80 hover:bg-rose-500 text-white rounded-lg flex items-center justify-center shadow-lg backdrop-blur-md">
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* INFO DO RODAPÉ DA IMAGEM */}
                  <div className="p-3 sm:p-4 bg-white border-t border-slate-100 relative z-10">
                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate" title={midia.titulo}>{midia.titulo}</p>
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1 truncate">📁 {midia.album}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}