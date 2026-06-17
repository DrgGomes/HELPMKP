import React, { useState, useMemo } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { Produto, Plataforma, CustoAdicional } from '../types';

interface ProdutosProps {
  telaAtiva: string;
  setTelaAtiva: (tela: string) => void;
  produtos: Produto[];
  plataformas: Plataforma[];
}

export default function Produtos({
  telaAtiva,
  setTelaAtiva,
  produtos,
  plataformas,
}: ProdutosProps) {
  const [buscaProduto, setBuscaProduto] = useState('');
  const [filtroPlataforma, setFiltroPlataforma] = useState('todas');

  const [idProdEdicao, setIdProdEdicao] = useState<string | null>(null);
  const [fotoProd, setFotoProd] = useState('');
  const [tituloProd, setTituloProd] = useState('');
  const [custoBaseProd, setCustoBaseProd] = useState('');
  const [custosAdicionais, setCustosAdicionais] = useState<CustoAdicional[]>(
    []
  );
  const [tipoLucro, setTipoLucro] = useState<'porcentagem' | 'reais'>('reais');
  const [valorLucro, setValorLucro] = useState('');

  const adicionarCustoExtra = () =>
    setCustosAdicionais([
      ...custosAdicionais,
      { id: Date.now().toString(), nome: '', valor: 0 },
    ]);
  const atualizarCustoExtra = (
    id: string,
    campo: 'nome' | 'valor',
    novoValor: string
  ) => {
    setCustosAdicionais(
      custosAdicionais.map((c) =>
        c.id === id
          ? {
              ...c,
              [campo]:
                campo === 'valor' ? parseFloat(novoValor) || 0 : novoValor,
            }
          : c
      )
    );
  };
  const removerCustoExtra = (id: string) =>
    setCustosAdicionais(custosAdicionais.filter((c) => c.id !== id));

  const calcularCustoTotalAoVivo = () => {
    const base = parseFloat(custoBaseProd) || 0;
    const extras = custosAdicionais.reduce(
      (acc, curr) => acc + (parseFloat(curr.valor.toString()) || 0),
      0
    );
    return base + extras;
  };

  const lidarSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tituloProd || !custoBaseProd || !valorLucro) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const baseFormatada = parseFloat(custoBaseProd);
    const extrasFormatados: CustoAdicional[] = custosAdicionais
      .filter((c) => c.nome.trim() !== '')
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        valor: parseFloat(c.valor.toString()) || 0,
      }));

    const total =
      baseFormatada +
      extrasFormatados.reduce((acc, curr) => acc + curr.valor, 0);

    const dadosProduto = {
      foto:
        fotoProd ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          tituloProd
        )}&background=e2e8f0&color=475569&size=150`,
      titulo: tituloProd,
      custoBase: baseFormatada,
      custosAdicionais: extrasFormatados,
      custoTotal: total,
      tipoLucro,
      valorLucro: parseFloat(valorLucro),
    };

    try {
      if (idProdEdicao) {
        const docRef = doc(db, 'usuarios', userId, 'produtos', idProdEdicao);
        await setDoc(docRef, dadosProduto);
      } else {
        const colRef = collection(db, 'usuarios', userId, 'produtos');
        await addDoc(colRef, dadosProduto);
      }
      limparFormProduto();
      setTelaAtiva('produtos_lista');
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
    }
  };

  const iniciarEdicaoProduto = (prod: Produto) => {
    setIdProdEdicao(prod.id);
    setFotoProd(prod.foto.includes('ui-avatars') ? '' : prod.foto);
    setTituloProd(prod.titulo);
    setCustoBaseProd(prod.custoBase.toString());
    setCustosAdicionais(prod.custosAdicionais);
    setTipoLucro(prod.tipoLucro);
    setValorLucro(prod.valorLucro.toString());
    setTelaAtiva('produto_cadastro');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicarProduto = async (prod: Produto) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const { id, ...dadosSemId } = prod;

    try {
      const colRef = collection(db, 'usuarios', userId, 'produtos');
      await addDoc(colRef, {
        ...dadosSemId,
        titulo: `${prod.titulo} (Cópia)`,
      });
    } catch (error) {
      console.error('Erro ao duplicar produto:', error);
    }
  };

  const limparFormProduto = () => {
    setIdProdEdicao(null);
    setFotoProd('');
    setTituloProd('');
    setCustoBaseProd('');
    setCustosAdicionais([]);
    setTipoLucro('reais');
    setValorLucro('');
  };

  const lidarExcluirProduto = async (id: string) => {
    if (window.confirm('Excluir este produto?')) {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const docRef = doc(db, 'usuarios', userId, 'produtos', id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error('Erro ao excluir produto:', error);
      }
    }
  };

  const produtosFiltrados = useMemo(
    () =>
      produtos.filter((p) =>
        p.titulo.toLowerCase().includes(buscaProduto.toLowerCase())
      ),
    [produtos, buscaProduto]
  );
  const plataformasFiltradas = useMemo(
    () =>
      filtroPlataforma === 'todas'
        ? plataformas
        : plataformas.filter((p) => p.id === filtroPlataforma),
    [plataformas, filtroPlataforma]
  );

  const calcularPrecoVenda = (produto: Produto, plat: Plataforma) => {
    const C = produto.custoTotal + plat.taxaFixa + plat.freteFixo;
    const P_taxas = (plat.comissao + plat.comissaoAfiliado) / 100;
    if (produto.tipoLucro === 'reais') {
      const divisor = 1 - P_taxas;
      return divisor <= 0 ? null : (C + produto.valorLucro) / divisor;
    } else {
      const divisor = 1 - P_taxas - produto.valorLucro / 100;
      return divisor <= 0 ? null : C / divisor;
    }
  };

  if (telaAtiva === 'produto_cadastro') {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto">
        <header className="mb-6 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            {idProdEdicao ? 'Editar Produto' : 'Cadastrar Novo Produto'}
          </h2>
        </header>
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
          <form onSubmit={lidarSalvarProduto} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título do Produto
                </label>
                <input
                  type="text"
                  required
                  value={tituloProd}
                  onChange={(e) => setTituloProd(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL da Foto (Opcional)
                </label>
                <input
                  type="url"
                  value={fotoProd}
                  onChange={(e) => setFotoProd(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-base font-bold text-slate-800">
                Custos de Fabricação e Extras
              </h4>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Custo Base (R$)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={custoBaseProd}
                  onChange={(e) => setCustoBaseProd(e.target.value)}
                  className="w-full md:w-1/2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Custos Diversos
                  </label>
                  <button
                    type="button"
                    onClick={adicionarCustoExtra}
                    className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold"
                  >
                    + Adicionar Custo
                  </button>
                </div>
                {custosAdicionais.map((custo) => (
                  <div key={custo.id} className="flex gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="Ex: Caixa"
                      value={custo.nome}
                      onChange={(e) =>
                        atualizarCustoExtra(custo.id, 'nome', e.target.value)
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$"
                      value={custo.valor}
                      onChange={(e) =>
                        atualizarCustoExtra(custo.id, 'valor', e.target.value)
                      }
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removerCustoExtra(custo.id)}
                      className="px-3 bg-red-50 text-red-600 rounded-lg font-bold"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <span className="text-base font-medium text-slate-600">
                  Custo Total Calculado:
                </span>
                <span className="text-2xl font-black text-slate-800">
                  R$ {calcularCustoTotalAoVivo().toFixed(2)}
                </span>
              </div>
            </div>
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-3">
              <h4 className="text-base font-bold text-blue-800">
                Meta de Lucro Líquido
              </h4>
              <div className="flex gap-3">
                <select
                  value={tipoLucro}
                  onChange={(e) => setTipoLucro(e.target.value as any)}
                  className="w-1/3 px-3 py-2.5 border border-blue-200 rounded-lg bg-white text-blue-900"
                >
                  <option value="reais">Lucro em R$</option>
                  <option value="porcentagem">Margem (%)</option>
                </select>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={valorLucro}
                  onChange={(e) => setValorLucro(e.target.value)}
                  className="w-2/3 px-4 py-2.5 border border-blue-200 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 text-white py-3.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700"
              >
                Salvar e Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  limparFormProduto();
                  setTelaAtiva('produtos_lista');
                }}
                className="px-6 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            Meus Produtos
          </h2>
        </div>
        <button
          onClick={() => {
            setTelaAtiva('produto_cadastro');
            limparFormProduto();
          }}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm"
        >
          + Novo Produto
        </button>
      </header>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="🔍 Buscar..."
          value={buscaProduto}
          onChange={(e) => setBuscaProduto(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50"
        />
        <select
          value={filtroPlataforma}
          onChange={(e) => setFiltroPlataforma(e.target.value)}
          className="w-full sm:w-64 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50"
        >
          <option value="todas">Todas as Plataformas</option>
          {plataformas.map((p) => (
            <option key={p.id} value={p.id}>
              Apenas {p.nome}
            </option>
          ))}
        </select>
      </div>
      {produtosFiltrados.length === 0 ? (
        <div className="bg-white p-12 rounded-xl text-center border border-dashed border-gray-300">
          <h3 className="text-xl font-bold text-gray-700 mb-2">
            Nenhum produto cadastrado nesta busca
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {produtosFiltrados.map((prod) => (
            <div
              key={prod.id}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-5 pb-5 border-b border-gray-100">
                <div className="flex gap-4 items-center">
                  <img
                    src={prod.foto}
                    alt=""
                    onError={(e) =>
                      (e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        prod.titulo
                      )}&background=e2e8f0`)
                    }
                    className="w-20 h-20 rounded-xl object-cover bg-gray-50 border border-gray-200"
                  />
                  <div>
                    <h4 className="font-bold text-gray-800 text-xl leading-tight mb-1">
                      {prod.titulo}
                    </h4>
                    <div className="flex flex-col text-sm text-gray-600 space-y-0.5">
                      <span>
                        Custo:{' '}
                        <strong className="text-slate-800">
                          R$ {prod.custoTotal.toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        Lucro:{' '}
                        <strong className="text-blue-600">
                          {prod.tipoLucro === 'reais'
                            ? `R$ ${prod.valorLucro.toFixed(2)}`
                            : `${prod.valorLucro}%`}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => iniciarEdicaoProduto(prod)}
                    className="p-2 bg-slate-50 text-slate-600 rounded-lg border border-slate-200"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => duplicarProduto(prod)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100"
                  >
                    📄
                  </button>
                  <button
                    onClick={() => lidarExcluirProduto(prod.id)}
                    className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-100"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="mt-auto">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Preço de Venda:
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {plataformasFiltradas.map((plat) => {
                    const precoVenda = calcularPrecoVenda(prod, plat);
                    return (
                      <div
                        key={plat.id}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={plat.logo}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-slate-700 truncate">
                            {plat.nome}
                          </span>
                        </div>
                        {precoVenda === null ? (
                          <div className="text-[10px] text-red-600 font-bold bg-red-50 p-1.5 rounded border border-red-100">
                            Inviável
                          </div>
                        ) : (
                          <div className="text-lg font-black text-green-700">
                            R$ {precoVenda.toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
