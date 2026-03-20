const API = 'http://localhost:3000/api';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const TITLES = { dashboard:'Dashboard', financeiro:'Financeiro', clientes:'Clientes & Fornecedores', estoque:'Controle de Estoque', tributario:'Controle Tributário' };

let editando = { tipo: null, id: null };

// ─── Navegação ────────────────────────────────────────────────────────────────
function nav(id, el) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('s-' + id).classList.add('active');
  el.classList.add('active');
  document.getElementById('page-title').textContent = TITLES[id];
  if (id === 'dashboard')  carregarDashboard();
  if (id === 'financeiro') carregarTransacoes();
  if (id === 'clientes')   carregarClientes();
  if (id === 'estoque')    carregarProdutos();
  if (id === 'tributario') carregarTributario();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const get  = url => fetch(API + url).then(r => r.json());
const post = (url, body) => fetch(API + url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());
const put  = (url, body) => fetch(API + url, { method:'PUT',  headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());
const del  = url => fetch(API + url, { method:'DELETE' }).then(r => r.json());

function statusBadge(s) {
  const map = { recebido:'s-green', pago:'s-red', pendente:'s-amber', 'a receber':'s-blue', ativo:'s-green', inativo:'s-amber', critico:'s-red', ok:'s-green' };
  return `<span class="status ${map[s?.toLowerCase()] || 's-blue'}">${s}</span>`;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function carregarDashboard() {
  const [resumo, transacoes, produtos, config] = await Promise.all([
    get('/transacoes/resumo'), get('/transacoes?limit=4'), get('/produtos'), get('/config')
  ]);

  document.getElementById('m-receita').textContent  = fmt(resumo.receitas);
  document.getElementById('m-despesas').textContent = fmt(resumo.despesas);
  document.getElementById('m-saldo').textContent    = fmt(resumo.saldo);

  const pct = Math.round((resumo.faturamento_anual / resumo.limite_anual) * 100);
  document.getElementById('m-limite').textContent  = pct + '%';
  document.getElementById('m-limite-sub').textContent = `${fmt(resumo.faturamento_anual)} / ${fmt(resumo.limite_anual)}`;

  const initials = config.nome_empresa?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || 'ME';
  document.getElementById('avatar-initials').textContent = initials;

  const tbT = document.getElementById('dash-transacoes');
  const recent = transacoes.slice(0,4);
  tbT.innerHTML = recent.length ? recent.map(t => `
    <tr>
      <td>${t.descricao}</td>
      <td style="color:${t.tipo==='receita'?'var(--green-dark)':'var(--red)'}">${t.tipo==='receita'?'+':'-'}${fmt(t.valor)}</td>
      <td>${statusBadge(t.status)}</td>
    </tr>`).join('') : '<tr><td colspan="3" class="empty">Nenhuma transação</td></tr>';

  const criticos = produtos.filter(p => p.quantidade <= p.quantidade_minima);
  const tbE = document.getElementById('dash-estoque');
  tbE.innerHTML = criticos.length ? criticos.slice(0,4).map(p => `
    <tr>
      <td>${p.nome}</td>
      <td style="color:${p.quantidade < p.quantidade_minima ? 'var(--red)' : 'var(--green-dark)'};font-weight:500">${p.quantidade}</td>
      <td>${p.quantidade_minima}</td>
    </tr>`).join('') : '<tr><td colspan="3" class="empty">Estoque OK</td></tr>';
}

// ─── Financeiro ───────────────────────────────────────────────────────────────
async function carregarTransacoes() {
  const busca = document.getElementById('busca-transacoes')?.value || '';
  const rows  = await get('/transacoes' + (busca ? `?busca=${busca}` : ''));
  const tb = document.getElementById('lista-transacoes');
  tb.innerHTML = rows.length ? rows.map(t => `
    <tr>
      <td>${t.data}</td>
      <td>${t.descricao}</td>
      <td>${t.categoria || '—'}</td>
      <td style="color:${t.tipo==='receita'?'var(--green-dark)':'var(--red)'}">${t.tipo==='receita'?'+':'-'}${fmt(t.valor)}</td>
      <td>${statusBadge(t.status)}</td>
      <td>
        <button class="icon-btn" onclick="editarTransacao(${t.id})">✎</button>
        <button class="icon-btn del" onclick="excluir('transacoes',${t.id},carregarTransacoes)">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">Nenhuma transação encontrada</td></tr>';
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
async function carregarClientes() {
  const busca = document.getElementById('busca-clientes')?.value || '';
  const rows  = await get('/clientes' + (busca ? `?busca=${busca}` : ''));
  const tb = document.getElementById('lista-clientes');
  tb.innerHTML = rows.length ? rows.map(c => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="avatar" style="background:#B5D4F4;color:#185FA5;font-size:10px">${c.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>
        ${c.nome}
      </div></td>
      <td>${c.email || '—'}</td>
      <td>${c.cidade || '—'}</td>
      <td>${c.tipo}</td>
      <td>${statusBadge(c.status)}</td>
      <td>
        <button class="icon-btn" onclick="editarCliente(${c.id})">✎</button>
        <button class="icon-btn del" onclick="excluir('clientes',${c.id},carregarClientes)">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">Nenhum cliente encontrado</td></tr>';
}

// ─── Estoque ──────────────────────────────────────────────────────────────────
async function carregarProdutos() {
  const busca = document.getElementById('busca-produtos')?.value || '';
  const rows  = await get('/produtos' + (busca ? `?busca=${busca}` : ''));
  const tb = document.getElementById('lista-produtos');
  tb.innerHTML = rows.length ? rows.map(p => {
    const critico = p.quantidade <= p.quantidade_minima;
    return `
    <tr>
      <td>${p.nome}</td>
      <td>${p.categoria || '—'}</td>
      <td style="color:${critico?'var(--red)':'var(--green-dark)'};font-weight:${critico?500:400}">${p.quantidade}</td>
      <td>${p.quantidade_minima}</td>
      <td>${fmt(p.valor_unitario)}</td>
      <td>${statusBadge(critico ? 'Crítico' : 'OK')}</td>
      <td>
        <button class="icon-btn" onclick="editarProduto(${p.id})">✎</button>
        <button class="icon-btn del" onclick="excluir('produtos',${p.id},carregarProdutos)">✕</button>
      </td>
    </tr>`;}).join('') : '<tr><td colspan="7" class="empty">Nenhum produto encontrado</td></tr>';
}

// ─── Tributário ───────────────────────────────────────────────────────────────
async function carregarTributario() {
  const [resumo, config] = await Promise.all([get('/transacoes/resumo'), get('/config')]);
  const pct = Math.min(100, Math.round((resumo.faturamento_anual / config.limite_anual) * 100));
  const bar  = document.getElementById('trib-bar');
  bar.style.width = pct + '%';
  bar.className = 'limit-fill' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');
  document.getElementById('trib-label').textContent = `Faturamento anual — ${fmt(resumo.faturamento_anual)} de ${fmt(config.limite_anual)}`;
  document.getElementById('trib-pct').textContent   = pct + '% utilizado';

  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth();
  const grid = document.getElementById('das-grid');
  grid.innerHTML = MESES.slice(0, 12).map((m, i) => {
    const cls = i < mesAtual ? 'pago' : i === mesAtual ? 'pendente' : '';
    const txt = i <= mesAtual ? statusBadge(i < mesAtual ? 'Pago' : 'Pendente') : '';
    const val = i <= mesAtual ? fmt(config.das_mensal) : '—';
    return `<div class="das-card ${cls}${i > mesAtual?' opacity-40':''}">
      <div class="das-month">${m}</div>
      <div class="das-val">${val}</div>${txt}
    </div>`;
  }).join('');

  document.getElementById('config-table').innerHTML = `
    <tr><td style="color:var(--tx2)">Empresa</td><td>${config.nome_empresa}</td></tr>
    <tr><td style="color:var(--tx2)">CNPJ</td><td>${config.cnpj || '—'}</td></tr>
    <tr><td style="color:var(--tx2)">Atividade</td><td>${config.atividade || '—'}</td></tr>
    <tr><td style="color:var(--tx2)">Limite anual</td><td>${fmt(config.limite_anual)}</td></tr>
    <tr><td style="color:var(--tx2)">DAS mensal</td><td>${fmt(config.das_mensal)}</td></tr>
    <tr><td style="color:var(--tx2)">Situação</td><td>${statusBadge('ativo')}</td></tr>`;
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function abrirModal(tipo, dados) {
  editando = { tipo, id: dados?.id || null };
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-title').textContent = dados
    ? 'Editar ' + tipo
    : 'Novo ' + tipo;

  const body = document.getElementById('modal-body');
  if (tipo === 'transacao') body.innerHTML = formTransacao(dados);
  if (tipo === 'cliente')   body.innerHTML = formCliente(dados);
  if (tipo === 'produto')   body.innerHTML = formProduto(dados);
  if (tipo === 'config')    body.innerHTML = formConfig(dados);
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editando = { tipo: null, id: null };
}

async function salvar() {
  const { tipo, id } = editando;
  let dados = {};
  document.querySelectorAll('#modal-body [name]').forEach(el => dados[el.name] = el.value);

  if (tipo === 'transacao') {
    id ? await put(`/transacoes/${id}`, dados) : await post('/transacoes', dados);
    fecharModal(); carregarTransacoes();
  } else if (tipo === 'cliente') {
    id ? await put(`/clientes/${id}`, dados) : await post('/clientes', dados);
    fecharModal(); carregarClientes();
  } else if (tipo === 'produto') {
    id ? await put(`/produtos/${id}`, dados) : await post('/produtos', dados);
    fecharModal(); carregarProdutos();
  } else if (tipo === 'config') {
    await put('/config', dados);
    fecharModal(); carregarTributario();
  }
}

async function excluir(entidade, id, reload) {
  if (!confirm('Confirmar exclusão?')) return;
  await del(`/${entidade}/${id}`);
  reload();
}

// ─── Funções de edição ────────────────────────────────────────────────────────
async function editarTransacao(id) {
  const rows = await get('/transacoes');
  const t = rows.find(x => x.id === id);
  if (t) abrirModal('transacao', t);
}
async function editarCliente(id) {
  const rows = await get('/clientes');
  const c = rows.find(x => x.id === id);
  if (c) abrirModal('cliente', c);
}
async function editarProduto(id) {
  const rows = await get('/produtos');
  const p = rows.find(x => x.id === id);
  if (p) abrirModal('produto', p);
}

// ─── Formulários ─────────────────────────────────────────────────────────────
function formTransacao(d={}) {
  return `
  <div class="form-row">
    <div class="form-group">
      <label>Tipo *</label>
      <select name="tipo">
        <option value="receita"  ${d.tipo==='receita' ?'selected':''}>Receita</option>
        <option value="despesa"  ${d.tipo==='despesa' ?'selected':''}>Despesa</option>
      </select>
    </div>
    <div class="form-group">
      <label>Status</label>
      <select name="status">
        <option value="pendente"   ${d.status==='pendente'  ?'selected':''}>Pendente</option>
        <option value="recebido"   ${d.status==='recebido'  ?'selected':''}>Recebido</option>
        <option value="pago"       ${d.status==='pago'      ?'selected':''}>Pago</option>
        <option value="a receber"  ${d.status==='a receber' ?'selected':''}>A receber</option>
      </select>
    </div>
  </div>
  <div class="form-group"><label>Descrição *</label><input name="descricao" value="${d.descricao||''}" placeholder="Ex: Serviço de design" /></div>
  <div class="form-row">
    <div class="form-group"><label>Valor (R$) *</label><input name="valor" type="number" step="0.01" value="${d.valor||''}" placeholder="0,00" /></div>
    <div class="form-group"><label>Data</label><input name="data" type="date" value="${d.data||new Date().toISOString().split('T')[0]}" /></div>
  </div>
  <div class="form-group"><label>Categoria</label><input name="categoria" value="${d.categoria||''}" placeholder="Ex: Receita de serviço" /></div>
  <div class="modal-actions">
    <button class="btn" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvar()">Salvar</button>
  </div>`;
}

function formCliente(d={}) {
  return `
  <div class="form-group"><label>Nome *</label><input name="nome" value="${d.nome||''}" placeholder="Nome completo ou empresa" /></div>
  <div class="form-row">
    <div class="form-group"><label>Email</label><input name="email" type="email" value="${d.email||''}" placeholder="email@exemplo.com" /></div>
    <div class="form-group"><label>Telefone</label><input name="telefone" value="${d.telefone||''}" placeholder="(xx) xxxxx-xxxx" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Cidade</label><input name="cidade" value="${d.cidade||''}" placeholder="Cidade" /></div>
    <div class="form-group"><label>Tipo</label>
      <select name="tipo">
        <option value="cliente"    ${d.tipo==='cliente'   ?'selected':''}>Cliente</option>
        <option value="fornecedor" ${d.tipo==='fornecedor'?'selected':''}>Fornecedor</option>
        <option value="ambos"      ${d.tipo==='ambos'     ?'selected':''}>Ambos</option>
      </select>
    </div>
  </div>
  <div class="form-group"><label>Status</label>
    <select name="status">
      <option value="ativo"   ${d.status==='ativo'  ?'selected':''}>Ativo</option>
      <option value="inativo" ${d.status==='inativo'?'selected':''}>Inativo</option>
    </select>
  </div>
  <div class="modal-actions">
    <button class="btn" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvar()">Salvar</button>
  </div>`;
}

function formProduto(d={}) {
  return `
  <div class="form-group"><label>Nome *</label><input name="nome" value="${d.nome||''}" placeholder="Nome do produto" /></div>
  <div class="form-group"><label>Categoria</label><input name="categoria" value="${d.categoria||''}" placeholder="Ex: Material escritório" /></div>
  <div class="form-row">
    <div class="form-group"><label>Qtd atual</label><input name="quantidade" type="number" value="${d.quantidade||0}" /></div>
    <div class="form-group"><label>Qtd mínima</label><input name="quantidade_minima" type="number" value="${d.quantidade_minima||1}" /></div>
  </div>
  <div class="form-group"><label>Valor unitário (R$)</label><input name="valor_unitario" type="number" step="0.01" value="${d.valor_unitario||0}" /></div>
  <div class="modal-actions">
    <button class="btn" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvar()">Salvar</button>
  </div>`;
}

async function formConfig(d) {
  if (!d) d = await get('/config');
  return `
  <div class="form-group"><label>Nome da empresa</label><input name="nome_empresa" value="${d.nome_empresa||''}" /></div>
  <div class="form-group"><label>CNPJ</label><input name="cnpj" value="${d.cnpj||''}" placeholder="00.000.000/0001-00" /></div>
  <div class="form-group"><label>Atividade principal</label><input name="atividade" value="${d.atividade||''}" /></div>
  <div class="form-row">
    <div class="form-group"><label>Limite anual (R$)</label><input name="limite_anual" type="number" value="${d.limite_anual||81000}" /></div>
    <div class="form-group"><label>DAS mensal (R$)</label><input name="das_mensal" type="number" step="0.01" value="${d.das_mensal||71.60}" /></div>
  </div>
  <div class="modal-actions">
    <button class="btn" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="salvar()">Salvar</button>
  </div>`;
}

// Abre config com dados carregados da API
async function abrirModalConfig() {
  const config = await get('/config');
  editando = { tipo: 'config', id: 1 };
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-title').textContent = 'Configurações MEI';
  document.getElementById('modal-body').innerHTML = await formConfig(config);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
carregarDashboard();
