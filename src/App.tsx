import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Produto, Plataforma, CustoPadrao, Categoria, CategoriaDespesa, Fornecedor, LancamentoFinanceiro, Compra, Midia } from './types';
import Login from './telas/Login';
import Dashboard from './telas/Dashboard';
import Configuracoes from './telas/Configuracoes';
import { Produtos } from './telas/Produtos';
import Perfil from './telas/Perfil';
import CriadorKit from './telas/CriadorKit';
import Custos from './telas/Custos';
import Fornecedores from './telas/Fornecedores';
import Financeiro from './telas/Financeiro';
import CalculadoraRapida from './telas/CalculadoraRapida';
import BackupManager from './telas/BackupManager';
import GaleriaMidia from './telas/GaleriaMidia';
import CriadorAnuncio from './telas/CriadorAnuncio';

export default function App() {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [isLogado, setIsLogado] = useState(false);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [telaAtiva, setTelaAtiva] = useState('dashboard');
  const [menuAberto, setMenuAberto] = useState(false);
  const [emailUsuario, setEmailUsuario] = useState('');

  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [custosPadrao, setCustosPadrao] = useState<CustoPadrao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasDespesa, setCategoriasDespesa] = useState<CategoriaDespesa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [midias, setMidias] = useState<Midia[]>([]);

  const carregarDados = useCallback(async (userId: string) => {
    const [platRes, prodRes, custosRes, catRes, catDespRes, fornRes, lancRes, compRes, midRes] = await Promise.all([
      supabase.from('plataformas').select('*').eq('user_id', userId),
      supabase.from('produtos').select('*').eq('user_id', userId),
      supabase.from('custos_padrao').select('*').eq('user_id', userId),
      supabase.from('categorias').select('*').eq('user_id', userId),
      supabase.from('categorias_despesas').select('*').eq('user_id', userId),
      supabase.from('fornecedores').select('*').eq('user_id', userId),
      supabase.from('lancamentos').select('*').eq('user_id', userId),
      supabase.from('compras').select('*').eq('user_id', userId),
      supabase.from('midias').select('*').eq('user_id', userId),
    ]);

    if (platRes.data) setPlataformas(platRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, comissao: Number(i.comissao || 0), comissaoAfiliado: Number(i.comissao_afiliado || 0),
      taxaFixa: Number(i.taxa_fixa || 0), freteFixo: Number(i.frete_fixo || 0), logo: i.logo || '',
      cor: i.cor, textoCor: i.texto_cor,
    })));
    if (prodRes.data) setProdutos(prodRes.data.map((i: any) => ({
      id: i.id, foto: i.foto || '', titulo: i.titulo, codigo: i.codigo, categoria: i.categoria,
      custoAds: Number(i.custo_ads || 0), custoBase: Number(i.custo_base || 0), custosAdicionais: i.custos_adicionais || [],
      custoTotal: Number(i.custo_total || 0), tipoLucro: i.tipo_lucro, valorLucro: Number(i.valor_lucro || 0),
      isKit: i.is_kit, estoque: Number(i.estoque || 0), estoqueMinimo: Number(i.estoque_minimo || 0),
    })));
    if (custosRes.data) setCustosPadrao(custosRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, valor: Number(i.valor || 0), icone: i.icone || '📦',
    })));
    if (catRes.data) setCategorias(catRes.data.map((i: any) => ({ id: i.id, nome: i.nome })));
    if (catDespRes.data) setCategoriasDespesa(catDespRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, cor: i.cor || '#3b82f6',
    })));
    if (fornRes.data) setFornecedores(fornRes.data.map((i: any) => ({
      id: i.id, nome: i.nome, contato: i.contato || '', categoriaInsumo: i.categoria_insumo || '',
    })));
    if (lancRes.data) setLancamentos(lancRes.data.map((i: any) => ({
      id: i.id, tipo: i.tipo, descricao: i.descricao, valor: Number(i.valor || 0),
      dataVencimento: i.data_vencimento, dataLancamento: i.data_lancamento, status: i.status,
      categoria: i.categoria || '', fornecedorId: i.fornecedor_id, compraId: i.compra_id,
      recorrente: i.recorrente, grupoRecorrenciaId: i.grupo_recorrencia_id,
    })));
    if (compRes.data) setCompras(compRes.data.map((i: any) => ({
      id: i.id, codigoOrdem: i.codigo_ordem, statusChegada: i.status_chegada,
      fornecedorId: i.fornecedor_id, fornecedorNome: i.fornecedor_nome, dataCompra: i.data_compra,
      dataPagamento: i.data_pagamento, numeroVale: i.numero_vale, itens: i.itens || [],
      valorTotal: Number(i.valor_total || 0), statusPagamento: i.status_pagamento, faturaGerada: i.fatura_gerada,
    })));
    if (midRes.data) setMidias(midRes.data.map((i: any) => ({
      id: i.id, titulo: i.titulo || '', url: i.url, url_thumb: i.url_thumb,
      album: i.album || '', dataCriacao: i.data_criacao || i.created_at,
    })));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsLogado(true);
        setEmailUsuario(session.user.email || '');
        setUsuarioId(session.user.id);
      } else {
        setUsuarioId(null);
        setIsLogado(false);
