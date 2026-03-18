
// ═══════════════════════════════════════════
// CASHFLOW MODULE - SAÚDE DE CAIXA
// Módulo independente - não afeta DRE
// ═══════════════════════════════════════════

// ── IMPORT / UPLOAD ────────────────────────────────────────────────

function importExtrato() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ofx,.csv,.txt';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = evt => {
      parseExtrato(evt.target.result, file.name);
    };
    reader.readAsText(file);
  };
  input.click();
}

function parseExtrato(content, filename) {
  let transactions = [];
  
  // Detectar formato
  if (filename.toLowerCase().endsWith('.ofx')) {
    transactions = parseOFX(content);
  } else if (filename.toLowerCase().endsWith('.csv') || filename.toLowerCase().endsWith('.txt')) {
    transactions = parseCSV(content);
  }
  
  if (!transactions.length) {
    toast('❌ Nenhuma transação encontrada no arquivo');
    return;
  }
  
  // Salvar
  if (!S.extratos) S.extratos = [];
  S.extratos.push({
    id: Date.now(),
    filename: filename,
    importedAt: new Date().toISOString(),
    transactions: transactions
  });
  
  sv();
  toast(`✅ ${transactions.length} transações importadas de ${filename}`);
  rCashflow();
}

// ── PARSERS ────────────────────────────────────────────────────────

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const transactions = [];
  
  // Tentar detectar separador
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  
  // Pular header (assumir que primeira linha é header se não tem número)
  const startIdx = /\d/.test(lines[0]) ? 0 : 1;
  
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    
    // Tentar achar data e valor nas colunas
    let date = null, value = null, desc = '';
    
    for (let j = 0; j < Math.min(cols.length, 5); j++) {
      // Tentar parse de data
      if (!date) {
        date = parseDate(cols[j]);
      }
      
      // Tentar parse de valor
      if (!value && /^-?[\d.,]+$/.test(cols[j].replace(/[^\d.,-]/g, ''))) {
        const clean = cols[j].replace(/[^\d.,-]/g, '').replace(',', '.');
        const num = parseFloat(clean);
        if (!isNaN(num) && Math.abs(num) > 0.01) {
          value = num;
        }
      }
      
      // Coletar descrição (texto que não é data nem valor)
      if (!parseDate(cols[j]) && !/^-?[\d.,]+$/.test(cols[j].replace(/[^\d.,-]/g, '')) && cols[j].length > 2) {
        if (desc) desc += ' ';
        desc += cols[j];
      }
    }
    
    if (!date || value === null) continue;
    
    transactions.push({
      date: date.toISOString().split('T')[0],
      desc: desc || 'Sem descrição',
      value: value,
      type: value > 0 ? 'in' : 'out'
    });
  }
  
  return transactions;
}

function parseOFX(content) {
  const transactions = [];
  
  // Regex para capturar blocos STMTTRN
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const block = match[1];
    
    // Extrair campos
    const dtMatch = /<DTPOSTED>(\d{8})/.exec(block);
    const amtMatch = /<TRNAMT>([-\d.]+)/.exec(block);
    const memoMatch = /<MEMO>(.*?)(?:<\/MEMO>|<)/.exec(block);
    const nameMatch = /<NAME>(.*?)(?:<\/NAME>|<)/.exec(block);
    
    if (!dtMatch || !amtMatch) continue;
    
    const dateStr = dtMatch[1];
    const value = parseFloat(amtMatch[1]);
    const desc = (memoMatch ? memoMatch[1] : '') || (nameMatch ? nameMatch[1] : '') || 'Sem descrição';
    
    transactions.push({
      date: `${dateStr.substr(0,4)}-${dateStr.substr(4,2)}-${dateStr.substr(6,2)}`,
      desc: desc.trim(),
      value: value,
      type: value > 0 ? 'in' : 'out'
    });
  }
  
  return transactions;
}

function parseDate(str) {
  if (!str) return null;
  str = str.trim();
  
  // dd/mm/yyyy ou dd/mm/yy
  const m1 = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/.exec(str);
  if (m1) {
    let y = parseInt(m1[3]);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(m1[2]) - 1, parseInt(m1[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  
  // yyyy-mm-dd ou yyyy/mm/dd
  const m2 = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/.exec(str);
  if (m2) {
    const d = new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  
  // yyyymmdd
  const m3 = /^(\d{8})$/.exec(str);
  if (m3) {
    const d = new Date(parseInt(str.substr(0,4)), parseInt(str.substr(4,2)) - 1, parseInt(str.substr(6,2)));
    return isNaN(d.getTime()) ? null : d;
  }
  
  return null;
}

// ── ANÁLISE ────────────────────────────────────────────────────────

function analyzeCashflow(transactions) {
  if (!transactions || !transactions.length) return null;
  
  // Ordenar por data
  const sorted = [...transactions].sort((a,b) => a.date.localeCompare(b.date));
  
  // Calcular saldo (assumir inicial = 0, apenas variação)
  let saldo = 0;
  sorted.forEach(t => saldo += t.value);
  
  // Últimos 30 dias
  const hoje = new Date();
  const dias30 = new Date(hoje.getTime() - 30*24*60*60*1000);
  const recent = sorted.filter(t => new Date(t.date) >= dias30);
  
  const entradas = recent.filter(t => t.type === 'in');
  const saidas = recent.filter(t => t.type === 'out');
  
  const totalIn = entradas.reduce((sum, t) => sum + Math.abs(t.value), 0);
  const totalOut = saidas.reduce((sum, t) => sum + Math.abs(t.value), 0);
  
  const mediaSaidaDia = totalOut / 30;
  const diasCaixa = mediaSaidaDia > 0 ? Math.floor(Math.abs(saldo) / mediaSaidaDia) : 999;
  
  // Tendência (primeira metade vs segunda metade)
  const metade = Math.floor(recent.length / 2);
  const saldo1 = recent.slice(0, metade).reduce((s,t) => s + t.value, 0);
  const saldo2 = recent.slice(metade).reduce((s,t) => s + t.value, 0);
  const tendencia = saldo2 > saldo1 * 1.1 ? 'up' : saldo2 < saldo1 * 0.9 ? 'down' : 'stable';
  
  // Maior entrada/saída
  const maiorEntrada = entradas.length ? entradas.sort((a,b) => Math.abs(b.value) - Math.abs(a.value))[0] : null;
  const maiorSaida = saidas.length ? saidas.sort((a,b) => Math.abs(b.value) - Math.abs(a.value))[0] : null;
  
  // Agrupar por mês
  const byMonth = {};
  sorted.forEach(t => {
    const mes = t.date.substr(0,7);
    if (!byMonth[mes]) byMonth[mes] = {in: 0, out: 0};
    if (t.type === 'in') byMonth[mes].in += Math.abs(t.value);
    else byMonth[mes].out += Math.abs(t.value);
  });
  
  // Detectar padrões (simplificado - picos de entrada/saída por dia do mês)
  const byDay = {};
  sorted.forEach(t => {
    const day = new Date(t.date).getDate();
    if (!byDay[day]) byDay[day] = {in: [], out: []};
    if (t.type === 'in') byDay[day].in.push(Math.abs(t.value));
    else byDay[day].out.push(Math.abs(t.value));
  });
  
  const patterns = [];
  Object.keys(byDay).forEach(day => {
    const d = byDay[day];
    if (d.in.length >= 2) {
      const avg = d.in.reduce((s,v)=>s+v,0) / d.in.length;
      if (avg > totalIn * 0.15) {
        patterns.push({type: 'in', day: parseInt(day), avg: avg, count: d.in.length});
      }
    }
    if (d.out.length >= 2) {
      const avg = d.out.reduce((s,v)=>s+v,0) / d.out.length;
      if (avg > totalOut * 0.15) {
        patterns.push({type: 'out', day: parseInt(day), avg: avg, count: d.out.length});
      }
    }
  });
  
  return {
    saldo,
    diasCaixa,
    totalIn,
    totalOut,
    mediaSaidaDia,
    tendencia,
    maiorEntrada,
    maiorSaida,
    byMonth,
    patterns: patterns.sort((a,b) => b.avg - a.avg).slice(0, 3)
  };
}

// ── RENDER ─────────────────────────────────────────────────────────

function rCashflow() {
  const body = document.getElementById('cashflowBody');
  if (!body) return;
  
  body.innerHTML = '';
  
  if (!S.extratos || !S.extratos.length) {
    body.innerHTML = `
      <div style="text-align:center;padding:80px 20px;color:var(--mut)">
        <div style="font-size:48px;margin-bottom:16px">💰</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">
          Nenhum extrato importado
        </div>
        <div style="font-size:13px;margin-bottom:24px;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.6">
          Importe um extrato bancário (OFX ou CSV) para ver análises automáticas de fluxo de caixa, tendências, padrões e projeções — tudo sem configuração.
        </div>
        <button class="bs" onclick="importExtrato()">📤 Importar Primeiro Extrato</button>
      </div>
    `;
    return;
  }
  
  // Pegar todas as transações
  const allTx = S.extratos.flatMap(e => e.transactions);
  const analysis = analyzeCashflow(allTx);
  
  if (!analysis) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mut)">Erro ao analisar extratos</div>';
    return;
  }
  
  // Semáforo de status
  const statusColor = analysis.diasCaixa >= 35 ? 'var(--green)' : 
                     analysis.diasCaixa >= 15 ? 'var(--amber)' : 'var(--red)';
  const statusLabel = analysis.diasCaixa >= 35 ? 'Saudável' : 
                     analysis.diasCaixa >= 15 ? 'Atenção' : 'Crítico';
  const statusIcon = analysis.diasCaixa >= 35 ? '🟢' : 
                    analysis.diasCaixa >= 15 ? '🟡' : '🔴';
  
  const tendIcon = analysis.tendencia === 'up' ? '📈' : 
                  analysis.tendencia === 'down' ? '📉' : '➡️';
  const tendLabel = analysis.tendencia === 'up' ? 'Subindo' : 
                   analysis.tendencia === 'down' ? 'Caindo' : 'Estável';
  const tendColor = analysis.tendencia === 'up' ? 'var(--green)' : 
                   analysis.tendencia === 'down' ? 'var(--red)' : 'var(--mut)';
  
  // Render principal
  body.innerHTML = `
    <div style="margin-bottom:16px;padding:12px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:11px;color:var(--mut)">
      📊 ${S.extratos.length} extrato(s) · ${allTx.length} transações · Última importação: ${new Date(S.extratos[S.extratos.length-1].importedAt).toLocaleDateString('pt-BR')}
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:24px">
      
      <!-- Card 1: Saldo -->
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px">
        <div style="font-size:10px;letter-spacing:2px;font-weight:700;color:var(--mut);margin-bottom:8px">💰 SALDO VARIAÇÃO</div>
        <div style="font-size:28px;font-weight:800;color:${analysis.saldo >= 0 ? 'var(--teal)' : 'var(--red)'};line-height:1">${fmtV(analysis.saldo, 'R$')}</div>
        <div style="font-size:11px;color:${tendColor};margin-top:4px;font-weight:600">${tendIcon} ${tendLabel}</div>
      </div>
      
      <!-- Card 2: Dias de Caixa -->
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px">
        <div style="font-size:10px;letter-spacing:2px;font-weight:700;color:var(--mut);margin-bottom:8px">⏱️ DIAS DE SOBREVIVÊNCIA</div>
        <div style="font-size:28px;font-weight:800;color:${statusColor};line-height:1">${analysis.diasCaixa > 999 ? '∞' : analysis.diasCaixa}</div>
        <div style="font-size:11px;color:var(--mut);margin-top:4px">${statusIcon} ${statusLabel}</div>
      </div>
      
      <!-- Card 3: Maior Entrada -->
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px">
        <div style="font-size:10px;letter-spacing:2px;font-weight:700;color:var(--mut);margin-bottom:8px">📥 MAIOR ENTRADA</div>
        <div style="font-size:22px;font-weight:800;color:var(--green);line-height:1">${analysis.maiorEntrada ? fmtV(Math.abs(analysis.maiorEntrada.value), 'R$') : '—'}</div>
        <div style="font-size:10px;color:var(--mut);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${analysis.maiorEntrada?.desc || ''}">${analysis.maiorEntrada?.desc || '—'}</div>
      </div>
      
      <!-- Card 4: Maior Saída -->
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px">
        <div style="font-size:10px;letter-spacing:2px;font-weight:700;color:var(--mut);margin-bottom:8px">📤 MAIOR SAÍDA</div>
        <div style="font-size:22px;font-weight:800;color:var(--red);line-height:1">${analysis.maiorSaida ? fmtV(Math.abs(analysis.maiorSaida.value), 'R$') : '—'}</div>
        <div style="font-size:10px;color:var(--mut);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${analysis.maiorSaida?.desc || ''}">${analysis.maiorSaida?.desc || '—'}</div>
      </div>
      
    </div>
    
    <!-- Gráfico de Fluxo -->
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="font-size:12px;letter-spacing:2px;font-weight:700;color:var(--mut);margin-bottom:16px">📊 FLUXO MENSAL</div>
      <div id="flowChart" style="width:100%;height:280px"></div>
    </div>
    
    ${analysis.patterns.length > 0 ? `
    <!-- Padrões Detectados -->
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="font-size:12px;letter-spacing:2px;font-weight:700;color:var(--mut);margin-bottom:16px">🔁 PADRÕES DETECTADOS</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${analysis.patterns.map(p => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:rgba(255,255,255,.02);border-radius:8px">
            <div style="font-size:24px">${p.type === 'in' ? '📥' : '📤'}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:${p.type === 'in' ? 'var(--green)' : 'var(--red)'}">
                ${p.type === 'in' ? 'Entradas' : 'Saídas'} recorrentes dia ${p.day}
              </div>
              <div style="font-size:11px;color:var(--mut);margin-top:2px">
                Média de ${fmtV(p.avg, 'R$')} · ${p.count} ocorrências detectadas
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- Tabela Mensal -->
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px">
      <div style="font-size:12px;letter-spacing:2px;font-weight:700;color:var(--mut);margin-bottom:16px">📅 COMPARATIVO MENSAL</div>
      <div id="monthlyTable"></div>
    </div>
  `;
  
  // Renderizar tabela mensal
  renderMonthlyTable(analysis.byMonth);
  
  // Renderizar gráfico SVG
  renderFlowChart(analysis.byMonth);
}

function renderMonthlyTable(byMonth) {
  const table = document.getElementById('monthlyTable');
  if (!table) return;
  
  const months = Object.keys(byMonth).sort().reverse();
  
  let html = '<table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr style="border-bottom:2px solid rgba(255,255,255,.08)">';
  html += '<th style="text-align:left;padding:10px;font-size:10px;color:var(--mut);font-weight:700;letter-spacing:1px">MÊS</th>';
  html += '<th style="text-align:right;padding:10px;font-size:10px;color:var(--mut);font-weight:700;letter-spacing:1px">ENTRADAS</th>';
  html += '<th style="text-align:right;padding:10px;font-size:10px;color:var(--mut);font-weight:700;letter-spacing:1px">SAÍDAS</th>';
  html += '<th style="text-align:right;padding:10px;font-size:10px;color:var(--mut);font-weight:700;letter-spacing:1px">RESULTADO</th>';
  html += '</tr></thead><tbody>';
  
  months.forEach(mes => {
    const data = byMonth[mes];
    const resultado = data.in - data.out;
    const [ano, m] = mes.split('-');
    const mesLabel = MES[parseInt(m)-1] + '/' + ano;
    
    html += `<tr style="border-bottom:1px solid rgba(255,255,255,.05)">
      <td style="padding:12px;color:var(--mut)">${mesLabel}</td>
      <td style="padding:12px;text-align:right;color:var(--green);font-weight:600">${fmtV(data.in, 'R$')}</td>
      <td style="padding:12px;text-align:right;color:var(--red);font-weight:600">${fmtV(data.out, 'R$')}</td>
      <td style="padding:12px;text-align:right;color:${resultado > 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${fmtV(resultado, 'R$')}</td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  table.innerHTML = html;
}

function renderFlowChart(byMonth) {
  const chart = document.getElementById('flowChart');
  if (!chart) return;
  
  const months = Object.keys(byMonth).sort();
  if (!months.length) {
    chart.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mut);font-size:12px">Sem dados para exibir</div>';
    return;
  }
  
  const w = chart.clientWidth;
  const h = 280;
  const pad = {t: 20, r: 30, b: 40, l: 60};
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  
  // Preparar dados
  const data = months.map(m => {
    const [ano, mes] = m.split('-');
    return {
      label: MES[parseInt(mes)-1],
      in: byMonth[m].in,
      out: byMonth[m].out,
      result: byMonth[m].in - byMonth[m].out
    };
  });
  
  // Escalas
  const maxVal = Math.max(...data.map(d => Math.max(d.in, d.out)));
  const yScale = v => pad.t + ch - (v / maxVal * ch);
  const xStep = cw / (data.length - 1 || 1);
  
  // SVG
  let svg = `<svg width="${w}" height="${h}" style="overflow:visible">`;
  
  // Grid horizontal
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i;
    const val = maxVal * (1 - i/4);
    svg += `<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`;
    svg += `<text x="${pad.l-10}" y="${y+4}" text-anchor="end" font-size="10" fill="var(--mut)">${(val/1000).toFixed(0)}k</text>`;
  }
  
  // Linhas de entrada/saída
  let pathIn = `M ${pad.l} ${yScale(data[0].in)}`;
  let pathOut = `M ${pad.l} ${yScale(data[0].out)}`;
  
  data.forEach((d, i) => {
    const x = pad.l + i * xStep;
    const yIn = yScale(d.in);
    const yOut = yScale(d.out);
    
    if (i > 0) {
      pathIn += ` L ${x} ${yIn}`;
      pathOut += ` L ${x} ${yOut}`;
    }
    
    // Pontos
    svg += `<circle cx="${x}" cy="${yIn}" r="4" fill="var(--green)" stroke="#0a1320" stroke-width="2"/>`;
    svg += `<circle cx="${x}" cy="${yOut}" r="4" fill="var(--red)" stroke="#0a1320" stroke-width="2"/>`;
    
    // Labels de mês
    svg += `<text x="${x}" y="${h-pad.b+20}" text-anchor="middle" font-size="11" fill="var(--mut)">${d.label}</text>`;
  });
  
  // Adicionar paths
  svg = svg.replace('<svg', `<svg><path d="${pathIn}" fill="none" stroke="var(--green)" stroke-width="2"/><path d="${pathOut}" fill="none" stroke="var(--red)" stroke-width="2"/>`);
  
  // Legenda
  svg += `<g transform="translate(${w-pad.r-140}, ${pad.t})">
    <circle cx="0" cy="0" r="4" fill="var(--green)"/>
    <text x="10" y="4" font-size="11" fill="var(--text)">Entradas</text>
    <circle cx="80" cy="0" r="4" fill="var(--red)"/>
    <text x="90" y="4" font-size="11" fill="var(--text)">Saídas</text>
  </g>`;
  
  svg += '</svg>';
  chart.innerHTML = svg;
}

// ── CLEAR ──────────────────────────────────────────────────────────

function clearExtratos() {
  if (!S.extratos || !S.extratos.length) {
    toast('⚠️ Nenhum extrato para limpar');
    return;
  }
  
  showDelDialog(
    '🗑️ Limpar Extratos',
    `Remover todos os ${S.extratos.length} extrato(s) importado(s)? Esta ação não pode ser desfeita.`,
    () => {
      S.extratos = [];
      sv();
      toast('✓ Extratos removidos');
      rCashflow();
    }
  );
}

// ── HELPER para integração com Conselheiro (opcional) ─────────────

function getCashflowContext() {
  if (!S.extratos || !S.extratos.length) return null;
  
  const allTx = S.extratos.flatMap(e => e.transactions);
  const analysis = analyzeCashflow(allTx);
  if (!analysis) return null;
  
  const statusLabel = analysis.diasCaixa >= 35 ? '🟢 Saudável' : 
                     analysis.diasCaixa >= 15 ? '🟡 Atenção' : '🔴 Crítico';
  const tendLabel = analysis.tendencia === 'up' ? '📈 Crescente' : 
                   analysis.tendencia === 'down' ? '📉 Decrescente' : '➡️ Estável';
  
  let txt = `\n\nFLUXO DE CAIXA (dados reais de extratos bancários):
• Saldo atual (variação): ${fmtV(analysis.saldo, 'R$')}
• Dias de sobrevivência: ${analysis.diasCaixa > 999 ? '∞ (ilimitado)' : analysis.diasCaixa + ' dias'} ${statusLabel}
• Tendência: ${tendLabel}
• Entradas (últimos 30d): ${fmtV(analysis.totalIn, 'R$')}
• Saídas (últimos 30d): ${fmtV(analysis.totalOut, 'R$')}
• Queima diária média: ${fmtV(analysis.mediaSaidaDia, 'R$')}/dia`;

  if (analysis.patterns && analysis.patterns.length) {
    txt += '\n• Padrões detectados: ' + analysis.patterns.map(p => 
      `${p.type === 'in' ? 'Entradas' : 'Saídas'} recorrentes dia ${p.day} (média ${fmtV(p.avg, 'R$')})`
    ).join(', ');
  }

  // Alertas críticos
  if (analysis.diasCaixa < 15) {
    txt += '\n⚠️ ALERTA CRÍTICO: Menos de 15 dias de caixa — risco iminente de insolvência!';
  } else if (analysis.diasCaixa < 35) {
    txt += '\n⚠️ ATENÇÃO: Caixa apertado — monitorar de perto.';
  }

  return txt;
}
