import { useState, useEffect } from 'react';
import type { Produto, Plataforma } from '../types';

interface DashboardProps {
  produtos: Produto[];
  plataformas: Plataforma[];
}

export default function Dashboard({ produtos, plataformas }: DashboardProps) {
  return (
    <div className="animate-fade-in">
      <header className="mb-6 md:mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
          Dashboard
        </h2>
        <p className="text-gray-500 mt-1">Visão geral da sua operação.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Produtos Cadastrados</p>
          <p className="text-3xl font-bold text-slate-800">{produtos.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Plataformas Configuradas</p>
          <p className="text-3xl font-bold text-blue-600">
            {plataformas.length}
          </p>
        </div>
      </div>
    </div>
  );
}
