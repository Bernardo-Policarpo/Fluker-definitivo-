# 🌐 Fluker

[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)]()
[![PythonAnywhere](https://img.shields.io/badge/deploy-pythonanywhere-blue)]()

Fluker é uma rede social em desenvolvimento criada por um grupo de amigos, com o objetivo de oferecer uma plataforma simples e interativa para **compartilhar postagens**, **conversar com amigos** e **acompanhar notificações em tempo real**.

🔗 **Acesse o projeto online:** [https://fluker.pythonanywhere.com](https://fluker.pythonanywhere.com)

---

## 📖 Visão Geral

O **Fluker** busca unir aprendizado prático em desenvolvimento web e diversão, criando uma experiência social moderna e leve.  
Nosso foco está em **funcionalidades essenciais** de uma rede social, mas com **tecnologias simples** e **gestão de dados via CSV**, facilitando o entendimento e a colaboração entre os desenvolvedores.

---

## 🚀 Funcionalidades

✅ **Sistema de postagens** — crie, e visualize postagens de outros usuários.  
✅ **Notificações** — receba alertas sobre novas interações.  
✅ **Chat integrado** — converse com outros usuários dentro da própria plataforma.  
✅ **Autenticação de usuário** — login, logout e gerenciamento de sessão.  
✅ **Interface intuitiva** — navegação simples e visual limpo.  

*(Mais recursos em breve!)*

---

## 🧠 Tecnologias Utilizadas

- **Python** — linguagem principal do projeto  
- **Flask** — framework web usado para rotas e views  
- **HTML, CSS e JavaScript** — para o front-end e interação do usuário  
- **CSV** — utilizado como sistema principal de armazenamento de dados (usuários, postagens, mensagens, etc.)  
- **PythonAnywhere** — hospedagem e deploy do projeto  

---

## 🗂️ Estrutura do Projeto

Organização do repositório:

###

```text
fluker/
├── app.py
├── README.md
├── requirements.txt
├── src/
│   ├── data/
│   │   ├── messages.csv
│   │   ├── notifications.csv
│   │   ├── posts.csv
│   │   └── users.csv
│   │
│   ├── pages/                   
│   │   ├── index.html
│   │   ├── createaccount.html
│   │   ├── feed.html
│   │   └── recoverypassword.html
│   │
│   └── static/                  
│       ├── css/
│       │   ├── styleLogin.css
│       │   ├── styleRecoverPassword.css
│       │   └── styleFeed.css
│       │
│       ├── scripts/
│       │   └── script.js
│       │
│       └── images/
│           ├── coracao.png
│           ├── logo.png
│           ├── logo1.png
│           ├── Logo-Fluker.png
│           ├── perfil.jpg
│           ├── redheart.png
│           └── sino.png
│
└── .git/
```

---

### 📂 `src/data/`
Armazena todos os arquivos **CSV** usados como banco de dados do Fluker.

- **`users.csv`** → dados de cadastro dos usuários (nome, email, senha, etc.)  
- **`posts.csv`** → postagens criadas pelos usuários (texto, autor, data)  
- **`messages.csv`** → mensagens trocadas no chat integrado  
- **`notifications.csv`** → notificações de novas postagens, mensagens ou interações  

> Esses arquivos substituem o uso de um banco de dados tradicional, mantendo o projeto leve e fácil de compreender.

---

### 📂 `src/pages/`
Contém as **páginas HTML** que formam a interface visual da rede social.

- **`index.html`** → página inicial do site (login principal)  
- **`createaccount.html`** → tela de cadastro para novos usuários  
- **`feed.html`** → página principal do usuário, onde ele vê postagens e interage  
- **`recoverypassword.html`** → página de recuperação de senha (envio de email ou redefinição)

---

### 📂 `src/static/`
Armazena todos os arquivos estáticos servidos pelo Flask (sem renderização Jinja). São entregues “como estão” ao navegador.

- 📁 `css/`
  - Folhas de estilo responsáveis pelo visual das páginas.
  - `styleLogin.css`               estilos da tela de login
  - `styleRecoverPassword.css`     estilos da tela de recuperação de senha
  - `styleFeed.css`                estilos do feed de postagens

- 📁 `scripts/`
  - JavaScript do cliente: interatividade, eventos e chamadas às APIs.
  - `script.js`                    inicializações gerais, handlers (curtir, etc.)

- 📁 `images/`
  - Ícones e imagens da interface.
  - `logo.png`, `Logo-Fluker.png`, `logo1.png`    variantes de logotipo
  - `coracao.png`, `redheart.png`                 ícones de curtida
  - `sino.png`                                    ícone de notificação
  - `perfil.jpg`                                  avatar padrão

  ---

### ⚙️ `.git/`
Pasta interna do Git — **não deve ser alterada manualmente.**  
Armazena todo o histórico de commits, branches e configurações do repositório.

---

## 📅 Roadmap / Próximos Passos

🔹 Melhorar o sistema de perfil e personalização de usuários  
🔹 Adicionar upload de imagens para postagens e perfis  
🔹 Implementar sistema de pesquisa e comentários  
🔹 Migrar para banco de dados relacional (SQLite ou PostgreSQL)  

---

## 👥 Equipe de Desenvolvimento

- 👨‍💻 **Bernado** — desenvolvimento full-stack / coordenação do projeto — desenvolvimento colaborativo
- 👨‍💻 **Ruan** — implementação do banco de dado(csv) e estrutura  principal back-end — desenvolvimento colaborativo
- 👨‍💻 **Lucas** — responsável pelo back-end e pela lógica da aplicação. — desenvolvimento colaborativo
- 👨‍💻 **Pablo** — responsável pelo Front-end — desenvolvimento colaborativo
- 👨‍💻 **Gabriel** — responsável pelo Front-end — desenvolvimento colaborativo

---

