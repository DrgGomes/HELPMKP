import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Perfil() {
  const [emailUsuario, setEmailUsuario] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    const buscarUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmailUsuario(user.email);
    };
    buscarUser();
  }, []);

  const lidarRedefinicaoSenha = async () => {
    if (!emailUsuario) return;
    setCarregando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailUsuario);
      if (error) throw error;
      setMensagem({ tipo: 'sucesso', texto: 'E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada.' });
    } catch (error: any) {
      setMensagem({ tipo: 'erro', texto: error.message || 'Ocorreu um erro ao tentar enviar o e-mail. Tente novamente mais tarde.' });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Seu Perfil</h2>
        <p className="text-slate-500 mt-1 text-sm md:text-base">Gerencie as informações da sua conta corporativa.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center text-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-500/20 mb-4">
            {emailUsuario ? emailUsuario.charAt(0).toUpperCase() : 'U'}
          </div>
          <h3 className="font-bold text-slate-800 text-lg max-w-full truncate">{emailUsuario}</h3>
          <span className="mt-1.5 px-3 py-1 bg-slate-100 text-slate-600 font-semibold text-xs rounded-full border border-slate-200 uppercase tracking-wider">Plano Enterprise</span>
        </div>

        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Dados Cadastrais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail de Acesso</label>
                <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium text-sm">{emailUsuario}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Plano</label>
                <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium text-sm">Enterprise 5.0</div>
              </div>
            </div>
          </div>

          {mensagem.texto && (
            <div className={`p-3.5 rounded-lg text-sm font-medium ${mensagem.tipo === 'sucesso' ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' : 'bg-red-50 border border-red-200 text-red-600'}`}>{mensagem.texto}</div>
          )}

          <div>
            <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Segurança</h3>
            <button onClick={lidarRedefinicaoSenha} disabled={carregando} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2">
              {carregando ? <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span> : null}
              {carregando ? 'Enviando...' : '🔑 Redefinir Senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}