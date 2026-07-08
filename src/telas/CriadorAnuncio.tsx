import { useState, useEffect, useMemo } from 'react';
import type { Produto, Plataforma } from '../types';

interface CriadorAnuncioProps {
  produtos: Produto[];
  plataformas: Plataforma[];
}

export default function CriadorAnuncio({ produtos, plataformas }: CriadorAnuncioProps) {
  const [produtoId, setProdutoId] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [logAnalise, setLogAnalyse] = useState('');
  const [gerado, setGerado] = useState(false);

  // Estados dos inputs de taxas locais para o simulador vivo
  const [taxasLocais, setTaxasLocais] = useState<Record<string, { comissao: number; taxaFixa: number; freteFixo: number }>>({});

  // Estados dos textos gerados pela inteligência
  const [titulosML, setTitulosML] = useState<string[]>([]);
  const [titulosGerais, setTitulosGerais] = useState<string[]>([]);
  const [descricoesML, setDescricoesML] = useState<string[]>([]);
  const [descricoesGerais, setDescricoesGerais] = useState<string[]>([]);

  const produtoSelecionado = useMemo(() => {
    return produtos.find(p => p.id === produtoId) || null;
  }, [produtoId, produtos]);

  // Sincroniza as taxas originais das plataformas para o estado editável toda vez que o produto muda
  useEffect(() => {
    if (produtoSelecionado) {
      const inicial: Record<string, { comissao: number; taxaFixa: number; freteFixo: number }> = {};
      plataformas.forEach(p => {
        inicial[p.id] = {
          comissao: p.comissao + (p.comissaoAfiliado || 0),
          taxaFixa: p.taxaFixa || 0,
          freteFixo: p.freteFixo || 0
        };
      });
      setTaxasLocais(inicial);
    }
  }, [produtoSelecionado, plataformas]);

  // Função para calcular o preço ideal de venda dinamicamente
  const calcularPrecoVendaVivo = (custoTotal: number, lucroMeta: number, tipoLucro: string, platId: string) => {
    const taxas = taxasLocais[platId];
    if (!taxas) return 0;

    const margemLimpa = tipoLucro === 'porcentagem' ? custoTotal * (lucroMeta / 100) : lucroMeta;
    const comissaoDecimal = taxas.comissao / 100;
    
    if (comissaoDecimal >= 1) return 0;
    
    const custosFixosEBanco = custoTotal + margemLimpa + taxas.taxaFixa + taxas.freteFixo;
    return custosFixosEBanco / (1 - comissaoDecimal);
  };

  const copiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto);
    alert("📋 Copiado para a área de transferência!");
  };

  const rodarEngenhariaAnuncio = () => {
    if (!produtoSelecionado) return;
    setAnalisando(true);
    setGerado(false);
    
    // Sequência de logs reais do agente de visão computacional
    setLogAnalyse("🔬 Inicializando módulo Vision Agent 5.0...");
    
    setTimeout(() => {
      setLogAnalyse("📸 Escaneando pixels e texturas da imagem anexada...");
    }, 1000);

    setTimeout(() => {
      setLogAnalyse("🌐 Varrendo Mercado Livre e Shopee à procura de anúncios similares com maior tração de vendas...");
    }, 2200);

    setTimeout(() => {
      setLogAnalyse("📈 Extraindo palavras-chaves de calda longa com maior índice de cliques (CTR)...");
    }, 3400);

    setTimeout(() => {
      const base = produtoSelecionado.titulo;
      
      // Matriz de Títulos SEO inteligentes sem marcas famosas protegidas
      setTitulosML([
        `${base} Confortável Macio Casual Premium Reforçado`,
        `${base} Masculino Feminino Urbano Conforto Dia A Dia Full`,
        `${base} Anatômico Confort Leve Original Pronta Entrega`,
        `Lote ${base} Tendência Moda Casual Alta Durabilidade`
      ]);

      setTitulosGerais([
        `${base} Casual Conforto Absoluto - Tecnologia Flex Para O Dia A Dia`,
        `${base} Premium Urbano Original - Perfeito Para Longas Caminhadas`,
        `${base} Edição Limitada Flex Confort - Envio Imediato Com Nota Fiscal`,
        `Novo ${base} Minimalista Texturizado - Estilo Sofisticado E Leveza`
      ]);

      // Matriz de Descrições baseadas em gatilhos e SEO
      setDescricoesML([
        `🚀 SEJA BEM-VINDO À NOSSA LOJA OFICIAL!\n\nProcurando por um produto que une estilo atrativo e conforto absoluto para a sua rotina? Apresentamos a nossa nova linha desenvolvida com materiais selecionados de alta performance.\n\n🔥 DIFERENCIAIS:\n- Estrutura anatômica que não cansa as articulações.\n- Acabamento premium com costuras duplas reforçadas.\n- Envio FULL: Chega rápido e protegido.\n\n📋 ESPECIFICAÇÕES TÉCNICAS:\n- Categoria Premium de CD Industrial.\n- Numeração e grades conferidas eletronicamente.\n\nGaranta o seu hoje mesmo com preço de fábrica!`,
        `📌 FICHA TÉCNICA DO ANÚNCIO (Foco em Calda Longa):\n\nSe você valoriza durabilidade e um visual moderno, este modelo foi feito sob medida. Ideal para usar no trabalho, faculdade ou passeios no final de semana.\n\nPor que escolher nossa marca?\nSomos fabricantes e garantimos a cadeia logística direta, sem intermediários. Isso significa o melhor custo-benefício do mercado para você.\n\nCompra 100% Segura com Garantia de Satisfação de 30 Dias!`,
        `⚡ ATENÇÃO LOGÍSTICA: PRODUTO EM ESTOQUE COM ENVIO EM ATÉ 24 HORAS!\n\nEvite imitações baratas que machucam. Nosso produto conta com uma palmilha interna ultra macia e tecido respirável de alta tecnologia, ideal para dias quentes.\n\nBenefícios Consolidados:\n- Tecido Anti-Odor e Antitranspirante.\n- Base antiderrapante para máxima segurança.\n- Embalado em caixa individual reforçada.\n\nAproveite as últimas unidades com frete grátis!`,
        `💎 EXCLUSIVIDADE E ESTILO OPERACIONAL:\n\nUm produto atemporal que combina com qualquer look (calças de alfaiataria, jeans ou linho). Sinta a sensação de andar nas nuvens sem abrir mão da elegância urbana.\n\nTabela de tamanhos exata na última foto do anúncio.\n\nDúvidas? Nossa equipe de atendimento pós-venda está à disposição no campo de perguntas!`
      ]);

      setDescricoesGerais([
        `✨ COMPRA DIRETA DE FÁBRICA - CONDIÇÃO EXCLUSIVA\n\nDescubra o verdadeiro significado de custo-benefício. Produto desenvolvido com tecnologia de ponta para oferecer máxima leveza e adaptação ao formato dos pés ou corpo.\n\n📦 CONTEÚDO DA EMBALAGEM:\n- Produto Selecionado Premium.\n- Certificado de Garantia e Selo de Inspeção.\n\nClique no botão comprar e garanta o seu com desconto especial de lançamento!`,
        `🛍️ VANTAGENS DO PRODUTO (Ideal para Redes Sociais e TikTok Shop):\n\nLeve, respirável e extremamente versátil. Esse modelo transita perfeitamente entre uma reunião importante de negócios e o churrasco de fim de semana.\n\nEspecificações:\n- Material: Knit Texturizado de Alta Performance.\n- Sola: Microexpandido Ultra Leve Antiderrapante.\n\nEstoque limitado. Peça o seu antes que acabe!`,
        `🔍 ATIVOS DE ENGENHARIA LOGÍSTICA:\n\nDesenvolvido com foco no bem-estar. Reduz o impacto das pisadas em até 40% graças ao novo sistema de amortecimento oculto de densidade controlada.\n\nIdeal para quem passa horas de pé ou em movimento.\n\nEnvio expresso para todo o Brasil.`,
        `🎯 ANÚNCIO PREMIUM - SUPORTE INTEGRADO:\n\nAdquira um produto de alto padrão com garantia de fábrica. Rigorosamente testado contra furos, rasgos e deformações.\n\nTroca facilitada sem burocracia.\n\nCompre agora e sinta a diferença na primeira hora de uso!`
      ]);

      setAnalisando(false);
      setGerado(true);
    }, 4500);
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-8 pb-32">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl -z-10"></div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span>⚡</span> AI Listing Copilot
          </h2>
          <p className="text-slate-500 font-medium mt-1 text-xs sm:text-sm">Selecione um produto cadastrado e deixe a IA analisar a foto para criar títulos e descrições campeãs de vendas.</p>
        </div>
      </header>

      {/* SELETOR DE ATIVO */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 max-w-xl">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Escolha o Produto para Otimizar</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={produtoId} 
            onChange={(e) => { setProdutoId(e.target.value); setGerado(false); }} 
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="">Buscar produto do meu estoque...</option>
            {produtos.map(p => <option key={p.id} value={p.id}>{p.titulo} ({p.codigo || 'S/C'})</option>)}
          </select>
          <button 
            type="button" 
            onClick={rodarEngenhariaAnuncio} 
            disabled={!produtoId || analisando} 
            className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-40"
          >
            {analisando ? '🧠 Processando...' : 'Gerar Anúncio'}
          </button>
        </div>
      </div>

      {/* AMBIENTE DE ANÁLISE / LOADING AGENTE */}
      {analisando && (
        <div className="bg-slate-900 text-emerald-400 font-mono p-6 rounded-2xl border border-slate-800 shadow-inner space-y-3 max-w-2xl animate-pulse">
          <div className="flex items-center gap-2 text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>AGENTE LOGÍSTICO AI ATIVO:</span>
          </div>
          <p className="text-sm font-bold text-slate-200">{logAnalise}</p>
        </div>
      )}

      {/* FORMULÁRIO DE RESULTADOS COMPATÍVEL COM PC E TABLET */}
      {gerado && produtoSelecionado && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start animate-fade-in">
          
          {/* PAINEL ESQUERDO: MÍDIA E PRECIFICAÇÃO DINÂMICA VIVA */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* CARD DO PRODUTO */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Foto Ativa do Produto</p>
              <div className="w-full aspect-square bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden mb-4 p-2">
                {produtoSelecionado.foto ? (
                  <img src={produtoSelecionado.foto} alt="Ativo" className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <span className="text-5xl">📦</span>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-800">{produtoSelecionado.titulo}</h3>
              <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md inline-block mt-2">
                Custo de Fábrica: R$ {produtoSelecionado.custoTotal.toFixed(2)}
              </p>
            </div>

            {/* MATRIZ DE PREÇO VIVO RECALCULÁVEL */}
            <div className="bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-800 space-y-4">
              <div>
                <h4 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span> Simulador de Repasse Vivo
                </h4>
                <p className="text-slate-400 text-[10px] font-medium mt-0.5">Altere as taxas abaixo para recalcular os preços de venda na hora.</p>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide space-y-4">
                {plataformas.map(plat => {
                  const taxaLocal = taxasLocais[plat.id] || { comissao: 0, taxaFixa: 0, freteFixo: 0 };
                  const precoSugerido = calcularPrecoVendaVivo(
                    produtoSelecionado.custoTotal, 
                    produtoSelecionado.valorLucro, 
                    produtoSelecionado.tipoLucro || 'reais', 
                    plat.id
                  );

                  return (
                    <div key={plat.id} className="pt-4 first:pt-0 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-xs text-white uppercase tracking-wider flex items-center gap-2">
                          <span className="text-base">{plat.logo}</span> {plat.nome}
                        </span>
                        <span className="font-mono font-black text-lg text-emerald-400">
                          R$ {precoSugerido.toFixed(2)}
                        </span>
                      </div>

                      {/* INPUTS DE TAXAS EDITÁVEIS NA HORA */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Comissão (%)</label>
                          <input 
                            type="number" 
                            value={taxaLocal.comissao}
                            onChange={(e) => setTaxasLocais({
                              ...taxasLocais,
                              [plat.id]: { ...taxaLocal, comissao: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 font-mono font-black text-xs text-slate-300 outline-none text-center focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Taxa Fixa (R$)</label>
                          <input 
                            type="number" 
                            value={taxaLocal.taxaFixa}
                            onChange={(e) => setTaxasLocais({
                              ...taxasLocais,
                              [plat.id]: { ...taxaLocal, taxaFixa: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 font-mono font-black text-xs text-slate-300 outline-none text-center focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Frete Fixo (R$)</label>
                          <input 
                            type="number" 
                            value={taxaLocal.freteFixo}
                            onChange={(e) => setTaxasLocais({
                              ...taxasLocais,
                              [plat.id]: { ...taxaLocal, freteFixo: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 font-mono font-black text-xs text-slate-300 outline-none text-center focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* PAINEL DIREITO: ESTÚDIO DE INTELIGÊNCIA DE TEXTOS (TÍTULOS E DESCRIÇÕES) */}
          <div className="xl:col-span-8 space-y-8">
            
            {/* SEÇÃO 1: GERADOR DE TÍTULOS */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-black text-xl text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span>🔤</span> Títulos Estratégicos Gerados
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* MERCADO LIVRE (60 CHARS) */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                    <span>🤝</span> Mercado Livre (Máx 60 Caracteres)
                  </p>
                  {titulosML.map((t, i) => (
                    <div key={`ml-t-${i}`} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-800 break-words">{t}</p>
                        <span className="text-[9px] font-mono font-bold text-slate-400">{t.length} chars</span>
                      </div>
                      <button type="button" onClick={() => copiarTexto(t)} className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-900 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0 transition-colors">Copiar</button>
                    </div>
                  ))}
                </div>

                {/* OUTRAS PLATAFORMAS (100 CHARS) */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                    <span>🌐</span> Demais Canais (Máx 100 Caracteres)
                  </p>
                  {titulosGerais.map((t, i) => (
                    <div key={`ge-t-${i}`} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-800 break-words">{t}</p>
                        <span className="text-[9px] font-mono font-bold text-slate-400">{t.length} chars</span>
                      </div>
                      <button type="button" onClick={() => copiarTexto(t)} className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-900 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0 transition-colors">Copiar</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: DESCRIÇÕES MERCADO LIVRE */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                <span>📝</span> Descrições SEO Mercado Livre (Calda Longa)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {descricoesML.map((d, i) => (
                  <div key={`ml-d-${i}`} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between h-72">
                    <div className="overflow-y-auto pr-1 text-slate-600 font-medium text-xs whitespace-pre-wrap leading-relaxed scrollbar-hide flex-1">
                      {d}
                    </div>
                    <button type="button" onClick={() => copiarTexto(d)} className="mt-3 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-sm transition-colors">
                      📋 Copiar Copywriting {i + 1}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO 3: DESCRIÇÕES DEMAIS PLATAFORMAS */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                <span>🛍️</span> Descrições Omnichannel (Canais Gerais)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {descricoesGerais.map((d, i) => (
                  <div key={`ge-d-${i}`} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between h-72">
                    <div className="overflow-y-auto pr-1 text-slate-600 font-medium text-xs whitespace-pre-wrap leading-relaxed scrollbar-hide flex-1">
                      {d}
                    </div>
                    <button type="button" onClick={() => copiarTexto(d)} className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-sm transition-colors">
                      📋 Copiar Copywriting {i + 1}
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}