# 📋 GUIA: COMO ADICIONAR NOVA CONTA NO DRE

Este guia mostra como adicionar uma nova conta ao sistema de forma simples e sem erros.

---

## 🎯 EXEMPLO: Adicionar "Outras Despesas Operacionais"

Imagine que você quer adicionar uma nova categoria chamada **"Outras Despesas Operacionais"** que deve aparecer entre "Despesa Administrativa" e "EBITDA".

### ✅ PASSO 1: Editar `dre-config.js`

#### 1.1 Adicionar na seção `categories`:

```javascript
{
  id: 'outras_despesas_op',              // ID único
  field: 'f_outras_desp',                // Nome do campo de agregação
  label: 'Outras Despesas Operacionais', // Nome na UI
  icon: '📌',                             // Emoji
  color: '#fb923c',                       // Cor em hex
  type: 'expense',                        // 'income' ou 'expense'
  order: 7.5,                             // Ordem no dropdown (entre 7 e 8)
  aiDescription: 'Outras despesas operacionais não classificadas nas categorias anteriores'
},
```

#### 1.2 Adicionar na seção `structure`:

Encontre onde está:
```javascript
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
  ...
}
```

E adicione ENTRE eles:
```javascript
{
  step: 'despesa_administrativa',
  type: 'category',
  operation: 'subtract',
  label: 'Despesas Administrativas'
},
{
  step: 'outras_despesas_op',           // ← NOVO!
  type: 'category',
  operation: 'subtract',
  label: 'Outras Despesas Operacionais'
},
{
  step: 'ebitda',
  type: 'result',
  operation: 'result',
  ...
}
```

#### 1.3 Atualizar a fórmula do EBITDA:

```javascript
{
  step: 'ebitda',
  type: 'result',
  operation: 'result',
  label: 'EBITDA',
  formula: 'margem_contribuicao - despesa_comercial - despesa_pessoal - despesa_administrativa - outras_despesas_op', // ← atualizado
  note: 'Earnings Before Interest, Taxes, Depreciation and Amortization'
},
```

### ✅ PASSO 2: Rodar o Gerador

Execute o script de geração:

```bash
node generate-dre-code.js
```

Isso vai:
1. Validar a configuração
2. Gerar o código atualizado para `app.js`
3. Gerar o código atualizado para `classify-dre.js`
4. Criar arquivos de saída prontos para substituir

### ✅ PASSO 3: Substituir os Arquivos

```bash
# Backup (opcional)
cp app.js app.js.backup
cp api/classify-dre.js api/classify-dre.js.backup

# Substituir com código gerado
# (os arquivos estarão em /generated/)
cp generated/app-generated.js app.js
cp generated/classify-dre-generated.js api/classify-dre.js
```

### ✅ PASSO 4: Deploy e Teste

```bash
git add .
git commit -m "feat: adicionar categoria Outras Despesas Operacionais"
git push
```

---

## 🎯 EXEMPLO 2: Adicionar Conta que SOMA (Receita)

Se você quer adicionar **"Subsídios Governamentais"** que SOMA no Lucro Líquido:

### 1. Adicionar em `categories`:

```javascript
{
  id: 'subsidios',
  field: 'f_subsidios',
  label: 'Subsídios Governamentais',
  icon: '🏛️',
  color: '#22c55e',
  type: 'income',                  // ← INCOME porque SOMA
  order: 11.5,
  aiDescription: 'Subsídios, incentivos fiscais e benefícios governamentais'
},
```

### 2. Adicionar em `structure`:

```javascript
{
  step: 'receita_nao_operacional',
  type: 'category',
  operation: 'add',
  label: 'Receita Não Operacional'
},
{
  step: 'subsidios',               // ← NOVO!
  type: 'category',
  operation: 'add',                // ← OPERATION ADD!
  label: 'Subsídios Governamentais'
},
{
  step: 'lucro_liquido',
  type: 'result',
  operation: 'result',
  label: 'Lucro Líquido',
  formula: 'ebitda - depreciacao - despesa_financeira - imposto_lucro + receita_nao_operacional + subsidios' // ← atualizar
}
```

---

## 🎯 EXEMPLO 3: Adicionar Conta Entre CMV e Lucro Bruto

Para adicionar **"Frete sobre Compras"** (que reduz a margem bruta):

### 1. Adicionar em `categories`:

```javascript
{
  id: 'frete_compras',
  field: 'f_frete_compras',
  label: 'Frete sobre Compras',
  icon: '🚚',
  color: '#dc2626',
  type: 'expense',
  order: 3.5,
  aiDescription: 'Frete, transporte e logística de compra de mercadorias'
},
```

### 2. Adicionar em `structure`:

```javascript
{
  step: 'custo_variavel',
  type: 'category',
  operation: 'subtract',
  label: 'CMV / Custo do Produto'
},
{
  step: 'frete_compras',           // ← NOVO!
  type: 'category',
  operation: 'subtract',
  label: 'Frete sobre Compras'
},
{
  step: 'lucro_bruto',
  type: 'result',
  operation: 'result',
  label: 'Lucro Bruto',
  formula: 'receita_liquida - custo_variavel - frete_compras' // ← atualizar
}
```

---

## ⚠️ REGRAS IMPORTANTES

### ✅ FAZER:
- **Sempre rodar o gerador** após editar `dre-config.js`
- **Testar localmente** antes de fazer deploy
- **Fazer backup** dos arquivos antes de substituir
- **Commitar a config junto** com o código gerado

### ❌ NÃO FAZER:
- **NÃO edite `app.js` manualmente** para adicionar categorias
- **NÃO edite `classify-dre.js` manualmente**
- **NÃO pule a validação** do gerador
- **NÃO use IDs duplicados** de categorias

---

## 🔍 CHECKLIST ANTES DE DEPLOY

- [ ] Config validada sem erros (`node validate-config.js`)
- [ ] Código gerado sem warnings
- [ ] Testes locais passando
- [ ] Backup dos arquivos originais feito
- [ ] Commit com mensagem descritiva

---

## 📚 ESTRUTURA DE ARQUIVOS

```
projeto/
├── dre-config.js           ← VOCÊ EDITA AQUI
├── dre-generator.js        ← Gerador (não editar)
├── generate-dre-code.js    ← Script de execução
├── validate-config.js      ← Validador
│
├── generated/              ← Saída do gerador
│   ├── app-generated.js
│   └── classify-dre-generated.js
│
└── app.js                  ← Substituir com generated/app-generated.js
    api/
    └── classify-dre.js     ← Substituir com generated/classify-dre-generated.js
```

---

## 🎯 RESULTADO

Com essa estrutura, adicionar uma nova conta é **literalmente**:

1. ✏️ Editar 1 arquivo (`dre-config.js`)
2. ▶️ Rodar 1 comando (`node generate-dre-code.js`)
3. 📦 Substituir 2 arquivos (auto-gerados)
4. 🚀 Deploy

**De 16 lugares diferentes para 1 arquivo único!** 🎉
