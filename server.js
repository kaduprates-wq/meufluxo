const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// ─── Banco de dados ───────────────────────────────────────────────────────────
const db = new Database('./meufluxo.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    cidade TEXT,
    tipo TEXT DEFAULT 'cliente',
    status TEXT DEFAULT 'ativo',
    criado_em TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('receita','despesa')),
    categoria TEXT,
    status TEXT DEFAULT 'pendente',
    data TEXT DEFAULT (date('now')),
    criado_em TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria TEXT,
    quantidade INTEGER DEFAULT 0,
    quantidade_minima INTEGER DEFAULT 1,
    valor_unitario REAL DEFAULT 0,
    criado_em TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config_mei (
    id INTEGER PRIMARY KEY DEFAULT 1,
    nome_empresa TEXT DEFAULT 'Minha Empresa MEI',
    cnpj TEXT DEFAULT '',
    atividade TEXT DEFAULT '',
    limite_anual REAL DEFAULT 81000,
    das_mensal REAL DEFAULT 71.60
  );

  INSERT OR IGNORE INTO config_mei (id) VALUES (1);
`);

// ─── ROTAS: Clientes ─────────────────────────────────────────────────────────
app.get('/api/clientes', (req, res) => {
  const { busca } = req.query;
  let rows;
  if (busca) {
    rows = db.prepare(`SELECT * FROM clientes WHERE nome LIKE ? OR email LIKE ? ORDER BY criado_em DESC`)
      .all(`%${busca}%`, `%${busca}%`);
  } else {
    rows = db.prepare('SELECT * FROM clientes ORDER BY criado_em DESC').all();
  }
  res.json(rows);
});

app.post('/api/clientes', (req, res) => {
  const { nome, email, telefone, cidade, tipo, status } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const r = db.prepare(`INSERT INTO clientes (nome, email, telefone, cidade, tipo, status) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(nome, email || '', telefone || '', cidade || '', tipo || 'cliente', status || 'ativo');
  res.status(201).json({ id: r.lastInsertRowid, ...req.body });
});

app.put('/api/clientes/:id', (req, res) => {
  const { nome, email, telefone, cidade, tipo, status } = req.body;
  db.prepare(`UPDATE clientes SET nome=?, email=?, telefone=?, cidade=?, tipo=?, status=? WHERE id=?`)
    .run(nome, email, telefone, cidade, tipo, status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/clientes/:id', (req, res) => {
  db.prepare('DELETE FROM clientes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── ROTAS: Transações ───────────────────────────────────────────────────────
app.get('/api/transacoes', (req, res) => {
  const { busca, tipo } = req.query;
  let sql = 'SELECT * FROM transacoes WHERE 1=1';
  const params = [];
  if (busca) { sql += ' AND descricao LIKE ?'; params.push(`%${busca}%`); }
  if (tipo)  { sql += ' AND tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY data DESC, criado_em DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/transacoes/resumo', (req, res) => {
  const receitas  = db.prepare(`SELECT COALESCE(SUM(valor),0) as total FROM transacoes WHERE tipo='receita' AND strftime('%Y-%m', data) = strftime('%Y-%m', 'now')`).get().total;
  const despesas  = db.prepare(`SELECT COALESCE(SUM(valor),0) as total FROM transacoes WHERE tipo='despesa' AND strftime('%Y-%m', data) = strftime('%Y-%m', 'now')`).get().total;
  const anoAtual  = db.prepare(`SELECT COALESCE(SUM(valor),0) as total FROM transacoes WHERE tipo='receita' AND strftime('%Y', data) = strftime('%Y', 'now')`).get().total;
  const config    = db.prepare('SELECT * FROM config_mei WHERE id=1').get();
  res.json({ receitas, despesas, saldo: receitas - despesas, faturamento_anual: anoAtual, limite_anual: config.limite_anual });
});

app.post('/api/transacoes', (req, res) => {
  const { descricao, valor, tipo, categoria, status, data } = req.body;
  if (!descricao || !valor || !tipo) return res.status(400).json({ erro: 'Campos obrigatórios: descricao, valor, tipo' });
  const r = db.prepare(`INSERT INTO transacoes (descricao, valor, tipo, categoria, status, data) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(descricao, valor, tipo, categoria || '', status || 'pendente', data || new Date().toISOString().split('T')[0]);
  res.status(201).json({ id: r.lastInsertRowid, ...req.body });
});

app.put('/api/transacoes/:id', (req, res) => {
  const { descricao, valor, tipo, categoria, status, data } = req.body;
  db.prepare(`UPDATE transacoes SET descricao=?, valor=?, tipo=?, categoria=?, status=?, data=? WHERE id=?`)
    .run(descricao, valor, tipo, categoria, status, data, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/transacoes/:id', (req, res) => {
  db.prepare('DELETE FROM transacoes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── ROTAS: Estoque ──────────────────────────────────────────────────────────
app.get('/api/produtos', (req, res) => {
  const { busca } = req.query;
  let rows;
  if (busca) {
    rows = db.prepare('SELECT * FROM produtos WHERE nome LIKE ? ORDER BY nome').all(`%${busca}%`);
  } else {
    rows = db.prepare('SELECT * FROM produtos ORDER BY nome').all();
  }
  res.json(rows);
});

app.post('/api/produtos', (req, res) => {
  const { nome, categoria, quantidade, quantidade_minima, valor_unitario } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const r = db.prepare(`INSERT INTO produtos (nome, categoria, quantidade, quantidade_minima, valor_unitario) VALUES (?, ?, ?, ?, ?)`)
    .run(nome, categoria || '', quantidade || 0, quantidade_minima || 1, valor_unitario || 0);
  res.status(201).json({ id: r.lastInsertRowid, ...req.body });
});

app.put('/api/produtos/:id', (req, res) => {
  const { nome, categoria, quantidade, quantidade_minima, valor_unitario } = req.body;
  db.prepare(`UPDATE produtos SET nome=?, categoria=?, quantidade=?, quantidade_minima=?, valor_unitario=? WHERE id=?`)
    .run(nome, categoria, quantidade, quantidade_minima, valor_unitario, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/produtos/:id', (req, res) => {
  db.prepare('DELETE FROM produtos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── ROTAS: Config MEI ───────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json(db.prepare('SELECT * FROM config_mei WHERE id=1').get());
});

app.put('/api/config', (req, res) => {
  const { nome_empresa, cnpj, atividade, limite_anual, das_mensal } = req.body;
  db.prepare(`UPDATE config_mei SET nome_empresa=?, cnpj=?, atividade=?, limite_anual=?, das_mensal=? WHERE id=1`)
    .run(nome_empresa, cnpj, atividade, limite_anual, das_mensal);
  res.json({ ok: true });
});

// ─── Rota padrão ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ MeuFluxo rodando em http://localhost:${PORT}\n`);
});
