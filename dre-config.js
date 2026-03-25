/**
 * ═══════════════════════════════════════════════════════════════════════
 * CONFIGURAÇÃO DO DRE - VITAL DIAGNOSTIC / FLUXA
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Este arquivo define TODA a estrutura do DRE do sistema.
 * Para adicionar/remover/modificar contas, edite apenas este arquivo.
 * O sistema irá automaticamente:
 * - Gerar os campos de agregação (f_fat, f_recnop, etc.)
 * - Calcular os KPIs corretamente
 * - Criar os dropdowns de classificação
 * - Atualizar a API de classificação automática
 * - Gerar os passos do modal de detalhes
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const DRE_CONFIG = {
  
  /**
   * ───────────────────────────────────────────────────────────────────
   * 1. CATEGORIAS DISPONÍVEIS
   * ───────────────────────────────────────────────────────────────────
   * 
   * Define todas as categorias que podem ser usadas para classificar
   * linhas do DRE importado.
   * 
   * Propriedades:
   * - id: identificador único (usado no código)
   * - field: nome do campo de agregação (f_fat, f_recnop, etc.)
   * - label: nome exibido na interface
   * - icon: emoji para UI
   * - color: cor hex para visualizações
   * - type: 'income' (soma) ou 'expense' (subtrai)
   * - aiDescription: descrição para a IA classificadora
   * - order: ordem de exibição nos dropdowns
   */
  categories: [
    {
      id: 'receita_bruta',
      field: 'f_fat',
      label: 'Receita Bruta',
      icon: '💰',
      color: '#00e89b',
      type: 'income',
      order: 1,
      aiDescription: 'Faturamento, vendas brutas, receita de serviços'
    },
    {
      id: 'deducao_receita',
      field: 'f_ded',
      label: 'Dedução de Receita',
      icon: '➖',
      color: '#64748b',
      type: 'expense',
      order: 2,
      aiDescription: 'Impostos sobre venda (PIS, COFINS, ISS, ICMS), devoluções, abatimentos'
    },
    {
      id: 'custo_variavel',
      field: 'f_cmv',
      label: 'CMV / Custo do Produto',
      icon: '📦',
      color: '#ef4444',
      type: 'expense',
      order: 3,
      aiDescription: 'CMV, custo dos serviços prestados, matéria-prima, custo direto do produto'
    },
    {
      id: 'custo_variavel_comercial',
      field: 'f_cvc',
      label: 'Custo Variável Comercial',
      icon: '🤝',
      color: '#f97316',
      type: 'expense',
      order: 4,
      aiDescription: 'Comissões de venda, frete sobre vendas, embalagens — custos que variam com o volume de vendas mas não são o produto em si'
    },
    {
      id: 'despesa_comercial',
      field: 'f_dc',
      label: 'Despesa Comercial',
      icon: '📣',
      color: '#3b82f6',
      type: 'expense',
      order: 5,
      aiDescription: 'Marketing, publicidade, propaganda — custos fixos de venda'
    },
    {
      id: 'despesa_pessoal',
      field: 'f_pessoal',
      label: 'Despesa com Pessoal',
      icon: '👥',
      color: '#a855f7',
      type: 'expense',
      order: 6,
      aiDescription: 'Salários, pró-labore, encargos, benefícios, folha de pagamento'
    },
    {
      id: 'despesa_administrativa',
      field: 'f_adm',
      label: 'Despesa Administrativa',
      icon: '🏢',
      color: '#f59e0b',
      type: 'expense',
      order: 7,
      aiDescription: 'Aluguel, software, utilidades, serviços gerais, telefone, escritório'
    },
    {
      id: 'despesa_financeira',
      field: 'f_depfin',
      label: 'Despesa Financeira',
      icon: '🏦',
      color: '#ef4444',
      type: 'expense',
      order: 8,
      aiDescription: 'Juros, IOF, tarifas bancárias, despesas com empréstimos',
      // NOTA: despesa_financeira e imposto_lucro compartilham o mesmo field (f_depfin)
      aggregateWith: 'imposto_lucro'
    },
    {
      id: 'imposto_lucro',
      field: 'f_depfin',
      label: 'Imposto s/ Lucro (IR/CSLL)',
      icon: '🏛',
      color: '#dc2626',
      type: 'expense',
      order: 9,
      aiDescription: 'Imposto de Renda (IR/IRPJ), CSLL — impostos sobre o LUCRO',
      aggregateWith: 'despesa_financeira'
    },
    {
      id: 'depreciacao',
      field: 'f_dep',
      label: 'Depreciação / Amortização',
      icon: '📉',
      color: '#64748b',
      type: 'expense',
      order: 10,
      aiDescription: 'Depreciação de ativos fixos, amortização'
    },
    {
      id: 'receita_nao_operacional',
      field: 'f_recnop',
      label: 'Receita Não Operacional',
      icon: '💎',
      color: '#10b981',
      type: 'income',
      order: 11,
      aiDescription: 'Receitas excepcionais, venda de ativos, juros recebidos, ganhos não operacionais'
    },
    {
      id: 'ignorar',
      field: null, // não agrega
      label: 'Ignorar (total/subtotal)',
      icon: '🚫',
      color: '#374151',
      type: null,
      order: 99,
      aiDescription: 'TOTAIS, subtotais, linhas de resultado (Lucro Bruto, EBITDA, Margem Bruta, Margem Contribuição, Resultado Líquido), linhas zeradas, cabeçalhos, percentuais'
    }
  ],

  /**
   * ───────────────────────────────────────────────────────────────────
   * 2. ESTRUTURA DO DRE (CASCATA DE CÁLCULO)
   * ───────────────────────────────────────────────────────────────────
   * 
   * Define a ordem de cálculo do DRE, do topo (Receita Bruta) até
   * o final (Lucro Líquido).
   * 
   * Tipos de step:
   * - 'category': usa uma categoria definida acima
   * - 'result': linha de resultado calculado (ex: Receita Líquida, EBITDA)
   * 
   * Operações:
   * - 'start': ponto de partida (normalmente receita_bruta)
   * - 'add': soma ao resultado anterior
   * - 'subtract': subtrai do resultado anterior
   * - 'result': linha calculada (não é categoria, é resultado)
   * 
   * IMPORTANTE:
   * - A ordem aqui define EXATAMENTE como os KPIs serão calculados
   * - Adicionar uma categoria entre dois resultados automaticamente
   *   afeta todos os KPIs subsequentes
   */
  structure: [
    // ── RECEITA BRUTA → RECEITA LÍQUIDA ──
    {
      step: 'receita_bruta',
      type: 'category',
      operation: 'start',
      label: 'Receita Bruta'
    },
    {
      step: 'deducao_receita',
      type: 'category',
      operation: 'subtract',
      label: 'Deduções (Impostos s/ Venda)'
    },
    {
      step: 'receita_liquida',
      type: 'result',
      operation: 'result',
      label: 'Receita Líquida',
      formula: 'receita_bruta - deducao_receita',
      // Este é a BASE de todos os KPIs percentuais (convenção CVM/B3)
      isBase: true
    },

    // ── RECEITA LÍQUIDA → LUCRO BRUTO ──
    {
      step: 'custo_variavel',
      type: 'category',
      operation: 'subtract',
      label: 'CMV / Custo do Produto'
    },
    {
      step: 'lucro_bruto',
      type: 'result',
      operation: 'result',
      label: 'Lucro Bruto',
      formula: 'receita_liquida - custo_variavel'
    },

    // ── LUCRO BRUTO → MARGEM DE CONTRIBUIÇÃO ──
    {
      step: 'custo_variavel_comercial',
      type: 'category',
      operation: 'subtract',
      label: 'Custo Variável Comercial'
    },
    {
      step: 'margem_contribuicao',
      type: 'result',
      operation: 'result',
      label: 'Margem de Contribuição',
      formula: 'lucro_bruto - custo_variavel_comercial'
    },

    // ── MARGEM DE CONTRIBUIÇÃO → EBITDA ──
    {
      step: 'despesa_comercial',
      type: 'category',
      operation: 'subtract',
      label: 'Despesa Comercial'
    },
    {
      step: 'despesa_pessoal',
      type: 'category',
      operation: 'subtract',
      label: 'Despesas com Pessoal'
    },
    {
      step: 'despesa_administrativa',
      type: 'category',
      operation: 'subtract',
      label: 'Despesas Administrativas'
    },
    {
      step: 'ebitda',
      type: 'result',
      operation: 'result',
      label: 'EBITDA',
      formula: 'margem_contribuicao - despesa_comercial - despesa_pessoal - despesa_administrativa',
      note: 'Earnings Before Interest, Taxes, Depreciation and Amortization'
    },

    // ── EBITDA → LUCRO LÍQUIDO ──
    {
      step: 'depreciacao',
      type: 'category',
      operation: 'subtract',
      label: 'Depreciação / Amortização'
    },
    {
      step: 'despesa_financeira',
      type: 'category',
      operation: 'subtract',
      label: 'Despesas Financeiras'
    },
    {
      step: 'imposto_lucro',
      type: 'category',
      operation: 'subtract',
      label: 'IR / CSLL'
    },
    {
      step: 'receita_nao_operacional',
      type: 'category',
      operation: 'add',
      label: 'Receita Não Operacional'
    },
    {
      step: 'lucro_liquido',
      type: 'result',
      operation: 'result',
      label: 'Lucro Líquido',
      formula: 'ebitda - depreciacao - despesa_financeira - imposto_lucro + receita_nao_operacional'
    }
  ],

  /**
   * ───────────────────────────────────────────────────────────────────
   * 3. DEFINIÇÃO DOS KPIs
   * ───────────────────────────────────────────────────────────────────
   * 
   * Cada KPI define:
   * - Como é calculado (fórmula)
   * - Qual a meta padrão
   * - Se "higher is better" ou "lower is better"
   * - Quais categorias afetam sua confiabilidade
   * 
   * GERAÇÃO AUTOMÁTICA:
   * Se você definir `autoFromStructure: true`, o sistema irá
   * automaticamente descobrir quais categorias afetam o KPI
   * baseado na posição dele na estrutura do DRE.
   */
  kpis: {
    receita: {
      id: 'receita',
      name: 'Receita Bruta',
      short: 'Receita',
      icon: '💰',
      unit: 'R$',
      group: 'tracao',
      goalDef: 100000,
      higherIsBetter: true,
      formula: 'Faturamento bruto do período',
      description: 'Receita total gerada pelas vendas antes de qualquer dedução. Principal indicador de tração e crescimento.',
      // Derivado automaticamente da estrutura:
      autoFromStructure: true,
      structurePoint: 'receita_bruta' // pega o valor deste ponto
    },

    cac: {
      id: 'cac',
      name: 'CAC (Despesa Comercial %)',
      short: 'CAC%',
      icon: '🎯',
      unit: '%',
      group: 'tracao',
      goalDef: 8,
      higherIsBetter: false,
      formula: 'Despesa Comercial ÷ Receita Líquida × 100',
      description: 'Percentual da receita líquida investido em despesas comerciais. Quanto menor, mais eficiente.',
      autoFromStructure: true,
      structurePoint: 'despesa_comercial',
      base: 'receita_liquida'
    },

    margbruta: {
      id: 'margbruta',
      name: 'Margem Bruta %',
      short: 'Mg.Bruta',
      icon: '📦',
      unit: '%',
      group: 'rentab',
      goalDef: 45,
      higherIsBetter: true,
      formula: '(Receita Líquida − CMV) ÷ Receita Líquida × 100',
      description: 'Percentual que sobra após o custo direto do produto ou serviço. Indica a viabilidade do modelo antes das despesas operacionais.',
      autoFromStructure: true,
      structurePoint: 'lucro_bruto',
      base: 'receita_liquida'
    },

    margem: {
      id: 'margem',
      name: 'Margem de Contribuição %',
      short: 'Margem',
      icon: '💹',
      unit: '%',
      group: 'rentab',
      goalDef: 40,
      higherIsBetter: true,
      formula: '(Lucro Bruto − Custo Variável Comercial) ÷ Receita Líquida × 100',
      description: 'Percentual que sobra após custos variáveis para cobrir despesas fixas e gerar lucro.',
      autoFromStructure: true,
      structurePoint: 'margem_contribuicao',
      base: 'receita_liquida'
    },

    ebitda: {
      id: 'ebitda',
      name: 'EBITDA %',
      short: 'EBITDA',
      icon: '📊',
      unit: '%',
      group: 'rentab',
      goalDef: 15,
      higherIsBetter: true,
      formula: '(MC − Desp. Comercial − Pessoal − Adm.) ÷ Receita Líquida × 100',
      description: 'Lucro operacional antes de juros, impostos, depreciação e amortização. Mede eficiência operacional pura.',
      autoFromStructure: true,
      structurePoint: 'ebitda',
      base: 'receita_liquida'
    },

    despop: {
      id: 'despop',
      name: 'Desp. Op. sobre Receita %',
      short: 'Desp.Op%',
      icon: '📋',
      unit: '%',
      group: 'rentab',
      goalDef: 35,
      higherIsBetter: false,
      formula: '(Desp. Comercial + Pessoal + Adm.) ÷ Receita Líquida × 100',
      description: 'Peso total das despesas operacionais sobre a receita líquida. Estrutura pesada compromete a rentabilidade.',
      // Cálculo customizado (não vem direto de um ponto da estrutura)
      autoFromStructure: false,
      manualCategories: ['despesa_comercial', 'despesa_pessoal', 'despesa_administrativa'],
      base: 'receita_liquida'
    },

    lucroliq: {
      id: 'lucroliq',
      name: 'Lucro Líquido %',
      short: 'Lucro Líq.',
      icon: '💰',
      unit: '%',
      group: 'rentab',
      goalDef: 10,
      higherIsBetter: true,
      formula: '(EBITDA − Depreciação − Desp. Financeiras − IR/CSLL + Receita Não Op.) ÷ Receita Líquida × 100',
      description: 'O que sobrou de verdade após todas as despesas, juros e impostos, mais receitas não operacionais. O KPI mais importante da empresa.',
      autoFromStructure: true,
      structurePoint: 'lucro_liquido',
      base: 'receita_liquida'
    },

    pessoal: {
      id: 'pessoal',
      name: 'Peso do Pessoal %',
      short: 'Pessoal%',
      icon: '👥',
      unit: '%',
      group: 'rentab',
      goalDef: 25,
      higherIsBetter: false,
      formula: 'Despesas com Pessoal ÷ Receita Líquida × 100',
      description: 'Percentual da receita líquida consumido pela folha de pagamento. Alto peso reduz a flexibilidade operacional.',
      autoFromStructure: true,
      structurePoint: 'despesa_pessoal',
      base: 'receita_liquida'
    },

    admperc: {
      id: 'admperc',
      name: 'Peso Administrativo %',
      short: 'Adm%',
      icon: '🏢',
      unit: '%',
      group: 'rentab',
      goalDef: 12,
      higherIsBetter: false,
      formula: 'Despesas Administrativas ÷ Receita Líquida × 100',
      description: 'Percentual da receita líquida consumido por despesas administrativas. Overhead elevado reduz a rentabilidade.',
      autoFromStructure: true,
      structurePoint: 'despesa_administrativa',
      base: 'receita_liquida'
    },

    spread: {
      id: 'spread',
      name: 'Spread Financeiro %',
      short: 'Spread Fin.',
      icon: '🏦',
      unit: '%',
      group: 'rentab',
      goalDef: 5,
      higherIsBetter: false,
      formula: 'Desp. Financeiras + IR ÷ Receita Líquida × 100',
      description: 'Peso do endividamento e carga tributária sobre o resultado. Acima de 5% sinaliza pressão financeira relevante.',
      autoFromStructure: false,
      manualCategories: ['despesa_financeira', 'imposto_lucro'],
      base: 'receita_liquida'
    },

    eficiencia: {
      id: 'eficiencia',
      name: 'Índice de Eficiência Op. %',
      short: 'Eficiência',
      icon: '⚙️',
      unit: '%',
      group: 'rentab',
      goalDef: 65,
      higherIsBetter: false,
      formula: 'Desp. Operacionais ÷ Lucro Bruto × 100',
      description: 'Quanto do Lucro Bruto é consumido pelas despesas operacionais. Acima de 100% significa que as despesas superaram o lucro bruto.',
      autoFromStructure: false,
      manualCategories: ['despesa_comercial', 'despesa_pessoal', 'despesa_administrativa'],
      base: 'lucro_bruto'
    },

    margseg: {
      id: 'margseg',
      name: 'Margem de Segurança Op. %',
      short: 'Mg.Segurança',
      icon: '🛡️',
      unit: '%',
      group: 'rentab',
      goalDef: 20,
      higherIsBetter: true,
      formula: '(Receita Bruta − Ponto de Equilíbrio) ÷ Receita Bruta × 100',
      description: 'O quanto a receita pode cair antes de a empresa entrar no prejuízo operacional. Meta mínima de 20% para conforto operacional.',
      // Cálculo completamente customizado
      autoFromStructure: false,
      customCalculation: true
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES DE VALIDAÇÃO E GERAÇÃO
// ═══════════════════════════════════════════════════════════════════════

/**
 * Valida a consistência da configuração
 */
function validateDREConfig(config) {
  const errors = [];
  
  // Verificar categorias
  const categoryIds = new Set();
  const fields = new Set();
  
  config.categories.forEach(cat => {
    if (categoryIds.has(cat.id)) {
      errors.push(`Categoria duplicada: ${cat.id}`);
    }
    categoryIds.add(cat.id);
    
    if (cat.field && fields.has(cat.field) && !cat.aggregateWith) {
      errors.push(`Field duplicado sem aggregateWith: ${cat.field}`);
    }
    if (cat.field) fields.add(cat.field);
  });
  
  // Verificar estrutura
  config.structure.forEach((step, idx) => {
    if (step.type === 'category' && !categoryIds.has(step.step)) {
      errors.push(`Estrutura linha ${idx}: categoria inexistente '${step.step}'`);
    }
  });
  
  // Verificar KPIs
  Object.values(config.kpis).forEach(kpi => {
    if (kpi.autoFromStructure) {
      const found = config.structure.find(s => s.step === kpi.structurePoint);
      if (!found) {
        errors.push(`KPI ${kpi.id}: structurePoint '${kpi.structurePoint}' não encontrado`);
      }
    }
  });
  
  return errors;
}

/**
 * Gera array de fields para inicialização
 */
function generateFieldsArray(config) {
  const fields = {};
  config.categories.forEach(cat => {
    if (cat.field && cat.id !== 'ignorar') {
      fields[cat.field] = 0;
    }
  });
  return fields;
}

/**
 * Gera mapeamento categoria → field
 */
function generateCategoryToField(config) {
  const map = {};
  config.categories.forEach(cat => {
    if (cat.field) {
      map[cat.id] = cat.field;
    }
  });
  return map;
}

/**
 * Descobre quais categorias afetam um KPI baseado na estrutura
 */
function discoverKPICategories(config, kpi) {
  if (!kpi.autoFromStructure) {
    return kpi.manualCategories || [];
  }
  
  const targetPoint = kpi.structurePoint;
  const categories = [];
  
  // Percorre a estrutura até encontrar o ponto alvo
  for (const step of config.structure) {
    if (step.type === 'category') {
      categories.push(step.step);
    }
    if (step.step === targetPoint) {
      break;
    }
  }
  
  return categories;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DRE_CONFIG,
    validateDREConfig,
    generateFieldsArray,
    generateCategoryToField,
    discoverKPICategories
  };
}
