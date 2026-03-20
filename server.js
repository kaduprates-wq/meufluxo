const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      cidade TEXT DEFAULT '',
      tipo TEXT DEFAULT 'cliente',
      status TEXT DEFAULT 'ativo',
      criado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transacoes (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      valor NUMERIC NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('receita','despesa')),
      categoria TEXT DEFAULT '',
      status TEXT DEFAULT 'pendente',
      data DATE DEFAULT CURRENT_DATE,
      criado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      categoria TEXT DEFAULT '',
      quantidade INTEGER DEFAULT 0,
      quantidade_minima INTEGER DEFAULT 1,
      valor_unitario NUMERIC DEFAULT 0,
      criado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS config_mei (
      id INTEGER PRIMARY KEY DEFAULT 1,
      nome_empresa TEXT DEFAULT 'Minha Empresa MEI',
      cnpj TEXT DEFAULT '',
      atividade TEXT DEFAULT '',
      limite_anual NUMERIC DEFAULT 81000,
      das_mensal NUMERIC DEFAULT 71.60
    );
    INSERT INTO config_mei (id) VALUES (1) ON CONFLICT DO NOTHING;
  `);
  console.log('Banco de dados pronto!');
}

app.get('/api/clientes', async (req, res) => {
  const { busca } = req.query;
  const q = busca
    ? await pool.query(`SELECT * FROM clientes WHERE nome ILIKE $1 OR email ILIKE $1 ORDER BY criado_em DESC`, [`%${busca}%`])
    : await pool.query(`SELECT * FROM clientes ORDER BY criado_em DESC`);
  res.json(q.rows);
});

app.post('/api/clientes', async (req, res) => {
  const { nome, email, telefone, cidade, tipo, status } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const r = await pool.query(
    `INSERT INTO clientes (nome, email, telefone, cidade, tipo, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [nome, email||'', telefone||'', cidade||'', tipo||'cliente', status||'ativo']
  );
  res.status(201).json(r.rows[0]);
});

app.put('/api/clientes/:id', async (req, res) => {
  const { nome, email, telefone, cidade, tipo, status } = req.body;
  await pool.query(
    `UPDATE clientes SET nome=$1, email=$2, telefone=$3, cidade=$4, tipo=$5, status=$6 WHERE id=$7`,
    [nome, email, telefone, cidade, tipo, status, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/clientes/:id', async (req, res) => {
  await pool.query('DELETE FROM clientes WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/transacoes/resumo', async (req, res) => {
  const receitas = (await pool.query(`SELECT COALESCE(SUM(valor),0) as total FROM transacoes WHERE tipo='receita' AND date_trunc('month',data)=date_trunc('month',NOW())`)).rows[0].total;
  const despesas = (await pool.query(`SELECT COALESCE(SUM(valor),0) as total FROM transacoes WHERE tipo='despesa' AND date_trunc('month',data)=date_trunc('month',NOW())`)).rows[0].total;
  const anoAtual = (await pool.query(`SELECT COALESCE(SUM(valor),0) as total FROM transacoes WHERE tipo='receita' AND date_trunc('year',data)=date_trunc('year',NOW())`)).rows[0].total;
  const config   = (await pool.query('SELECT * FROM config_mei WHERE id=1')).rows[0];
  res.json({ receitas, despesas, saldo: receitas - despesas, faturamento_anual: anoAtual, limite_anual: config.limite_anual });
});

app.get('/api/transacoes', async (req, res) => {
  const { busca, tipo } = req.query;
  let sql = 'SELECT * FROM transacoes WHERE 1=1';
  const params = [];
  if (busca) { params.push(`%${busca}%`); sql += ` AND descricao ILIKE $${params.length}`; }
  if (tipo)  { params.push(tipo);         sql += ` AND tipo = $${params.length}`; }
  sql += ' ORDER BY data DESC, criado_em DESC';
  const r = await pool.query(sql, params);
  res.json(r.rows);
});

app.post('/api/transacoes', async (req, res) => {
  const { descricao, valor, tipo, categoria, status, data } = req.body;
  if (!descricao || !valor || !tipo) return res.status(400).json({ erro: 'Campos obrigatorios' });
  const r = await pool.query(
    `INSERT INTO transacoes (descricao, valor, tipo, categoria, status, data) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [descricao, valor, tipo, categoria||'', status||'pendente', data||new Date().toISOString().split('T')[0]]
  );
  res.status(201).json(r.rows[0]);
});

app.put('/api/transacoes/:id', async (req, res) => {
  const { descricao, valor, tipo, categoria, status, data } = req.body;
  await pool.query(
    `UPDATE transacoes SET descricao=$1, valor=$2, tipo=$3, categoria=$4, status=$5, data=$6 WHERE id=$7`,
    [descricao, valor, tipo, categoria, status, data, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/transacoes/:id', async (req, res) => {
  await pool.query('DELETE FROM transacoes WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/produtos', async (req, res) => {
  const { busca } = req.query;
  const q = busca
    ? await pool.query('SELECT * FROM produtos WHERE nome ILIKE $1 ORDER BY nome', [`%${busca}%`])
    : await pool.query('SELECT * FROM produtos ORDER BY nome');
  res.json(q.rows);
});

app.post('/api/produtos', async (req, res) => {
  const { nome, categoria, quantidade, quantidade_minima, valor_unitario } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const r = await pool.query(
    `INSERT INTO produtos (nome, categoria, quantidade, quantidade_minima, valor_unitario) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [nome, categoria||'', quantidade||0, quantidade_minima||1, valor_unitario||0]
  );
  res.status(201).json(r.rows[0]);
});

app.put('/api/produtos/:id', async (req, res) => {
  const { nome, categoria, quantidade, quantidade_minima, valor_unitario } = req.body;
  await pool.query(
    `UPDATE produtos SET nome=$1, categoria=$2, quantidade=$3, quantidade_minima=$4, valor_unitario=$5 WHERE id=$6`,
    [nome, categoria, quantidade, quantidade_minima, valor_unitario, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/produtos/:id', async (req, res) => {
  await pool.query('DELETE FROM produtos WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/config', async (req, res) => {
  const r = await pool.query('SELECT * FROM config_mei WHERE id=1');
  res.json(r.rows[0]);
});

app.put('/api/config', async (req, res) => {
  const { nome_empresa, cnpj, atividade, limite_anual, das_mensal } = req.body;
  await pool.query(
    `UPDATE config_mei SET nome_empresa=$1, cnpj=$2, atividade=$3, limite_anual=$4, das_mensal=$5 WHERE id=1`,
    [nome_empresa, cnpj, atividade, limite_anual, das_mensal]
  );
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`MeuFluxo rodando em http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erro ao conectar no banco:', err);
  process.exit(1);
});
