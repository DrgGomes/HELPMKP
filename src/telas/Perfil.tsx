import React, { useState } from 'react';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function Perfil() {
  const usuario = auth.currentUser;
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  const lidarRedefinicaoSenha = async () => {
    if (!usuario?.email) return;
    setCarregando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      await sendPasswordResetEmail(auth, usuario.email);
      setMensagem({
        tipo: 'sucesso',
        texto:
          'E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada.',
      });
    } catch (error) {
      setMensagem({
        tipo: 'erro',
        texto:
          'Ocorreu um erro ao tentar enviar o e-mail. Tente novamente mais tarde.',
      });
    }
    {
      setCarregando(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
          Seu Perfil
        </h2>
        <p className="text-slate-500 mt-1 text-sm md:text-base">
          Gerencie as informações da sua conta corporativa.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card de Avatar Tecnológico */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center text-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-500/20 mb-4">
            {usuario?.email ? usuario.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <h3 className="font-bold text-slate-800 text-lg max-w-full truncate">
            {usuario?.email}
          </h3>
          <span className="mt-1.5 px-3 py-1 bg-slate-100 text-slate-600 font-semibold text-xs rounded-full border border-slate-200 uppercase tracking-wider">
            Plano Enterprise
          </span>
        </div>

        {/* Card de Informações e Segurança */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              Dados Cadastrais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  E-mail de Acesso
                </label>
                <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium text-sm">
                  {usuario?.email}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Identificador Único (UID)
                </label>
                <div
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 font-mono text-xs truncate"
                  title={usuario?.uid}
                >
                  {usuario?.uid}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">
              Segurança da Conta
            </h3>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              Para alterar sua senha de acesso, clique no botão abaixo. Um link
              de redefinição segura será enviado diretamente para a sua caixa de
              e-mail cadastrada.
            </p>

            {mensagem.texto && (
              <div
                className={`mb-4 p-4 rounded-xl text-sm font-semibold border ${
                  mensagem.tipo === 'sucesso'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {mensagem.tipo === 'sucesso' ? '✨ ' : '⚠️ '} {mensagem.texto}
              </div>
            )}

            <button
              onClick={lidarRedefinicaoSenha}
              disabled={carregando}
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {carregando ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              ) : (
                'Solicitar Alteração de Senha'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
