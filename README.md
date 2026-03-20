# MeuFluxo — ERP para MEI

Sistema de gestão completo para Microempreendedores Individuais.

## Módulos
- **Dashboard** — visão geral de receitas, despesas e alertas
- **Financeiro** — controle de contas a pagar e receber
- **Clientes & Fornecedores** — cadastro completo
- **Estoque** — controle de produtos com alerta de mínimo
- **Tributário** — acompanhamento do limite MEI e DAS mensal

---

## Como rodar

### 1. Instale o Node.js
Acesse https://nodejs.org e baixe a versão **LTS**.

### 2. Abra o terminal na pasta `backend`
No Windows: clique com botão direito na pasta `backend` → "Abrir no Terminal"

### 3. Instale as dependências
```
npm install
```

### 4. Inicie o servidor
```
npm start
```

### 5. Acesse no navegador
```
http://localhost:3000
```

---

## Estrutura do projeto
```
meufluxo/
├── backend/
│   ├── server.js        ← API + servidor
│   ├── package.json
│   └── meufluxo.db      ← banco de dados (criado automaticamente)
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Tecnologias
- **Frontend:** HTML, CSS, JavaScript puro
- **Backend:** Node.js + Express
- **Banco de dados:** SQLite (arquivo local, sem instalação extra)
