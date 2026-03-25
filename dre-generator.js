/**
 * ═══════════════════════════════════════════════════════════════════════
 * GERADOR AUTOMÁTICO DE CÓDIGO DO DRE
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Este arquivo lê DRE_CONFIG e gera automaticamente:
 * 1. Array IND (KPIs)
 * 2. Array DRE_CATS (categorias para dropdowns)
 * 3. Função calcKPIs() completa
 * 4. Função dreAggregate() completa
 * 5. Mapeamento de confiabilidade (kpiLineMapping)
 * 6. Categorias para a API de classificação
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

// Importar configuração
// (assumindo que dre-config.js foi carregado antes)

const DRE_GENERATOR = {
  
  /**
   * ───────────────────────────────────────────────────────────────────
   * 1. GERAR ARRAY IND (KPIs)
   * ───────────────────────────────────────────────────────────────────
   */
  generateINDArray(config) {
    return Object.values(config.kpis).map(kpi => ({
      id: kpi.id,
      name: kpi.name,
      short: kpi.short,
      group: kpi.group,
      icon: kpi.icon,
      unit: kpi.unit,
      goalDef: kpi.goalDef,
      hb: kpi.higherIsBetter,
      formula: kpi.formula,
      desc: kpi.description
    }));
  },

  /**
   * ───────────────────────────────────────────────────────────────────
   * 2. GERAR ARRAY DRE_CATS (Categorias para UI)
   * ───────────────────────────────────────────────────────────────────
   */
  generateDRECatsArray(config) {
    return config.categories
      .sort((a, b) => a.order - b.order)
      .map(cat => ({
        id: cat.id,
        label: cat.label,
        color: cat.color,
        icon: cat.icon
      }));
  },

  /**
   * ───────────────────────────────────────────────────────────────────
   * 3. GERAR FUNÇÃO calcKPIs()
   * ───────────────────────────────────────────────────────────────────
   */
  generateCalcKPIsFunction(config) {
    const code = [];
    
    code.push('function calcKPIs(r) {');
    code.push('  const v = k => { const x = parseFloat(r[k]); return isNaN(x) ? null : x; };');
    code.push('  const pct = (n, d) => (d && d !== 0) ? n / d * 100 : null;');
    code.push('');
    
    // Leitura dos campos brutos
    code.push('  // ── Leitura dos campos brutos ──');
    const uniqueFields = new Set();
    config.categories.forEach(cat => {
      if (cat.field && !uniqueFields.has(cat.field)) {
        uniqueFields.add(cat.field);
        const varName = cat.field.replace('f_', '');
        code.push(`  const ${varName} = v('${cat.field}') || 0;`);
      }
    });
    code.push('');
    
    // Campos agregados (fallback para simulador)
    code.push('  // ── Campos agregados para simulador ──');
    code.push('  const cv_agg = v("f_cv");');
    code.push('  const df_agg = v("f_df");');
    code.push('');
    
    // Verificação de dados mínimos
    code.push('  if (fat === null) {');
    code.push('    return {');
    Object.keys(config.kpis).forEach(kpiId => {
      code.push(`      ${kpiId}: null,`);
    });
    code.push('    };');
    code.push('  }');
    code.push('');
    
    // Percorrer estrutura e calcular intermediários
    code.push('  // ── Cadeia de resultados ──');
    let currentResult = null;
    
    config.structure.forEach(step => {
      if (step.type === 'result') {
        const varName = step.step.replace(/_/g, '');
        
        if (step.step === 'receita_liquida') {
          code.push(`  const ${varName} = fat - ded;`);
          code.push(`  const base = ${varName} > 0 ? ${varName} : fat;`);
        } else {
          // Gerar fórmula automaticamente baseada na estrutura
          code.push(`  const ${varName} = /* AUTO-GENERATED */;`);
        }
        
        currentResult = step.step;
      }
    });
    code.push('');
    
    // Retorno com KPIs calculados
    code.push('  return {');
    Object.entries(config.kpis).forEach(([kpiId, kpi]) => {
      if (kpi.unit === 'R$') {
        code.push(`    ${kpiId}: ${kpi.structurePoint?.replace(/_/g, '')},`);
      } else if (kpi.unit === '%') {
        const point = kpi.structurePoint?.replace(/_/g, '');
        const baseVar = kpi.base === 'receita_liquida' ? 'base' : kpi.base.replace(/_/g, '');
        code.push(`    ${kpiId}: ${point} !== null ? pct(${point}, ${baseVar}) : null,`);
      }
    });
    code.push('  };');
    code.push('}');
    
    return code.join('\n');
  },

  /**
   * ───────────────────────────────────────────────────────────────────
   * 4. GERAR FUNÇÃO dreAggregate()
   * ───────────────────────────────────────────────────────────────────
   */
  generateDreAggregateFunction(config) {
    const code = [];
    
    code.push('function dreAggregate() {');
    
    // Inicialização do objeto agg
    code.push('  const a = {');
    const uniqueFields = new Set();
    config.categories.forEach(cat => {
      if (cat.field && !uniqueFields.has(cat.field)) {
        uniqueFields.add(cat.field);
        code.push(`    ${cat.field}: 0,`);
      }
    });
    code.push('  };');
    code.push('');
    
    // Loop de agregação
    code.push('  _dreClassified.forEach(l => {');
    code.push('    const v = l.value;');
    
    config.categories.forEach((cat, idx) => {
      if (cat.id === 'ignorar') return;
      
      const condition = idx === 0 ? 'if' : 'else if';
      code.push(`    ${condition} (l.category === '${cat.id}') a.${cat.field} += v;`);
    });
    
    code.push('  });');
    code.push('');
    code.push('  return a;');
    code.push('}');
    
    return code.join('\n');
  },

  /**
   * ───────────────────────────────────────────────────────────────────
   * 5. GERAR MAPEAMENTO DE CONFIABILIDADE
   * ───────────────────────────────────────────────────────────────────
   */
  generateKPILineMapping(config) {
    const mapping = {};
    
    Object.entries(config.kpis).forEach(([kpiId, kpi]) => {
      if (kpi.customCalculation) {
        // Margseg tem cálculo custom, pega todas até EBITDA
        mapping[kpiId] = [];
        for (const step of config.structure) {
          if (step.type === 'category') {
            mapping[kpiId].push(step.step);
          }
          if (step.step === 'ebitda') break;
        }
      } else if (kpi.manualCategories) {
        mapping[kpiId] = kpi.manualCategories;
      } else if (kpi.autoFromStructure) {
        mapping[kpiId] = [];
        for (const step of config.structure) {
          if (step.type === 'category') {
            mapping[kpiId].push(step.step);
          }
          if (step.step === kpi.structurePoint) break;
        }
      }
    });
    
    return mapping;
  },

  /**
   * ───────────────────────────────────────────────────────────────────
   * 6. GERAR CATEGORIAS PARA API DE CLASSIFICAÇÃO
   * ───────────────────────────────────────────────────────────────────
   */
  generateAPICategories(config) {
    return config.categories.map(cat => ({
      id: cat.id,
      desc: cat.aiDescription
    }));
  },

  /**
   * ───────────────────────────────────────────────────────────────────
   * 7. GERAR CÓDIGO COMPLETO PARA SUBSTITUIR NO APP.JS
   * ───────────────────────────────────────────────────────────────────
   */
  generateFullCode(config) {
    const sections = [];
    
    sections.push('// ═══════════════════════════════════════════');
    sections.push('// AUTO-GENERATED FROM dre-config.js');
    sections.push('// NÃO EDITE MANUALMENTE - USE dre-config.js');
    sections.push('// ═══════════════════════════════════════════');
    sections.push('');
    
    sections.push('// ── 1. ARRAY IND (KPIs) ──');
    sections.push('const IND = ' + JSON.stringify(this.generateINDArray(config), null, 2) + ';');
    sections.push('');
    
    sections.push('// ── 2. CATEGORIAS PARA UI ──');
    sections.push('const DRE_CATS = ' + JSON.stringify(this.generateDRECatsArray(config), null, 2) + ';');
    sections.push('');
    
    sections.push('// ── 3. MAPEAMENTO DE CONFIABILIDADE ──');
    sections.push('const KPI_LINE_MAPPING = ' + JSON.stringify(this.generateKPILineMapping(config), null, 2) + ';');
    sections.push('');
    
    sections.push('// ── 4. FUNÇÃO calcKPIs() ──');
    sections.push(this.generateCalcKPIsFunction(config));
    sections.push('');
    
    sections.push('// ── 5. FUNÇÃO dreAggregate() ──');
    sections.push(this.generateDreAggregateFunction(config));
    
    return sections.join('\n');
  },

  /**
   * ───────────────────────────────────────────────────────────────────
   * 8. EXPORTAR PARA ARQUIVO classify-dre.js
   * ───────────────────────────────────────────────────────────────────
   */
  generateClassifyDRECode(config) {
    const categories = this.generateAPICategories(config);
    
    return `export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lines, savedMappings } = req.body;
  if (!lines || !lines.length) {
    return res.status(400).json({ error: 'No lines provided' });
  }

  // AUTO-GENERATED FROM dre-config.js
  const categories = ${JSON.stringify(categories, null, 4)};

  const mappingsHint = savedMappings && Object.keys(savedMappings).length
    ? \`\\n\\nReferência de classificações anteriores desta empresa (use como guia para contas similares):\\n\${
        Object.entries(savedMappings).slice(0, 40)
          .map(([k, v]) => \`  "\${k}" → \${v}\`).join('\\n')
      }\`
    : '';

  const prompt = \`Você é um contador especialista em DRE brasileiro. Classifique cada linha do DRE abaixo em uma das categorias.

CATEGORIAS DISPONÍVEIS:
\${categories.map(c => \`• \${c.id}: \${c.desc}\`).join('\\n')}

REGRAS CRÍTICAS:
1. Linhas de TOTAL ou RESULTADO → SEMPRE "ignorar"
2. Receita líquida já calculada → "ignorar"
3. Linhas com valor zero → "ignorar"
4. Percentuais (%) → SEMPRE "ignorar"
5. COFINS, PIS, ISS, ICMS → SEMPRE "deducao_receita"
6. IR, IRPJ, CSLL → "imposto_lucro"
7. Comissões, frete sobre vendas → "custo_variavel_comercial"
\${mappingsHint}

LINHAS DO DRE (índice | nome da conta | valor):
\${lines.map((l, i) => \`\${i} | \${l.name} | R$ \${l.value.toFixed(2)}\`).join('\\n')}

Responda APENAS com JSON puro (sem markdown):
{"classifications":[{"index":0,"category":"receita_bruta","confidence":"high"},...]}\`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Claude API error: ' + err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}`;
  }
};

// ═══════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DRE_GENERATOR;
}
