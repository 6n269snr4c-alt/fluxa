#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════
 * SCRIPT DE VALIDAÇÃO E GERAÇÃO - DRE CONFIGURÁVEL
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * USO:
 *   node generate-dre-code.js
 * 
 * SAÍDA:
 *   - Valida dre-config.js
 *   - Gera código para app.js
 *   - Gera código para classify-dre.js
 *   - Salva em /generated/
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(colors[color] + msg + colors.reset);
}

function logSection(title) {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.cyan + title + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
}

// Carregar módulos
logSection('📦 CARREGANDO MÓDULOS');
let DRE_CONFIG, validateDREConfig, DRE_GENERATOR;

try {
  const configModule = require('./dre-config.js');
  DRE_CONFIG = configModule.DRE_CONFIG;
  validateDREConfig = configModule.validateDREConfig;
  log('✅ dre-config.js carregado', 'green');
  
  DRE_GENERATOR = require('./dre-generator.js');
  log('✅ dre-generator.js carregado', 'green');
} catch (err) {
  log('❌ Erro ao carregar módulos: ' + err.message, 'red');
  process.exit(1);
}

// Validar configuração
logSection('🔍 VALIDANDO CONFIGURAÇÃO');
const errors = validateDREConfig(DRE_CONFIG);

if (errors.length > 0) {
  log('❌ ERROS ENCONTRADOS:', 'red');
  errors.forEach(err => log('  • ' + err, 'red'));
  process.exit(1);
}
log('✅ Configuração válida!', 'green');

// Estatísticas
console.log('');
log(`📊 Categorias: ${DRE_CONFIG.categories.length}`, 'blue');
log(`📊 Passos na estrutura: ${DRE_CONFIG.structure.length}`, 'blue');
log(`📊 KPIs: ${Object.keys(DRE_CONFIG.kpis).length}`, 'blue');

// Gerar código
logSection('⚙️ GERANDO CÓDIGO');

let fullCode, classifyCode;
try {
  fullCode = DRE_GENERATOR.generateFullCode(DRE_CONFIG);
  log('✅ Código para app.js gerado', 'green');
  
  classifyCode = DRE_GENERATOR.generateClassifyDRECode(DRE_CONFIG);
  log('✅ Código para classify-dre.js gerado', 'green');
} catch (err) {
  log('❌ Erro ao gerar código: ' + err.message, 'red');
  console.error(err);
  process.exit(1);
}

// Criar diretório de saída
const outputDir = path.join(__dirname, 'generated');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  log('📁 Diretório /generated/ criado', 'yellow');
}

// Salvar arquivos
logSection('💾 SALVANDO ARQUIVOS');

try {
  // app-generated.js (apenas a parte gerada)
  const appOutputPath = path.join(outputDir, 'app-generated.js');
  fs.writeFileSync(appOutputPath, fullCode, 'utf8');
  log('✅ ' + appOutputPath, 'green');
  
  // classify-dre-generated.js (completo)
  const classifyOutputPath = path.join(outputDir, 'classify-dre-generated.js');
  fs.writeFileSync(classifyOutputPath, classifyCode, 'utf8');
  log('✅ ' + classifyOutputPath, 'green');
  
  // Gerar também um resumo JSON
  const summary = {
    generatedAt: new Date().toISOString(),
    categories: DRE_CONFIG.categories.map(c => ({ id: c.id, label: c.label, field: c.field })),
    kpis: Object.keys(DRE_CONFIG.kpis),
    structureSteps: DRE_CONFIG.structure.length
  };
  
  const summaryPath = path.join(outputDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  log('✅ ' + summaryPath, 'green');
  
} catch (err) {
  log('❌ Erro ao salvar arquivos: ' + err.message, 'red');
  process.exit(1);
}

// Próximos passos
logSection('📋 PRÓXIMOS PASSOS');
console.log('');
log('1. Revisar os arquivos gerados em /generated/', 'cyan');
log('2. Fazer backup dos arquivos atuais:', 'cyan');
log('   cp app.js app.js.backup', 'yellow');
log('   cp api/classify-dre.js api/classify-dre.js.backup', 'yellow');
log('', '');
log('3. Substituir com os arquivos gerados:', 'cyan');
log('   (copiar manualmente a parte gerada para app.js)', 'yellow');
log('   cp generated/classify-dre-generated.js api/classify-dre.js', 'yellow');
log('', '');
log('4. Testar localmente antes de fazer deploy', 'cyan');
log('', '');
log('✨ GERAÇÃO CONCLUÍDA COM SUCESSO!', 'green');

// Exibir resumo das mudanças se tiver arquivo anterior
try {
  const prevSummaryPath = path.join(outputDir, 'summary-previous.json');
  if (fs.existsSync(prevSummaryPath)) {
    const prevSummary = JSON.parse(fs.readFileSync(prevSummaryPath, 'utf8'));
    const currCats = DRE_CONFIG.categories.map(c => c.id).sort();
    const prevCats = prevSummary.categories.map(c => c.id).sort();
    
    const added = currCats.filter(c => !prevCats.includes(c));
    const removed = prevCats.filter(c => !currCats.includes(c));
    
    if (added.length > 0 || removed.length > 0) {
      logSection('📊 MUDANÇAS DETECTADAS');
      if (added.length > 0) {
        log('✅ Categorias adicionadas:', 'green');
        added.forEach(c => log('  + ' + c, 'green'));
      }
      if (removed.length > 0) {
        log('❌ Categorias removidas:', 'red');
        removed.forEach(c => log('  - ' + c, 'red'));
      }
    }
  }
  
  // Salvar summary atual como previous para próxima execução
  const summaryPath = path.join(outputDir, 'summary.json');
  const prevSummaryPath2 = path.join(outputDir, 'summary-previous.json');
  if (fs.existsSync(summaryPath)) {
    fs.copyFileSync(summaryPath, prevSummaryPath2);
  }
  
} catch (err) {
  // Ignorar erros de comparação
}

console.log('');
