import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import type { LancamentoFinanceiro, Compra, Fornecedor, CategoriaDespesa } from '../types';

interface FinanceiroProps {
  lancamentos: LancamentoFinanceiro[];
  compras: Compra[];
  fornecedores: Fornecedor[];
  categoriasDespesa: CategoriaDespesa[];
}


export function demonstrativoFornecedor(
  fornecedor: { id: string; nome: string },
  compras: Compra[],
  contas: LancamentoFinanceiro[],
  pagamentos: { lancamento_id: string; valor: number; data_pagamento: string }[]
) {
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const data = (v: string) => esc(v ? v.slice(0, 10).split('-').reverse().join('/') : '—');
  const pedidos = compras.filter(c => c.fornecedorId === fornecedor.id && c.statusChegada === 'recebido');
  const faturas = contas.filter(l => l.fornecedorId === fornecedor.id && l.tipo === 'despesa').sort((a,b) => a.dataVencimento.localeCompare(b.dataVencimento));
  const pago = (l: LancamentoFinanceiro) => l.status === 'pago' ? Math.round(l.valor * 100) : pagamentos.filter(p => p.lancamento_id === l.id).reduce((t,p) => t + Math.round(p.valor * 100), 0);
  const total = faturas.reduce((t,l) => t + Math.round(l.valor * 100), 0);
  const quitado = faturas.reduce((t,l) => t + pago(l), 0);
  const detalhes = pedidos.map(c => `<section><h3>Compra ${esc(c.numeroVale || c.codigoOrdem)}</h3><p>Emissão do vale: ${data(c.dataCompra)} · Total: ${brl(c.valorTotal)}</p><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Valor unitário</th><th>Subtotal</th></tr></thead><tbody>${c.itens.map(i => `<tr><td>${esc(i.nome)}</td><td>${esc(i.quantidade)}</td><td>${brl(i.custoUnitario)}</td><td>${brl(i.subtotal)}</td></tr>`).join('')}</tbody></table></section>`).join('');
  const linhas = faturas.map((l, i) => {
    const compra = pedidos.find(c => c.id === l.compraId);
    const referencia = compra ? `Compra ${compra.numeroVale || compra.codigoOrdem}` : `Conta avulsa ${i + 1}`;
    const historico = pagamentos.filter(p => p.lancamento_id === l.id).sort((a,b) => a.data_pagamento.localeCompare(b.data_pagamento));
    return `<tr><td>${esc(referencia)}</td><td>${data(compra?.dataCompra || l.dataLancamento || '')}</td><td>${data(l.dataVencimento)}</td><td>${brl(l.valor)}</td><td>${brl(pago(l)/100)}</td><td>${brl(Math.max(0, Math.round(l.valor*100)-pago(l))/100)}</td></tr>${historico.map(p => `<tr class="pagamento"><td colspan="6">Pagamento em ${data(p.data_pagamento)}: ${brl(p.valor)}</td></tr>`).join('')}${l.status === 'pago' && !historico.length ? '<tr class="pagamento"><td colspan="6">Quitação anterior sem histórico detalhado.</td></tr>' : ''}`;
  }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demonstrativo do fornecedor</title><style>
  *{box-sizing:border-box}body{font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#172033;max-width:1040px;margin:32px auto;padding:0 28px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1{font-size:29px;line-height:1.2;letter-spacing:-.7px;margin:0 0 14px}h2{font-size:19px;letter-spacing:-.3px;margin-top:30px}h3{font-size:16px}p{line-height:1.6;color:#64748b}.cabecalho{border-top:5px solid #2563eb;border-bottom:1px solid #e2e8f0;padding:26px 0 22px;margin:22px 0}.cabecalho h2{margin:0;color:#2563eb}.selo{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-bottom:10px}.resumo{display:flex;gap:14px;margin:24px 0}.resumo>div{flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:16px;font-size:12px;color:#64748b}.resumo>div:last-child{background:#eff6ff;border-color:#bfdbfe}.resumo strong{display:block;font-size:23px;letter-spacing:-.6px;color:#172033;margin-top:10px;font-variant-numeric:tabular-nums}.resumo>div:last-child strong{color:#1d4ed8}table{border-collapse:separate;border-spacing:0;width:100%;margin:14px 0 24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:12px}th,td{border-bottom:1px solid #e2e8f0;padding:12px 10px;text-align:left;overflow-wrap:anywhere}th{background:#f1f5f9;color:#475569;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}tbody tr:last-child td{border-bottom:0}td:not(:first-child){white-space:nowrap;font-variant-numeric:tabular-nums}tr{break-inside:avoid}.pagamento td{font-size:11px;color:#64748b;background:#f8fafc;white-space:normal}button{background:#2563eb;color:white;border:0;padding:12px 18px;border-radius:12px;cursor:pointer;font-weight:700;font-size:13px;box-shadow:0 3px 8px #2563eb22}button:hover{background:#1d4ed8}section{margin:24px 0}footer{border-top:1px solid #e2e8f0;margin-top:28px;padding-top:16px;font-size:11px;line-height:1.6;color:#64748b}.instrucoes{font-size:12px}.nota{font-size:11px;color:#64748b}@media(max-width:650px){body{padding:0 12px}.resumo{flex-wrap:wrap}.resumo>div{min-width:140px}th,td{padding:9px 5px;font-size:10px}h1{font-size:24px}}@media print{button,.instrucoes{display:none}body{margin:0;max-width:none;padding:0}.cabecalho{margin-top:0}.resumo>div{padding:14px}th,td{padding:9px 7px}thead{display:table-header-group}h2,h3{break-after:avoid}@page{size:A4;margin:14mm}}
  </style></head><body><button onclick="window.print()">Imprimir / Salvar PDF</button><p class="instrucoes">Confira o demonstrativo antes de compartilhar. Para gerar o arquivo, escolha “Salvar como PDF” na impressão.</p><header class="cabecalho"><div class="selo">Conferência com fornecedor</div><h1>Demonstrativo de compras e pagamentos</h1><h2>${esc(fornecedor.nome)}</h2><p>Emitido em ${esc(new Date().toLocaleDateString('pt-BR'))} · Histórico disponível neste sistema, sem filtro de período.</p></header><div class="resumo"><div>Total das contas<strong>${brl(total/100)}</strong></div><div>Quitado<strong>${brl(quitado/100)}</strong></div><div>Saldo pendente<strong>${brl(Math.max(0,total-quitado)/100)}</strong></div></div><h2>Contas e pagamentos</h2><p class="nota">Emissão do vale corresponde à data da compra. Nas contas avulsas, corresponde à data de lançamento. Vencimento corresponde à conta ou parcela.</p><table><thead><tr><th>Referência</th><th>Emissão do vale</th><th>Vencimento</th><th>Valor</th><th>Quitado</th><th>Saldo</th></tr></thead><tbody>${linhas || '<tr><td colspan="6">Nenhuma conta vinculada.</td></tr>'}</tbody></table><h2>Detalhamento das compras recebidas</h2>${detalhes || '<p>Nenhuma compra recebida com itens disponíveis.</p>'}<footer>Documento para conferência. Não substitui nota fiscal nem comprovante bancário. Contas avulsas e compras sem fatura podem causar diferenças entre os totais das compras e das contas.</footer></body></html>`;
}

export default function Financeiro({ lancamentos, compras, fornecedores, categoriasDespesa }: FinanceiroProps) {
  const [abaAtiva, setAbaAtiva] = useState<'caixa' | 'fornecedores' | 'calendario'>('caixa');
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0]);
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('');
  const [fornSelecionado, setFornSelecionado] = useState('');
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [mesesRepetir, setMesesRepetir] = useState('12');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [categoriaLote, setCategoriaLote] = useState('');
  const [processandoLote, setProcessandoLote] = useState(false);
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth() + 1;
  const anoAtual = dataAtual.getFullYear();
  const [buscaDescricao, setBuscaDescricao] = useState('');
  const [mesFiltro, setMesFiltro] = useState<number>(mesAtual);
  const [anoFiltro, setAnoFiltro] = useState<number>(anoAtual);
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [fornecedorDivida, setFornecedorDivida] = useState('todos');
  const [exportandoFornecedor, setExportandoFornecedor] = useState(false);
  const [fornecedorFiltro, setFornecedorFiltro] = useState('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
  const [draftBusca, setDraftBusca] = useState('');
  const [draftMes, setDraftMes] = useState<number>(mesAtual);
  const [draftAno, setDraftAno] = useState<number>(anoAtual);
  const [draftStatus, setDraftStatus] = useState<'todos' | 'pendente' | 'pago'>('todos');
  const [draftTipo, setDraftTipo] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [draftFornecedor, setDraftFornecedor] = useState('todos');
  const [draftCategoria, setDraftCategoria] = useState('todos');
  const [ordemFaturas, setOrdemFaturas] = useState<'vencimento_asc' | 'emissao_desc' | 'valor_desc' | 'valor_asc'>('vencimento_asc');
  const [compraModal, setCompraModal] = useState<Compra | null>(null);
  const [calMes, setCalMes] = useState<number>(mesAtual);
  const [calAno, setCalAno] = useState<number>(anoAtual);
  const [modoArrastar, setModoArrastar] = useState<'vencimento' | 'emissao'>('vencimento');

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  const aplicarFiltros = () => {
    setBuscaDescricao(draftBusca); setMesFiltro(draftMes); setAnoFiltro(draftAno);
    setStatusFiltro(draftStatus); setTipoFiltro(draftTipo); setFornecedorFiltro(draftFornecedor);
    setCategoriaFiltro(draftCategoria); setSelecionados([]);
  };

  const limparFiltros = () => {
    setDraftBusca(''); setBuscaDescricao(''); setDraftMes(0); setMesFiltro(0);
    setDraftAno(0); setAnoFiltro(0); setDraftStatus('todos'); setStatusFiltro('todos');
    setDraftTipo('todos'); setTipoFiltro('todos'); setDraftFornecedor('todos'); setFornecedorFiltro('todos');
    setDraftCategoria('todos'); setCategoriaFiltro('todos'); setSelecionados([]);
  };

  const lidarSalvar = async (e: any) => {
    e.preventDefault();
    if (!descricao || !valor) return;
    const userId = await getUserId(); if (!userId) return;
    const valorNum = parseFloat(valor);
    const fId = tipo === 'despesa' && fornSelecionado ? fornSelecionado : null;
    try {
      if (idEdicao || !isRecorrente) {
        const dados: any = {
          tipo, descricao, valor: valorNum,
          data_vencimento: dataVencimento, data_lancamento: dataLancamento,
          categoria: categoria || 'Geral', fornecedor_id: fId,
        };
        if (idEdicao) {
          const { error } = await supabase.from('lancamentos').update(dados).eq('id', idEdicao).eq('user_id', userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('lancamentos').insert({ ...dados, status: 'pendente', user_id: userId });
          if (error) throw error;
        }
      } else {
        const qtdMeses = Math.max(1, parseInt(mesesRepetir) || 1);
        const grupoId = 'REC-' + Date.now();
        for (let i = 0; i < qtdMeses; i++) {
          const objVenc = new Date(dataVencimento + 'T12:00:00'); objVenc.setMonth(objVenc.getMonth() + i);
          const objLanc = new Date(dataLancamento + 'T12:00:00'); objLanc.setMonth(objLanc.getMonth() + i);
          const { error } = await supabase.from('lancamentos').insert({
            user_id: userId, tipo,
            descricao: qtdMeses > 1 ? `${descricao} (${i + 1}/${qtdMeses})` : descricao,
            valor: valorNum,
            data_vencimento: objVenc.toISOString().split('T')[0],
            data_lancamento: objLanc.toISOString().split('T')[0],
            categoria: categoria || 'Geral', status: 'pendente',
            fornecedor_id: fId, recorrente: true, grupo_recorrencia_id: grupoId,
          });
          if (error) console.warn('Erro ao inserir parcela:', error.message);
        }
      }
      limparFormulario();
    } catch (error) { console.error(error); alert('Erro ao salvar lançamento.'); }
  };

  const iniciarEdicao = (lanc: LancamentoFinanceiro) => {
    setAbaAtiva('caixa'); setIdEdicao(lanc.id); setTipo(lanc.tipo); setDescricao(lanc.descricao);
    setValor(lanc.valor.toString()); setDataLancamento(lanc.dataLancamento || lanc.dataVencimento);
    setDataVencimento(lanc.dataVencimento); setCategoria(lanc.categoria || ''); setFornSelecionado(lanc.fornecedorId || '');
    setIsRecorrente(false); setModoSelecao(false); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => {
    setIdEdicao(null); setTipo('despesa'); setDescricao(''); setValor('');
    setDataLancamento(new Date().toISOString().split('T')[0]); setDataVencimento(new Date().toISOString().split('T')[0]);
    setCategoria(''); setFornSelecionado(''); setIsRecorrente(false); setMesesRepetir('12');
  };

  const [contaParcelamento, setContaParcelamento] = useState<LancamentoFinanceiro | null>(null);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('2');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('');
  const [parcelando, setParcelando] = useState(false);
  const [erroParcelamento, setErroParcelamento] = useState('');

  const abrirParcelamento = (conta: LancamentoFinanceiro) => {
    setContaParcelamento(conta); setQuantidadeParcelas('2');
    setPrimeiroVencimento(conta.dataVencimento); setErroParcelamento('');
  };

  const salvarParcelamento = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contaParcelamento || parcelando) return;
    setParcelando(true); setErroParcelamento('');
    try {
      const { error } = await supabase.rpc('parcelar_lancamento', {
        p_lancamento_id: contaParcelamento.id,
        p_quantidade: Number(quantidadeParcelas),
        p_primeiro_vencimento: primeiroVencimento,
      });
      if (error) throw error;
      setContaParcelamento(null);
      alert('Parcelas criadas. O total original foi preservado.');
    } catch (e) {
      setErroParcelamento(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Erro ao parcelar.');
    } finally { setParcelando(false); }
  };

  const [pagando, setPagando] = useState(false);
  const [contaPagamento, setContaPagamento] = useState<LancamentoFinanceiro | null>(null);
  const [historico, setHistorico] = useState<{ id: string; valor: number; data_pagamento: string; observacao: string | null }[]>([]);
  const [valorPagamento, setValorPagamento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [observacaoPagamento, setObservacaoPagamento] = useState('');
  const [pedidoPagamento, setPedidoPagamento] = useState('');
  const [erroPagamento, setErroPagamento] = useState('');
  const [abrindoPagamento, setAbrindoPagamento] = useState(false);

  const alternarStatus = async (lanc: LancamentoFinanceiro) => {
    if (abrindoPagamento) return;
    setAbrindoPagamento(true);
    try {
      const { data, error } = await supabase.from('pagamentos')
        .select('id, valor, data_pagamento, observacao')
        .eq('lancamento_id', lanc.id).order('data_pagamento');
      if (error) throw error;
      const lista = (data || []).map(p => ({ ...p, valor: Number(p.valor) }));
      const pago = lista.reduce((total, p) => total + p.valor, 0);
      setHistorico(lista); setContaPagamento(lanc);
      setValorPagamento(Math.max(0, lanc.valor - pago).toFixed(2));
      const hoje = new Date();
      setDataPagamento(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`);
      setObservacaoPagamento(''); setErroPagamento('');
      setPedidoPagamento(crypto.randomUUID());
    } catch (e) {
      alert(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Erro ao consultar pagamentos.');
    } finally { setAbrindoPagamento(false); }
  };

  const salvarPagamento = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contaPagamento || pagando) return;
    setPagando(true); setErroPagamento('');
    try {
      const { error } = await supabase.rpc('registrar_pagamento', {
        p_lancamento_id: contaPagamento.id,
        p_valor: Number(valorPagamento.replace(',', '.')),
        p_data: dataPagamento,
        p_observacao: observacaoPagamento,
        p_pedido_id: pedidoPagamento,
      });
      if (error) throw error;
      setContaPagamento(null);
      alert('Pagamento registrado. Consulte o histórico no botão da conta.');
    } catch (e) {
      setErroPagamento(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Erro ao registrar pagamento.');
    } finally { setPagando(false); }
  };

  const excluirLancamento = async (lanc: LancamentoFinanceiro) => {
    const userId = await getUserId(); if (!userId) return;
    if (lanc.grupoRecorrenciaId) {
      const resposta = window.prompt("Este boleto faz parte de uma sequência repetida!\n\nDigite 'APENAS' para excluir só este mês.\nDigite 'SÉRIE' para apagar todas as parcelas futuras:");
      if (resposta?.toUpperCase() === 'APENAS') {
        const { error } = await supabase.from('lancamentos').delete().eq('id', lanc.id).eq('user_id', userId);
        if (error) { console.error(error); alert('Erro ao excluir.'); }
      } else if (resposta?.toUpperCase() === 'SÉRIE') {
        const correspondentes = lancamentos.filter(l => l.grupoRecorrenciaId === lanc.grupoRecorrenciaId);
        const idsParaExcluir = correspondentes.map(l => l.id);
        const { error } = await supabase.from('lancamentos').delete().in('id', idsParaExcluir).eq('user_id', userId);
        if (error) { console.error(error); alert('Erro ao excluir série.'); }
      }
    } else {
      if (window.confirm("Excluir permanentemente do banco de dados?")) {
        const { error } = await supabase.from('lancamentos').delete().eq('id', lanc.id).eq('user_id', userId);
        if (error) { console.error(error); alert('Erro ao excluir.'); }
      }
    }
  };

  const excluirValeInteiro = async (compraId: string) => {
    const userId = await getUserId(); if (!userId) return;
    if (window.confirm("⚠️ Excluir o Vale e a dívida vinculada a ele?")) {
      const { error: errComp } = await supabase.from('compras').delete().eq('id', compraId).eq('user_id', userId);
      if (errComp) { console.error(errComp); alert('Erro ao excluir compra.'); return; }
      const lancVinculado = lancamentos.find(l => l.compraId === compraId);
      if (lancVinculado) {
        const { error: errLanc } = await supabase.from('lancamentos').delete().eq('id', lancVinculado.id).eq('user_id', userId);
        if (errLanc) console.error(errLanc);
      }
      setCompraModal(null);
    }
  };

  const selecionarTodos = () => {
    if (selecionados.length === lancamentosFiltrados.length) setSelecionados([]);
    else setSelecionados(lancamentosFiltrados.map(l => l.id));
  };

  const aplicarCategoriaEmMassa = async () => {
    if (selecionados.length === 0) return alert("Selecione pelo menos um registro.");
    if (!categoriaLote) return alert("Escolha a categoria.");
    const userId = await getUserId(); if (!userId) return;
    setProcessandoLote(true);
    try {
      const { error } = await supabase.from('lancamentos').update({ categoria: categoriaLote }).in('id', selecionados).eq('user_id', userId);
      if (error) throw error;
      alert(`✅ Sucesso! ${selecionados.length} registros movidos para "${categoriaLote}".`);
      setModoSelecao(false); setSelecionados([]); setCategoriaLote('');
    } catch (error) {
      console.error(error); alert("Falha na gravação em lote.");
    }
    setProcessandoLote(false);
  };

  const [movimentos, setMovimentos] = useState<{ id: string; lancamento_id: string; valor: number; data_pagamento: string }[]>([]);
  const [erroMovimentos, setErroMovimentos] = useState('');
  const [carregandoMovimentos, setCarregandoMovimentos] = useState(true);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      setCarregandoMovimentos(true);
      try {
        const itens: typeof movimentos = [];
        for (let inicio = 0; ; inicio += 1000) {
          const { data, error } = await supabase.from('pagamentos')
            .select('id, lancamento_id, valor, data_pagamento')
            .order('id').range(inicio, inicio + 999);
          if (error) throw error;
          itens.push(...(data || []).map(p => ({ ...p, valor: Number(p.valor) })));
          if (!data || data.length < 1000) break;
        }
        if (ativo) { setMovimentos(itens); setErroMovimentos(''); }
      } catch (e) {
        if (ativo) setErroMovimentos(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Erro ao carregar pagamentos.');
      } finally { if (ativo) setCarregandoMovimentos(false); }
    };
    void carregar();
    return () => { ativo = false; };
  }, [lancamentos, contaPagamento]);

  const pagosPorConta = useMemo(() => {
    const totais: Record<string, number> = {};
    for (const p of movimentos) totais[p.lancamento_id] = (totais[p.lancamento_id] || 0) + Math.round(p.valor * 100);
    return totais;
  }, [movimentos]);

  const saldoDaConta = (l: LancamentoFinanceiro) => l.status === 'pago' ? 0 :
    Math.max(0, Math.round(l.valor * 100) - (pagosPorConta[l.id] || 0)) / 100;

  const caixaRealizado = useMemo(() => {
    let entradas = 0; let saidas = 0;
    const contas = new Map(lancamentos.map(l => [l.id, l]));
    for (const p of movimentos) {
      const l = contas.get(p.lancamento_id);
      if (!l) continue;
      const [ano, mes] = p.data_pagamento.split('-').map(Number);
      if ((mesFiltro && mes !== mesFiltro) || (anoFiltro && ano !== anoFiltro)) continue;
      if (!l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase())) continue;
      if (categoriaFiltro !== 'todos' && l.categoria !== categoriaFiltro) continue;
      if (fornecedorFiltro !== 'todos' && l.fornecedorId !== fornecedorFiltro) continue;
      if (tipoFiltro !== 'todos' && l.tipo !== tipoFiltro) continue;
      if (l.tipo === 'receita') entradas += Math.round(p.valor * 100);
      else saidas += Math.round(p.valor * 100);
    }
    return { entradas: entradas / 100, saidas: saidas / 100, saldo: (entradas - saidas) / 100 };
  }, [movimentos, lancamentos, mesFiltro, anoFiltro, buscaDescricao, categoriaFiltro, fornecedorFiltro, tipoFiltro]);

  const relatorioFornecedores = useMemo(() => {
    let listaBase = fornecedores;
    if (fornecedorDivida !== 'todos') listaBase = fornecedores.filter(f => f.id === fornecedorDivida);
    return listaBase.map(f => {
      const faturasPendentes = lancamentos.filter(l => l.fornecedorId === f.id && l.status === 'pendente' && l.tipo === 'despesa');
      const faturasOrdenadas = faturasPendentes.sort((a, b) => {
        if (ordemFaturas === 'vencimento_asc') return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
        if (ordemFaturas === 'emissao_desc') return (new Date(b.dataLancamento || 0).getTime()) - (new Date(a.dataLancamento || 0).getTime());
        if (ordemFaturas === 'valor_desc') return b.valor - a.valor;
        if (ordemFaturas === 'valor_asc') return a.valor - b.valor;
        return 0;
      });
      return { ...f, faturas: faturasOrdenadas, totalDevendo: faturasPendentes.reduce((a, b) => a + saldoDaConta(b), 0) };
    }).sort((a, b) => b.totalDevendo - a.totalDevendo);
  }, [fornecedores, lancamentos, fornecedorDivida, ordemFaturas, pagosPorConta]);

  const exportarFornecedor = async (fornecedor: Fornecedor) => {
    if (exportandoFornecedor) return;
    const janela = window.open('', '_blank');
    if (!janela) { alert('Permita abrir uma nova janela para visualizar o demonstrativo.'); return; }
    janela.opener = null;
    janela.document.body.textContent = 'Preparando demonstrativo...';
    setExportandoFornecedor(true);
    try {
      const { data: { user }, error: erroUsuario } = await supabase.auth.getUser();
      if (erroUsuario || !user) throw new Error('Entre no sistema novamente.');
      async function lerTabela(tabela: 'compras' | 'lancamentos') {
        const registros: Record<string, any>[] = [];
        for (let inicio = 0; ; inicio += 1000) {
          const { data, error } = await supabase.from(tabela).select('*')
            .eq('user_id', user!.id).eq('fornecedor_id', fornecedor.id)
            .order('id').range(inicio, inicio + 999);
          if (error) throw error;
          registros.push(...(data || []));
          if (!data || data.length < 1000) return registros;
        }
      }
      const [comprasDb, contasDb] = await Promise.all([lerTabela('compras'), lerTabela('lancamentos')]);
      const pagamentosDb: { lancamento_id: string; valor: number; data_pagamento: string }[] = [];
      const ids = contasDb.map(l => String(l.id));
      for (let inicioIds = 0; inicioIds < ids.length; inicioIds += 100) {
        for (let inicio = 0; ; inicio += 1000) {
          const { data, error } = await supabase.from('pagamentos')
            .select('id, lancamento_id, valor, data_pagamento').eq('user_id', user.id)
            .in('lancamento_id', ids.slice(inicioIds, inicioIds + 100))
            .order('id').range(inicio, inicio + 999);
          if (error) throw error;
          pagamentosDb.push(...(data || []).map(p => ({ ...p, valor: Number(p.valor) })));
          if (!data || data.length < 1000) break;
        }
      }
      const pedidos = comprasDb.map(c => ({ id: c.id, fornecedorId: c.fornecedor_id, statusChegada: c.status_chegada, numeroVale: c.numero_vale, codigoOrdem: c.codigo_ordem, dataCompra: c.data_compra, valorTotal: Number(c.valor_total), itens: (c.itens || []).map((i: any) => ({ nome: i.nome, quantidade: i.quantidade, custoUnitario: Number(i.custoUnitario), subtotal: Number(i.subtotal) })) })) as Compra[];
      const contas = contasDb.map(l => ({ id: l.id, fornecedorId: l.fornecedor_id, tipo: l.tipo, status: l.status, valor: Number(l.valor), dataLancamento: l.data_lancamento, dataVencimento: l.data_vencimento, compraId: l.compra_id })) as LancamentoFinanceiro[];
      const html = demonstrativoFornecedor(fornecedor, pedidos, contas, pagamentosDb);
      if (!janela.closed) { janela.document.open(); janela.document.write(html); janela.document.close(); }
    } catch (e) {
      janela.close();
      alert(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Não foi possível gerar o demonstrativo.');
    } finally { setExportandoFornecedor(false); }
  };

  const TOTAL_GERAL_DEVIDO = relatorioFornecedores.reduce((acc, forn) => acc + forn.totalDevendo, 0);

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      const dataLanc = new Date(l.dataVencimento + 'T12:00:00');
      const mes = dataLanc.getMonth() + 1; const ano = dataLanc.getFullYear();
      const matchBusca = l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase());
      const matchCat = categoriaFiltro === 'todos' || l.categoria === categoriaFiltro;
      return matchBusca && matchCat && (mesFiltro === 0 || mes === mesFiltro) && (anoFiltro === 0 || ano === anoFiltro) && (statusFiltro === 'todos' || l.status === statusFiltro) && (tipoFiltro === 'todos' || l.tipo === tipoFiltro) && (fornecedorFiltro === 'todos' || l.fornecedorId === fornecedorFiltro);
    }).sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
  }, [lancamentos, buscaDescricao, mesFiltro, anoFiltro, statusFiltro, tipoFiltro, fornecedorFiltro, categoriaFiltro]);

  const resumoFiltrado = useMemo(() => {
    const rec = lancamentosFiltrados.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
    const desp = lancamentosFiltrados.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
    return { receitas: rec, despesas: desp, saldo: rec - desp };
  }, [lancamentosFiltrados]);

  const diasCalendario = useMemo(() => {
    const primeiroDiaSemana = new Date(calAno, calMes - 1, 1).getDay();
    const totalDiasMes = new Date(calAno, calMes, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let i = 1; i <= totalDiasMes; i++) dias.push(`${calAno}-${String(calMes).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    return dias;
  }, [calAno, calMes]);

  const lancamentosDoCalendario = useMemo(() => {
    return lancamentos.filter(l => {
      const matchBusca = l.descricao.toLowerCase().includes(buscaDescricao.toLowerCase());
      const matchCat = categoriaFiltro === 'todos' || l.categoria === categoriaFiltro;
      return matchBusca && matchCat && (statusFiltro === 'todos' || l.status === statusFiltro) && (tipoFiltro === 'todos' || l.tipo === tipoFiltro) && (fornecedorFiltro === 'todos' || l.fornecedorId === fornecedorFiltro);
    });
  }, [lancamentos, buscaDescricao, statusFiltro, tipoFiltro, fornecedorFiltro, categoriaFiltro]);

  const mudarMesCal = (dir: number) => { let nMes = calMes + dir; let nAno = calAno; if (nMes > 12) { nMes = 1; nAno++; } if (nMes < 1) { nMes = 12; nAno--; } setCalMes(nMes); setCalAno(nAno); };

  const lidarDragStart = (e: any, id: string) => e.dataTransfer.setData('lancId', id);
  const lidarDragOver = (e: any) => e.preventDefault();
  const lidarDrop = async (e: any, dataAlvo: string) => {
    e.preventDefault(); const idLanc = e.dataTransfer.getData('lancId'); if (!idLanc || !dataAlvo) return;
    const userId = await getUserId(); if (!userId) return;
    try {
      const campo = modoArrastar === 'vencimento' ? 'data_vencimento' : 'data_lancamento';
      const { error } = await supabase.from('lancamentos').update({ [campo]: dataAlvo }).eq('id', idLanc).eq('user_id', userId);
      if (error) throw error;
    } catch (err) { console.error(err); }
  };

  const getCorCategoria = (nomeCat: string) => {
    const cat = categoriasDespesa.find(c => c.nome === nomeCat);
    return cat ? cat.cor : '#94a3b8';
  };

  return (
    <div className="animate-fade-in max-w-[1600px] mx-auto space-y-8 pb-32">
      {contaParcelamento && (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 no-print">
          <form onSubmit={salvarParcelamento} role="dialog" aria-modal="true" aria-label="Parcelar conta" className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between"><h3 className="text-xl font-bold">Parcelar conta</h3><button type="button" disabled={parcelando} onClick={() => setContaParcelamento(null)}>Fechar</button></div>
            <p>{contaParcelamento.descricao}</p>
            <p className="font-bold">Total a dividir: R$ {contaParcelamento.valor.toFixed(2)}</p>
            <label className="block">Quantidade de parcelas<input required type="number" min="2" max="60" step="1" value={quantidadeParcelas} onChange={e => setQuantidadeParcelas(e.target.value)} className="block w-full border rounded-lg p-3" /></label>
            <label className="block">Primeiro vencimento<input required type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} className="block w-full border rounded-lg p-3" /></label>
            <p className="text-sm text-slate-500">As parcelas serão mensais, sem juros. Meses mais curtos usam o último dia disponível. Eventuais centavos são distribuídos nas primeiras parcelas. Somente contas sem pagamentos e sem série podem ser divididas.</p>
            {erroParcelamento && <p role="alert" className="text-rose-600">{erroParcelamento}</p>}
            <button disabled={parcelando} className="w-full bg-blue-600 text-white rounded-lg p-3 font-bold disabled:opacity-50">{parcelando ? 'Criando...' : 'Confirmar parcelamento'}</button>
          </form>
        </div>
      )}
      {contaPagamento && (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 no-print">
          <div role="dialog" aria-modal="true" aria-label="Pagamentos da conta" className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between gap-4"><h3 className="text-xl font-bold">Pagamentos da conta</h3><button disabled={pagando} onClick={() => setContaPagamento(null)}>Fechar</button></div>
            <p className="font-semibold">{contaPagamento.descricao}</p>
            <p>Total: R$ {contaPagamento.valor.toFixed(2)} · Registrado: R$ {historico.reduce((t, p) => t + p.valor, 0).toFixed(2)}</p>
            <p className="font-bold text-blue-700">Saldo: R$ {(contaPagamento.status === 'pago' ? 0 : Math.max(0, contaPagamento.valor - historico.reduce((t, p) => t + p.valor, 0))).toFixed(2)}</p>
            {historico.map(p => <div key={p.id} className="border rounded-lg p-3 text-sm"><strong>R$ {p.valor.toFixed(2)}</strong> — {p.data_pagamento.split('-').reverse().join('/')}<p>{p.observacao}</p></div>)}
            {contaPagamento.status === 'pago' && historico.length === 0 && <p>Conta quitada pelo sistema anterior, sem histórico detalhado de pagamentos.</p>}
            {contaPagamento.status !== 'pago' && (
              <form onSubmit={salvarPagamento} className="space-y-3">
                <label className="block">Valor pago<input required type="number" min="0.01" step="0.01" value={valorPagamento} onChange={e => setValorPagamento(e.target.value)} className="block w-full border rounded-lg p-3" /></label>
                <label className="block">Data do pagamento<input required type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} className="block w-full border rounded-lg p-3" /></label>
                <label className="block">Observação<input maxLength={500} value={observacaoPagamento} onChange={e => setObservacaoPagamento(e.target.value)} className="block w-full border rounded-lg p-3" /></label>
                {erroPagamento && <p role="alert" className="text-rose-600">{erroPagamento}</p>}
                <button disabled={pagando} className="w-full bg-blue-600 text-white rounded-lg p-3 font-bold disabled:opacity-50">{pagando ? 'Salvando...' : 'Confirmar pagamento'}</button>
              </form>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `@media print { body * { visibility: hidden; } #relatorio-financeiro-pdf, #relatorio-financeiro-pdf * { visibility: visible; } #relatorio-financeiro-pdf { position: absolute; left: 0; top: 0; width: 100%; color: #000; padding: 20px; background-color: white; } .no-print { display: none !important; } }`}} />
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Financeiro</h2>
          <p className="text-slate-500 font-medium mt-1">Acompanhe suas contas, os pagamentos e os saldos por fornecedor.</p>
        </div>
        <div className="flex gap-3">
          {abaAtiva === 'caixa' && <button onClick={() => window.print()} className="px-6 py-3.5 rounded-2xl font-black flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-all duration-300 shadow-sm whitespace-nowrap">
            <span className="text-lg">🖨️</span> Relatório interno
          </button>}
          {abaAtiva === 'caixa' && <button onClick={() => setMostrarRelatorio(!mostrarRelatorio)} className={`px-6 py-3.5 rounded-2xl font-black flex items-center gap-3 border transition-all duration-300 shadow-sm whitespace-nowrap ${mostrarRelatorio ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}>
            <span className="text-lg">⚙️</span> {mostrarRelatorio ? 'Ocultar Filtros' : 'Filtros Avançados'}
          </button>}
        </div>
      </header>

      {mostrarRelatorio && abaAtiva === 'caixa' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl no-print animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4 text-xs">
            <div className="lg:col-span-2"><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Busca Específica</label><input type="text" value={draftBusca} onChange={(e) => setDraftBusca(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500" placeholder="Buscar palavra..." /></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Mês</label><select value={draftMes} onChange={(e) => setDraftMes(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value={0}>Todos</option>{Array.from({ length: 12 }, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'short' })}</option>))}</select></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Ano</label><select value={draftAno} onChange={(e) => setDraftAno(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value={0}>Todos</option><option value={2025}>2025</option><option value={2026}>2026</option></select></div>
            <div className="lg:col-span-2"><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label><select value={draftCategoria} onChange={(e) => setDraftCategoria(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none truncate"><option value="todos">Qualquer</option>{categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Status</label><select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as any)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value="todos">Todos</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option></select></div>
            <div><label className="block font-black text-slate-400 uppercase tracking-widest mb-2">Origem</label><select value={draftFornecedor} onChange={(e) => setDraftFornecedor(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none truncate"><option value="todos">Todos</option><option value="">Avulsos</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
            <button onClick={limparFiltros} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors">Limpar Filtros</button>
            <button onClick={aplicarFiltros} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-colors tracking-widest uppercase">Executar Filtro</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px no-print">
        <button onClick={() => setAbaAtiva('caixa')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 ${abaAtiva === 'caixa' ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 shadow-[0_-4px_15px_rgba(52,211,153,0.1)]' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>Contas e caixa</button>
        <button onClick={() => setAbaAtiva('fornecedores')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 ${abaAtiva === 'fornecedores' ? 'bg-rose-50 text-rose-600 border-t-2 border-rose-500' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>Contas de fornecedores</button>
        <button onClick={() => setAbaAtiva('calendario')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest rounded-t-2xl transition-all duration-300 ${abaAtiva === 'calendario' ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500' : 'bg-white text-slate-400 hover:bg-slate-50 border-t-2 border-transparent'}`}>Calendário</button>
      </div>

      {abaAtiva === 'caixa' && (
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 no-print">
        <h3 className="text-xl font-bold">Movimentação realizada</h3>
        <p className="text-sm text-slate-500">Valores registrados no histórico, pela data do pagamento ou recebimento. Usa os filtros de período, busca, categoria, fornecedor e tipo da aba Caixa. O filtro de status não altera este resumo. O saldo representa a diferença no período, sem saldo inicial.</p>
        {carregandoMovimentos ? <p>Atualizando pagamentos...</p> : erroMovimentos ? <p role="alert" className="text-rose-600">{erroMovimentos}</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <p className="bg-emerald-50 rounded-xl p-4">Recebido<strong className="block text-2xl text-emerald-700">R$ {caixaRealizado.entradas.toFixed(2)}</strong></p>
            <p className="bg-rose-50 rounded-xl p-4">Pago<strong className="block text-2xl text-rose-700">R$ {caixaRealizado.saidas.toFixed(2)}</strong></p>
            <p className="bg-blue-50 rounded-xl p-4">Diferença no período<strong className="block text-2xl text-blue-700">R$ {caixaRealizado.saldo.toFixed(2)}</strong></p>
          </div>
        )}
        <p className="text-xs text-slate-500">Contas quitadas pelo sistema antigo sem histórico não entram nestes valores. Calendário e relatório impresso continuam mostrando os valores integrais dos lançamentos por vencimento.</p>
      </section>
      )}

      {abaAtiva === 'caixa' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start animate-fade-in print:hidden">
          <div className="xl:col-span-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 h-fit sticky top-24">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="font-black text-xl text-slate-800 tracking-tight">{idEdicao ? 'Editar conta' : 'Nova conta'}</h3>

            </div>
            <form onSubmit={lidarSalvar} className="space-y-5">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button type="button" onClick={() => { setTipo('despesa'); setFornSelecionado(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tipo === 'despesa' ? 'bg-white text-rose-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Saída</button>
                <button type="button" onClick={() => { setTipo('receita'); setFornSelecionado(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tipo === 'receita' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Entrada</button>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
                <input type="text" required placeholder="Ex: Pagamento Mercado Livre" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">R$</span>
                    <input type="number" required step="0.01" placeholder="0.00" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black outline-none focus:border-indigo-500 font-mono text-slate-800" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Centro de Custo</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500">
                    <option value="">Geral</option>{categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data Emissão</label><input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vencimento</label><input type="date" required value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" /></div>
              </div>
              {tipo === 'despesa' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vincular a Fornecedor</label><select value={fornSelecionado} onChange={(e) => setFornSelecionado(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"><option value="">Nenhum (Avulso)</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
              )}
              {!idEdicao && (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3"><label className="flex items-center gap-3 font-black text-indigo-900 text-xs cursor-pointer"><input type="checkbox" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} className="w-5 h-5 accent-indigo-600" />🔁 Lançamento Mensal Recorrente?</label>{isRecorrente && (<div className="animate-fade-in"><label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1 mt-2">Duração (Meses)</label><input type="number" min="2" max="36" value={mesesRepetir} onChange={(e) => setMesesRepetir(e.target.value)} className="w-full px-4 py-3 border border-indigo-200 rounded-xl font-black text-lg text-indigo-600 bg-white outline-none" /></div>)}</div>
              )}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="submit" className={`flex-1 py-4 rounded-xl font-black text-white text-sm tracking-widest uppercase shadow-lg transition-transform hover:scale-105 ${tipo === 'despesa' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'}`}>{idEdicao ? 'Atualizar Registro' : 'Salvar Registro'}</button>
                {idEdicao && <button type="button" onClick={limparFormulario} className="px-6 bg-slate-200 text-slate-600 font-black uppercase text-xs rounded-xl hover:bg-slate-300">Cancelar</button>}
              </div>
            </form>
          </div>
          <div className="xl:col-span-8 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5 text-4xl">💰</div>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Receitas previstas</p>
                <p className="text-2xl font-black text-white font-mono tracking-tight">R$ {resumoFiltrado.receitas.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5 text-4xl">📉</div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Despesas previstas</p>
                <p className="text-2xl font-black text-white font-mono tracking-tight">R$ {resumoFiltrado.despesas.toFixed(2)}</p>
              </div>
              <div className="bg-black p-5 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.1)] border border-emerald-900/50 flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none"></div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 relative z-10 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Resultado previsto</p>
                <p className={`text-2xl font-black font-mono tracking-tight relative z-10 ${resumoFiltrado.saldo >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>R$ {resumoFiltrado.saldo.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-[#0b1120] rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none z-0 opacity-20"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 opacity-80"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500 opacity-80"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-80"></span>
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Extrato Financeiro</p>
                </div>
                <button onClick={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }} className={`mt-4 sm:mt-0 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all border ${modoSelecao ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.2)]' : 'bg-slate-800 text-blue-400 hover:text-white border-slate-700 hover:border-blue-500'}`}>
                  {modoSelecao ? '✕ Cancelar Seleção' : '✏️ Edição em Lote'}
                </button>
              </div>
              {modoSelecao && (
                <div className="bg-blue-900/20 border-b border-blue-500/30 p-4 flex flex-wrap gap-4 items-center justify-between relative z-10 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <button onClick={selecionarTodos} className="text-[10px] font-black uppercase font-mono bg-blue-950 border border-blue-500 text-blue-400 hover:bg-blue-900 hover:text-white px-3 py-2 rounded transition-colors">&gt;&gt; Selecionar Todos</button>
                    <span className="text-xs font-mono text-blue-300 font-bold">[{selecionados.length} itens selecionados]</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select value={categoriaLote} onChange={e => setCategoriaLote(e.target.value)} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded font-mono text-xs text-blue-400 outline-none focus:border-blue-500 flex-1">
                      <option value="">Escolher Nova Categoria...</option>
                      {categoriasDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                      <option value="Geral">Pasta Geral</option>
                    </select>
                    <button onClick={aplicarCategoriaEmMassa} disabled={processandoLote || selecionados.length === 0 || !categoriaLote} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black font-mono rounded text-xs transition-all disabled:opacity-50">
                      {processandoLote ? 'Aplicando...' : 'Aplicar Lote'}
                    </button>
                  </div>
                </div>
              )}
              <div className="relative z-10">
                {lancamentosFiltrados.length === 0 ? (
                  <div className="p-16 text-center">
                    <span className="text-4xl text-slate-700 block mb-3 font-mono">_</span>
                    <p className="font-mono text-slate-500 text-sm uppercase tracking-widest">Nenhum registro encontrado no período.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {lancamentosFiltrados.map(lanc => {
                      const isAtrasado = lanc.status === 'pendente' && lanc.tipo === 'despesa' && lanc.dataVencimento < new Date().toISOString().split('T')[0];
                      const selecionado = selecionados.includes(lanc.id);
                      return (
                        <div key={lanc.id} className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-800/50 ${lanc.status === 'pago' ? 'opacity-60 grayscale-[50%]' : ''} ${selecionado ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : 'border-l-4 border-transparent'}`}>
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {modoSelecao && (
                              <input type="checkbox" checked={selecionado} onChange={() => { if(selecionado) setSelecionados(selecionados.filter(i=>i!==lanc.id)); else setSelecionados([...selecionados, lanc.id]); }} className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0 rounded bg-slate-900 border-slate-700" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-1.5">
                                {!modoSelecao && (
                                  <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${lanc.tipo === 'despesa' ? 'bg-rose-500 text-rose-500' : 'bg-emerald-500 text-emerald-500'}`}></div>
                                )}
                                <p className={`font-bold text-sm truncate ${lanc.tipo === 'despesa' ? 'text-slate-200' : 'text-emerald-100'}`}>{lanc.descricao}</p>
                                {lanc.recorrente && <span className="bg-blue-900/50 text-blue-400 border border-blue-500/30 text-[9px] font-black font-mono px-1.5 py-0.5 rounded">MENSAL</span>}
                                {lanc.categoria && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border opacity-80" style={{ borderColor: getCorCategoria(lanc.categoria), color: getCorCategoria(lanc.categoria), backgroundColor: `${getCorCategoria(lanc.categoria)}15` }}>{lanc.categoria}</span>}
                              </div>
                              <p className="text-[10px] font-mono text-slate-500">
                                Emissão: {lanc.dataLancamento ? lanc.dataLancamento.split('-').reverse().join('/') : '---'} // Vencimento: <span className={isAtrasado ? 'text-rose-500 font-bold bg-rose-500/10 px-1 rounded' : 'text-slate-400'}>{lanc.dataVencimento.split('-').reverse().join('/')}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-5">
                            <span className={`font-mono text-xl font-black tracking-tight ${lanc.tipo === 'despesa' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {lanc.tipo === 'despesa' ? '-' : '+'}R${lanc.valor.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => alternarStatus(lanc)} disabled={modoSelecao} className={`px-4 py-2 text-[10px] font-black uppercase font-mono rounded border transition-all disabled:opacity-30 ${lanc.status === 'pago' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/50 hover:bg-emerald-500 hover:text-white shadow-[0_0_10px_rgba(52,211,153,0.1)]'}`}>
                                {lanc.status === 'pago' ? 'Histórico' : 'Pagar / histórico'}
                              </button>
                              {lanc.status === 'pendente' && !lanc.grupoRecorrenciaId && <button onClick={() => abrirParcelamento(lanc)} disabled={modoSelecao} className="px-3 py-2 text-xs font-bold bg-blue-600 text-white rounded">Parcelar</button>}
                              <button onClick={() => iniciarEdicao(lanc)} disabled={modoSelecao} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-700 transition-colors disabled:opacity-30">✏️</button>
                              <button onClick={() => excluirLancamento(lanc)} disabled={modoSelecao} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-rose-500 hover:bg-rose-500 hover:text-white rounded border border-slate-700 transition-colors disabled:opacity-30">✕</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {abaAtiva === 'fornecedores' && (
        <section className="space-y-5 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-bold">Contas de fornecedores</h3><p className="text-sm text-slate-500 mt-1">As mesmas despesas do caixa, agrupadas por fornecedor. Todos os vencimentos estão incluídos.</p></div><div><span className="text-sm text-slate-500">Saldo pendente da seleção</span><strong className="block text-2xl text-rose-600">{carregandoMovimentos ? 'Carregando...' : erroMovimentos ? 'Indisponível' : `R$ ${TOTAL_GERAL_DEVIDO.toFixed(2)}`}</strong></div></div>
            <div className="flex flex-wrap gap-3"><label className="text-sm">Fornecedor<select value={fornecedorDivida} onChange={e => setFornecedorDivida(e.target.value)} className="block border rounded-lg p-3"><option value="todos">Todos os fornecedores</option>{fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label><label className="text-sm">Ordenar contas<select value={ordemFaturas} onChange={e => setOrdemFaturas(e.target.value as typeof ordemFaturas)} className="block border rounded-lg p-3"><option value="vencimento_asc">Vencimento mais próximo</option><option value="emissao_desc">Emissão mais recente</option><option value="valor_desc">Maior valor</option><option value="valor_asc">Menor valor</option></select></label></div>
            <p className="text-xs text-slate-500">O demonstrativo abre para conferência antes de salvar em PDF. Inclui somente compras, contas e pagamentos do fornecedor escolhido; não inclui observações internas, lucro, preços de venda ou dados de outros fornecedores.</p>
            {erroMovimentos && <p role="alert" className="text-rose-600">Não foi possível calcular os saldos: {erroMovimentos}</p>}
          </div>
          {relatorioFornecedores.length === 0 && <p className="bg-white border rounded-2xl p-8 text-slate-500">Nenhum fornecedor cadastrado nesta seleção.</p>}
          {relatorioFornecedores.map(forn => (
            <div key={forn.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="p-5 flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-lg font-bold">{forn.nome}</h3><p className="text-sm text-slate-500">{forn.faturas.length} conta(s) pendente(s)</p></div><div className="flex flex-wrap items-center gap-4"><strong className="text-xl text-rose-600">{carregandoMovimentos ? '...' : erroMovimentos ? 'Indisponível' : `R$ ${forn.totalDevendo.toFixed(2)}`}</strong><button disabled={exportandoFornecedor} onClick={() => exportarFornecedor(forn)} className="bg-blue-600 text-white rounded-lg px-4 py-3 font-bold text-sm disabled:opacity-50">{exportandoFornecedor ? 'Preparando...' : 'Demonstrativo para fornecedor'}</button></div></div>
              <details className="border-t border-slate-100"><summary className="cursor-pointer px-5 py-4 font-semibold text-slate-600">Ver contas e registrar pagamentos</summary><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr><th className="p-4">Conta</th><th className="p-4">Vencimento</th><th className="p-4">Valor original</th><th className="p-4">Saldo</th><th className="p-4">Ações</th></tr></thead><tbody>{forn.faturas.map(fat => <tr key={fat.id} className="border-t border-slate-100"><td className="p-4">{fat.descricao}</td><td className="p-4 whitespace-nowrap">{fat.dataVencimento.split('-').reverse().join('/')}</td><td className="p-4 whitespace-nowrap">R$ {fat.valor.toFixed(2)}</td><td className="p-4 font-bold whitespace-nowrap">{carregandoMovimentos ? '...' : erroMovimentos ? 'Indisponível' : `R$ ${saldoDaConta(fat).toFixed(2)}`}</td><td className="p-4"><div className="flex gap-2"><button onClick={() => alternarStatus(fat)} className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg font-bold">Pagar</button>{!fat.grupoRecorrenciaId && <button onClick={() => abrirParcelamento(fat)} className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">Parcelar</button>}<button onClick={() => iniciarEdicao(fat)} className="px-3 py-2 border rounded-lg">Editar</button>{compras.find(c => c.id === fat.compraId) && <button onClick={() => setCompraModal(compras.find(c => c.id === fat.compraId)!)} className="px-3 py-2 border rounded-lg whitespace-nowrap">Ver compra</button>}</div></td></tr>)}</tbody></table>{!forn.faturas.length && <p className="p-5 text-slate-500">Nenhuma conta pendente. O demonstrativo continua disponível para consultar as compras e quitações.</p>}</div></details>
            </div>
          ))}
        </section>
      )}

      {abaAtiva === 'calendario' && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-fade-in print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Calendário Drag & Drop</h3>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200"><button onClick={() => setModoArrastar('vencimento')} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${modoArrastar === 'vencimento' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>Alvo: Vencimento</button><button onClick={() => setModoArrastar('emissao')} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${modoArrastar === 'emissao' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}>Alvo: Emissão</button></div>
              <div className="flex gap-2 bg-slate-900 p-1.5 rounded-2xl shadow-lg border border-slate-800"><button onClick={() => mudarMesCal(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">◀</button><h3 className="text-sm font-black text-white w-32 text-center uppercase tracking-widest self-center">{new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'short' })} {calAno}</h3><button onClick={() => mudarMesCal(1)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">▶</button></div>
            </div>
          </div>
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200"><div className="min-w-[900px]">
            <div className="grid grid-cols-7 bg-slate-900 text-white overflow-hidden">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="p-4 text-center text-xs font-black uppercase tracking-widest">{d}</div>)}</div>
            <div className="grid grid-cols-7 bg-slate-50">
              {diasCalendario.map((dataStr, index) => {
                if (!dataStr) return <div key={`e-${index}`} className="bg-slate-100 border-r border-b border-slate-200 min-h-[140px]"></div>;
                const faturasDoDia = lancamentosDoCalendario.filter(l => (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)) === dataStr);
                const isHoje = dataStr === new Date().toISOString().split('T')[0];
                return (
                  <div key={dataStr} onDragOver={lidarDragOver} onDrop={(e) => lidarDrop(e, dataStr)} className={`min-h-[140px] p-2 border-r border-b border-slate-200 transition-colors hover:bg-blue-50/50 ${isHoje ? 'bg-indigo-50/30' : 'bg-white'}`}>
                    <p className={`text-xs font-black mb-2 flex justify-between ${isHoje ? 'text-indigo-600' : 'text-slate-400'}`}><span>{parseInt(dataStr.split('-')[2])}</span> {isHoje && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>}</p>
                    <div className="space-y-1.5">{faturasDoDia.map(fat => (
                      <div key={fat.id} draggable onDragStart={(e) => lidarDragStart(e, fat.id)} className={`p-1.5 text-[10px] rounded-lg shadow-sm cursor-grab border ${fat.status === 'pago' ? 'opacity-40 grayscale' : ''} ${fat.tipo === 'despesa' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                        <p className="truncate font-bold mb-0.5">{fat.descricao}</p><p className="font-black font-mono tracking-tight">R$ {fat.valor.toFixed(2)}</p>
                      </div>
                    ))}</div>
                  </div>
                );
              })}
            </div>
          </div></div>
          <div className="mt-8 flex flex-col md:flex-row justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Resumo: {new Date(calAno, calMes - 1).toLocaleString('pt-BR', { month: 'long' })}</p>
            <div className="flex gap-8 relative z-10">
              <div className="text-right"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Receitas (+)</p><p className="font-black text-white text-2xl font-mono">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'receita' && (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)).startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
              <div className="w-px bg-slate-800"></div>
              <div className="text-right"><p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Despesas (-)</p><p className="font-black text-white text-2xl font-mono">R$ {lancamentosDoCalendario.filter(l => l.tipo === 'despesa' && (modoArrastar === 'vencimento' ? l.dataVencimento : (l.dataLancamento || l.dataVencimento)).startsWith(`${calAno}-${String(calMes).padStart(2,'0')}`)).reduce((a,b)=>a+b.valor,0).toFixed(2)}</p></div>
            </div>
          </div>
        </div>
      )}

      <div id="relatorio-financeiro-pdf" className="hidden print:block w-full bg-white text-slate-900">
        <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-8">
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Extrato Financeiro</h1>
            <p className="text-slate-500 font-bold mt-2 text-sm">Documento Extraído: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Receitas previstas</p>
              <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight">R$ {resumoFiltrado.receitas.toFixed(2)}</p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Despesas previstas</p>
              <p className="text-2xl font-black text-rose-600 font-mono tracking-tight">R$ {resumoFiltrado.despesas.toFixed(2)}</p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Resultado previsto</p>
              <p className={`text-2xl font-black font-mono tracking-tight ${resumoFiltrado.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {resumoFiltrado.saldo.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Data Emissão</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Data Venc.</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Descrição da Transação</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Centro de Custo</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">Status</th>
              <th className="p-3 font-black text-slate-600 uppercase tracking-widest text-[10px] text-right">Valor Operado</th>
            </tr>
          </thead>
          <tbody>
            {lancamentosFiltrados.map(l => (
              <tr key={l.id} className="border-b border-slate-200">
                <td className="p-3 font-mono">{l.dataLancamento ? l.dataLancamento.split('-').reverse().join('/') : '---'}</td>
                <td className="p-3 font-mono font-bold">{l.dataVencimento.split('-').reverse().join('/')}</td>
                <td className="p-3 font-bold text-slate-800">{l.descricao}</td>
                <td className="p-3 text-slate-500">{l.categoria}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${l.status === 'pago' ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-600'}`}>{l.status}</span></td>
                <td className={`p-3 text-right font-black font-mono text-lg ${l.tipo === 'despesa' ? 'text-rose-600' : 'text-emerald-600'}`}>{l.tipo === 'despesa' ? '-' : '+'} R$ {l.valor.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compraModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-center items-center p-4 animate-fade-in no-print">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl"></div>
              <div className="relative z-10"><p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Detalhes do Vale</p><h3 className="text-3xl font-black tracking-tight">{compraModal.codigoOrdem}</h3></div>
              <button onClick={() => setCompraModal(null)} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full font-black text-xl flex items-center justify-center transition-colors relative z-10">✕</button>
            </div>
            <div className="p-8 overflow-y-auto"><div className="grid grid-cols-2 gap-6 mb-8 border-b border-slate-100 pb-8"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fornecedor</p><p className="font-black text-slate-800 text-xl">{compraModal.fornecedorNome}</p></div><div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">NF / Vale Relacionado</p><p className="font-black text-slate-800 text-xl font-mono">{compraModal.numeroVale || 'N/A'}</p></div></div>
              <div className="space-y-3 mb-6">{compraModal.itens.map(item => (<div key={item.produtoId} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100"><div><p className="font-black text-slate-800">{item.nome}</p><p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{item.quantidade} UN x R$ {item.custoUnitario.toFixed(2)}</p></div><span className="font-black text-slate-900 text-lg font-mono tracking-tight">R$ {item.subtotal.toFixed(2)}</span></div>))}</div>
            </div>
            <div className="bg-slate-50 p-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-6 mt-auto"><button onClick={() => excluirValeInteiro(compraModal.id)} className="px-6 py-3 text-rose-600 hover:text-white bg-white hover:bg-rose-600 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-widest transition-colors w-full sm:w-auto">🗑️ Excluir Vale Completo</button><div className="text-center sm:text-right w-full sm:w-auto"><p className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-1">Total do Vale</p><p className="text-4xl font-black text-slate-900 font-mono tracking-tight">R$ {compraModal.valorTotal.toFixed(2)}</p></div></div>
          </div>
        </div>
      )}
    </div>
  );
}
