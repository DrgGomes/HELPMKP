import React, { useState } from 'react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

interface LoginProps {
  aoLogar: () => void;
}

export default function Login({ aoLogar }: LoginProps) {
  // 'login' para entrar, 'cadastro' para criar conta
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const lidarAutenticacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      if (modo === 'login') {
        // Realiza o login no Firebase
        await signInWithEmailAndPassword(auth, email, senha);
      } else {
        // Cria um novo usuário no Firebase
        await createUserWithEmailAndPassword(auth, email, senha);
      }
      // Se deu certo, avisa o sistema principal para abrir o painel
      aoLogar();
    } catch (err: any) {
      console.error(err);
      // Mensagens amigáveis para o usuário baseadas no erro do Firebase
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setErro('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErro('Este e-mail já está sendo utilizado por outra conta.');
      } else if (err.code === 'auth/weak-password') {
        setErro('A senha deve conter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setErro('Por favor, insira um e-mail válido.');
      } else {
        setErro('Ocorreu um erro inesperado. Tente novamente mais tarde.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-600 mb-2">HelpMkp</h1>
          <p className="text-gray-500 text-sm">
            {modo === 'login'
              ? 'Faça login para gerenciar suas margens'
              : 'Crie sua conta para começar a precificar'}
          </p>
        </div>

        {/* Alerta de Erro */}
        {erro && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
            ⚠️ {erro}
          </div>
        )}

        <form onSubmit={lidarAutenticacao} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              required
              disabled={carregando}
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              disabled={carregando}
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors mt-4 shadow-md disabled:bg-blue-400 flex justify-center items-center"
          >
            {carregando ? (
              <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
            ) : modo === 'login' ? (
              'Entrar no Sistema'
            ) : (
              'Criar Minha Conta'
            )}
          </button>
        </form>

        {/* Botão para alternar entre Login e Cadastro */}
        <div className="text-center mt-6 pt-6 border-t border-gray-100">
          <button
            type="button"
            disabled={carregando}
            onClick={() => {
              setModo(modo === 'login' ? 'cadastro' : 'login');
              setErro('');
            }}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none"
          >
            {modo === 'login'
              ? 'Não tem uma conta? Cadastre-se'
              : 'Já possui uma conta? Faça login'}
          </button>
        </div>
      </div>
    </div>
  );
}
