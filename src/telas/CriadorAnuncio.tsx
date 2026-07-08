import { useState, useEffect, useMemo } from 'react';
import type { Produto, Plataforma } from '../types';

interface CriadorAnuncioProps {
  produtos: Produto[];
  plataformas: Plataforma[];
}

export default function CriadorAnuncio({ produtos, plataformas }: CriadorAnuncioProps) {
  // 🚨 COLE AQUI A SUA NOVA CHAVE GERADA (Em um Novo Projeto)
  const GEMINI_API_KEY = 'AQ.Ab8RN6IYlJhxJbTWD2Mo9deVsyO3O3FG-tKf_NrFfHMHKA6OY';

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

  const rodarEngenhariaAnuncio = async () => {
    if (!produtoSelecionado) return;

    setAnalisando(true);
    setGerado(false);
    
    try {
      setLogAnalyse("🔬 Inicializando módulo Vision Agent...");
      let base64Image = null;
      let mimeType = 'image/jpeg';

      // 1. Tenta baixar a imagem do produto e converter para Base64
      if (produtoSelecionado.foto) {
        setLogAnalyse("📸 Escaneando pixels e texturas da imagem anexada...");
        try {
          const imgResponse = await fetch(produtoSelecionado.foto);
          const blob = await imgResponse.blob();
          mimeType = blob.type;
          
          base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("Servidor da imagem bloqueou a leitura direta (CORS). A IA usará apenas os textos.");
        }
      }

      setLogAnalyse("🧠 Conectando ao Google Cloud AI...");

      // 2. Montando o Prompt Estratégico
      const promptText = `
        Você é o "Copilot", um especialista nível sênior em E-commerce, SEO e Copywriting voltado para conversão.
        
        Sua tarefa é criar material de marketing otimizado para o seguinte produto:
        Título/Nome Base: "${produtoSelecionado.titulo}"
        Código: ${produtoSelecionado.codigo || 'Não informado'}
        Categoria: ${produtoSelecionado.categoria || 'Geral'}

        Instruções:
        1. Se uma imagem foi enviada com este prompt, extraia as características visuais (cor, estilo, formato, detalhes) e incorpore nos textos.
        2. NÃO use nomes de marcas famosas ou protegidas por direitos autorais, use termos genéricos como "Estilo", "Tipo", "Premium", "Modelo".
        3. Crie 4 opções de Títulos focados no Mercado Livre (Máximo absoluto de 60 caracteres).
        4. Crie 4 opções de Títulos focados em Shopee/Nuvemshop (Máximo de 100 caracteres).
        5. Crie 4 Descrições persuasivas para o Mercado Livre (Foco em entrega rápida/Full, estrutura técnica, palavras-chave de cauda longa, segurança na compra).
        6. Crie 4 Descrições persuasivas para outros canais (Foco em benefícios, sensação ao usar, exclusividade, escassez).
        
        Você deve OBRIGATORIAMENTE retornar APENAS um objeto JSON válido, sem formatação Markdown (\`\`\`json) e sem explicações. Estrutura EXATA:
        {
          "titulosML": ["titulo 1", "titulo 2", "titulo 3", "titulo 4"],
          "titulosGerais": ["titulo 1", "titulo 2", "titulo 3", "titulo 4"],
          "descricoesML": ["desc 1", "desc 2", "desc 3", "desc 4"],
          "descricoesGerais": ["desc 1", "desc 2", "desc 3", "desc 4"]
        }
      `;

      const parts: any[] = [{ text: promptText }];
      if (base64Image) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Image
          }
        });
      }

      const bodyBase = {
        contents: [{ parts }],
        generationConfig: { temperature: 0.8 }
      };

      // 3. ROTEADOR AUTOMÁTICO DE MODELOS COM DIAGNÓSTICO (RAIO-X)
      const modelosParaTestar = base64Image 
        ? ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-001', 'gemini-1.0-pro-vision-latest']
        : ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-001', 'gemini-1.0-pro'];

      let responseOk = null;
      let ultimoErroGoogle = "Erro Desconhecido";

      for (const modelo of modelosParaTestar) {
        setLogAnalyse(`⚙️ Testando conexão com motor de IA: ${modelo}...`);
        
        const payload: any = JSON.parse(JSON.stringify(bodyBase));
        
        if (modelo.includes('1.5')) {
          payload.generationConfig.responseMimeType = "application/json";
        }

        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            responseOk = res;
            setLogAnalyse(`✅ Motor ${modelo} ancorado com sucesso! Gerando copy...`);
            break; 
          } else {
            const erroData = await res.json();
            // Captura o erro oficial do Google para te mostrar na tela
            ultimoErroGoogle = erroData.error?.message || JSON.stringify(erroData);
            console.warn(`Motor ${modelo} recusado:`, erroData);
          }
        } catch (e: any) {
          ultimoErroGoogle = e.message;
          console.warn(`Falha na requisição ao motor ${modelo}`, e);
        }
      }

      if (!responseOk) {
        throw new Error(`O Google recusou a sua Chave de API.\n\nMotivo Oficial do Google:\n"${ultimoErroGoogle}"\n\nGere uma nova Chave selecionando "Create API key in new project".`);
      }

      const data = await responseOk.json();
      let textoResposta = data.candidates[0].content.parts[0].text;
      
      setLogAnalyse("✅ Renderizando resultados na tela...");

      textoResposta = textoResposta.replace(/```json/gi, '').replace(/```/g, '').trim();

      const jsonResposta = JSON.parse(textoResposta);

      setTitulosML(jsonResposta.titulosML || []);
      setTitulosGerais(jsonResposta.titulosGerais || []);
      setDescricoesML(jsonResposta.descricoesML || []);
      setDescricoesGerais(jsonResposta.descricoesGerais || []);

      setGerado(true);

    } catch (error: any) {
      console.error("Erro no processamento da Inteligência Artificial:", error);
      alert(`🤖 Falha de Conexão IA:\n\n${error.message}`);
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-8 pb-32">
      
      <header className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl -z-10"></div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span>⚡</span> AI Listing Copilot
          </h2>
          <p className="text-slate-500 font-medium mt-1 text-xs sm:text-sm">Selecione um produto e deixe a Inteligência Artificial do Google ler a imagem e criar seu anúncio.</p>
        </div>
      </header>

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
            className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {analisando ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Processando...</> : 'Gerar Anúncio'}
          </button>
        </div>
      </div>

      {analisando && (
        <div className="bg-slate-900 text-emerald-400 font-mono p-6 rounded-2xl border border-slate-800 shadow-inner space-y-3 max-w-2xl animate-pulse">
          <div className="flex items-center gap-2 text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>AGENTE AI ATIVO:</span>
          </div>
          <p className="text-sm font-bold text-slate-200">{logAnalise}</p>
        </div>
      )}

      {gerado && produtoSelecionado && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start animate-fade-in">
          
          <div className="xl:col-span-4 space-y-6">
            
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

          <div className="xl:col-span-8 space-y-8">
            
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-black text-xl text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <span>🔤</span> Títulos Estratégicos Gerados pela IA
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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