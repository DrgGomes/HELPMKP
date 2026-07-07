import React, { useState, useMemo } from 'react';
import { collection, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../firebase';
import type { Midia } from '../types';

interface GaleriaMidiaProps {
  midias: Midia[];
}

export default function GaleriaMidia({ midias }: GaleriaMidiaProps) {
  const [abaAtiva, setAbaAtiva] = useState<'galeria' | 'upload'>('galeria');
  
  // --- ESTADOS DE UPLOAD DUAL-MODE ---
  const [modoUpload, setModoUpload] = useState<'arquivo' | 'link'>('arquivo');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewImagem, setPreviewImagem] = useState<string>('');
  
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

  const lidarMudancaArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setArquivo(file);
      setPreviewImagem(URL.createObjectURL(file));
    }
  };

  const lidarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumSelecionado && !novoAlbum) return alert("Selecione ou crie um Álbum para organizar a imagem.");
    
    const userId = auth.currentUser?.uid; 
    if (!userId) return;

    setProcessando(true);
    try {
      let urlFinal = '';

      if (modoUpload === 'arquivo') {
        if (!arquivo) {
          setProcessando(false);
          return alert("Selecione uma imagem do seu dispositivo.");
        }
        // Injeta a imagem fisicamente no Firebase Storage
        const storage = getStorage(auth.app);
        const extensao = arquivo.name.split('.').pop();
        const nomeSeguro = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extensao}`;
        const arquivoRef = ref(storage, `usuarios/${userId}/midias/${nomeSeguro}`);
        
        await uploadBytes(arquivoRef, arquivo);
        urlFinal = await getDownloadURL(arquivoRef);
      } else {
        if (!url) {
          setProcessando(false);
          return alert("Cole a URL da imagem.");
        }
        urlFinal = url;
      }

      const albumFinal = novoAlbum.trim() !== '' ? novoAlbum.trim() : albumSelecionado;
      
      // Salva o registro no banco de dados (Firestore)
      await addDoc(collection(db, 'usuarios', userId, 'midias'), {
        titulo: titulo || (modoUpload === 'arquivo' && arquivo ? arquivo.name : 'Sem Título'),
        url: urlFinal,
        album: albumFinal,
        dataCriacao: new Date().toISOString()
      });

      alert("🖼️ Mídia salva com sucesso na galeria!");
      
      // Limpar formulário
      setTitulo(''); setUrl(''); setNovoAlbum(''); setArquivo(null); setPreviewImagem('');
      setAbaAtiva('galeria');

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('unauthorized')) {
        alert("Erro de Permissão: O Storage do Firebase não está ativado ou as regras de segurança estão bloqueando. Ative o Storage no painel do Firebase.");
      } else {
        alert("Erro ao salvar a imagem. Tente novamente.");
      }
    }
    setProcessando(false);
  };

  const excluirMidia = async (id: string) => {
    const userId = auth.currentUser?.uid; if (!userId) return;
    if (window.confirm("Remover esta imagem da galeria permanentemente?")) {
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

      {/* ABAS DESLIZANTES MOBILE-FRIENDLY */}
      <div className="flex overflow-x-auto scrollbar-hide gap-2 border-b border-slate-200 pb-px -mx-4 px-4 sm:mx-0 sm:px-0">
        <button onClick={() => setAbaAtiva('galeria')} className={`whitespace-nowrap px-6 py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'galeria' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
          <span>🖼️</span> Explorar Galeria
        </button>
        <button onClick={() => setAbaAtiva('upload')} className={`whitespace-nowrap px-6 py-4 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 flex items-center gap-2 ${abaAtiva === 'upload' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
          <span>☁️</span> Novo Upload / Arquivo
        </button>
      </div>

      {/* ABA DE UPLOAD */}
      {abaAtiva === 'upload' && (
        <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-200 max-w-4xl animate-fade-in flex flex-col lg:flex-row gap-10">
          
          <div className="flex-1">
            <h3 className="font-black text-xl text-slate-800 mb-6 border-b border-slate-100 pb-4">Importar Mídia</h3>
            
            {/* SELETOR DE MODO DE UPLOAD */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 border border-slate-200 shadow-inner">
              <button 
                onClick={() => { setModoUpload('arquivo'); setUrl(''); setPreviewImagem(arquivo ? URL.createObjectURL(arquivo) : ''); }} 
                className={`flex-1 py-3.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 ${modoUpload === 'arquivo' ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                💻 Enviar Dispositivo
              </button>
              <button 
                onClick={() => { setModoUpload('link'); setArquivo(null); setPreviewImagem(url); }} 
                className={`flex-1 py-3.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 ${modoUpload === 'link' ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🔗 Colar Link URL
              </button>
            </div>

            <form onSubmit={lidarUpload} className="space-y-6">
              
              {/* MODO 1: UPLOAD DE ARQUIVO FÍSICO */}
              {modoUpload === 'arquivo' && (
                <div className="animate-fade-in">
                  <label className="flex flex-col items-center justify-center w-full h-48 sm:h-56 border-2 border-indigo-300 border-dashed rounded-2xl cursor-pointer bg-indigo-50/50 hover:bg-indigo-50 transition-colors overflow-hidden relative">
                    {previewImagem ? (
                      <div className="absolute inset-0 w-full h-full bg-slate-900/10 flex items-center justify-center p-2">
                        <img src={previewImagem} alt="Preview" className="w-full h-full object-contain drop-shadow-md rounded-xl" />
                        <div className="absolute bottom-3 bg-slate-900/80 text-white px-3 py-1.5 rounded-lg backdrop-blur-md text-[10px] font-black uppercase tracking-widest">Trocar Arquivo</div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                        <span className="text-5xl sm:text-6xl mb-3 opacity-80">📱</span>
                        <p className="mb-1 text-sm text-slate-600 font-bold"><span className="text-indigo-600">Toque para selecionar</span> ou arraste a foto</p>
                        <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest font-black mt-2">JPEG, PNG ou WEBP</p>
                      </div>
                    )}
                    <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={lidarMudancaArquivo} />
                  </label>
                </div>
              )}

              {/* MODO 2: LINK DIRETO */}
              {modoUpload === 'link' && (
                <div className="animate-fade-in">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">URL da Imagem (Hospedagem Externa)</label>
                  <input type="url" placeholder="https://..." value={url} onChange={(e) => { setUrl(e.target.value); setPreviewImagem(e.target.value); }} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Identificação / Título</label>
                  <input type="text" placeholder="Ex: Banner Camiseta 01" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Álbum Existente</label>
                  <select value={albumSelecionado} onChange={(e) => { setAlbumSelecionado(e.target.value); setNovoAlbum(''); }} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors">
                    <option value="">Selecionar...</option>
                    {albunsExistentes.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100">
                <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">Ou crie um Novo Álbum</label>
                <input type="text" placeholder="Ex: Catálogo Inverno" value={novoAlbum} onChange={(e) => { setNovoAlbum(e.target.value); setAlbumSelecionado(''); }} className="w-full px-4 py-3.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-colors" />
              </div>

              <div className="pt-4">
                <button type="submit" disabled={processando || (modoUpload === 'arquivo' && !arquivo) || (modoUpload === 'link' && !url)} className="w-full py-4 sm:py-5 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs sm:text-sm rounded-xl shadow-xl transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2">
                  {processando ? (
                    <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> Enviando Nuvem...</>
                  ) : (
                    <><span>☁️</span> Salvar na Galeria</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* PAINEL DE PREVIEW DE MÍDIA LATERAL (DESKTOP) */}
          <div className="hidden lg:flex w-72 flex-col justify-start border-l border-slate-100 pl-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pré-visualização</p>
            {previewImagem ? (
              <div className="w-full aspect-[4/5] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner p-2">
                <img src={previewImagem} alt="Preview" className="w-full h-full object-contain rounded-xl drop-shadow-sm" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            ) : (
              <div className="w-full aspect-[4/5] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                <span className="text-6xl mb-2">👁️</span>
                <span className="text-xs font-bold px-4 text-center">Aguardando seleção...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA DE GALERIA */}
      {abaAtiva === 'galeria' && (
        <div className="animate-fade-in space-y-6">
          
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
                  
                  <div className="flex-1 relative overflow-hidden bg-slate-100">
                    <img src={midia.url} alt={midia.titulo} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    
                    {/* AÇÕES (Aparece no Desktop no Hover, ou ao clicar no celular) */}
                    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-4">
                      <button onClick={() => forcarDownload(midia.url, midia.titulo)} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex items-center justify-center gap-1.5">
                        <span className="text-sm">⬇️</span> Baixar Imagem
                      </button>
                      <button onClick={() => copiarLink(midia.url)} className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl border border-white/20 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75 flex items-center justify-center gap-1.5">
                        <span className="text-sm">🔗</span> Copiar URL
                      </button>
                      <button onClick={() => excluirMidia(midia.id)} className="absolute top-3 right-3 w-8 h-8 bg-rose-500 hover:bg-rose-600 text-white rounded-lg flex items-center justify-center shadow-lg transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="p-3 sm:p-4 bg-white border-t border-slate-100 relative z-10">
                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate" title={midia.titulo}>{midia.titulo}</p>
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1.5 truncate flex items-center gap-1">
                      <span className="opacity-70">📁</span> {midia.album}
                    </p>
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