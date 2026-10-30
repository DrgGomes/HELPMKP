import { useState } from 'react';
import type { Produto, Plataforma } from '../types';

interface CriadorAnuncioProps {
  produtos: Produto[];
  plataformas: Plataforma[];
}

function dinheiro(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function CriadorAnuncio({
  produtos,
  plataformas,
}: CriadorAnuncioProps) {
  const [produtoId, setProdutoId] = useState('');

  const produto = produtos.find((item) => item.id === produtoId);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h2 className="text-3xl font-black text-slate-800">
          Preços por plataforma
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Consulte os custos e o preço sugerido dos seus produtos.
        </p>
      </header>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <label
          htmlFor="produto-preco"
          className="block text-sm font-bold text-slate-700 mb-2"
        >
          Selecione um produto
        </label>

        <select
          id="produto-preco"
          value={produtoId}
          onChange={(event) => setProdutoId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800"
        >
          <option value="">Escolha um produto...</option>

          {produtos.map((item) => (
            <option key={item.id} value={item.id}>
              {item.titulo}
              {item.codigo ? ` — ${item.codigo}` : ''}
            </option>
          ))}
        </select>

        {produtos.length === 0 && (
          <p className="text-sm text-slate-500 mt-3">
            Cadastre um produto para consultar seus preços.
          </p>
        )}
      </section>

      {produto && (
        <>
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-slate-800">
              {produto.titulo}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  Custo total cadastrado
                </p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {dinheiro(produto.custoTotal)}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-sm text-blue-700">
                  Lucro desejado sobre o custo
                </p>
                <p className="text-2xl font-black text-blue-800 mt-1">
                  {produto.tipoLucro === 'porcentagem'
                    ? `${produto.valorLucro}%`
                    : dinheiro(produto.valorLucro)}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              O percentual cadastrado representa lucro sobre o custo,
              não margem sobre o preço de venda. Os cálculos usam os
              custos e as taxas cadastrados no sistema.
            </p>
          </section>

          {plataformas.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-600">
              Cadastre uma plataforma e suas taxas para calcular o preço.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plataformas.map((plataforma) => {
                const percentual =
                  Number(plataforma.comissao || 0) +
                  Number(plataforma.comissaoAfiliado || 0);

                const taxasFixas =
                  Number(plataforma.taxaFixa || 0) +
                  Number(plataforma.freteFixo || 0);

                const custo = Number(produto.custoTotal);

                const lucro =
                  produto.tipoLucro === 'porcentagem'
                    ? custo * (Number(produto.valorLucro) / 100)
                    : Number(produto.valorLucro);

                const valido =
                  Number.isFinite(custo) &&
                  Number.isFinite(lucro) &&
                  Number.isFinite(percentual) &&
                  Number.isFinite(taxasFixas) &&
                  custo >= 0 &&
                  lucro >= 0 &&
                  taxasFixas >= 0 &&
                  percentual >= 0 &&
                  percentual < 100;

                const preco = valido
                  ? Math.ceil(
                      ((custo + lucro + taxasFixas) /
                        (1 - percentual / 100)) *
                        100
                    ) / 100
                  : 0;

                return (
                  <section
                    key={plataforma.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6"
                  >
                    <h3 className="text-lg font-bold text-slate-800">
                      {plataforma.nome}
                    </h3>

                    {valido ? (
                      <>
                        <p className="text-sm text-slate-500 mt-4">
                          Preço sugerido
                        </p>
                        <p className="text-3xl font-black text-emerald-600 mt-1">
                          {dinheiro(preco)}
                        </p>

                        <div className="space-y-2 text-sm text-slate-600 mt-5">
                          <p>
                            Comissão + afiliado: {percentual}%
                          </p>
                          <p>
                            Taxa fixa + frete: {dinheiro(taxasFixas)}
                          </p>
                          <p>
                            Lucro desejado por unidade: {dinheiro(lucro)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-rose-600 mt-4">
                        Confira os custos e as taxas cadastrados.
                        A comissão total precisa ser menor que 100%.
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
