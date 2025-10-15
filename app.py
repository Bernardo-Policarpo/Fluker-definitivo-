from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from functools import wraps
from datetime import datetime
import secrets
import csv
import os

# Paths/base da aplicação
BASE_DIR = os.path.dirname(__file__)
SRC_DIR  = os.path.join(BASE_DIR, 'src')
PAGES_DIR = os.path.join(SRC_DIR, 'pages')   # templates (HTML)
DATA_DIR  = os.path.join(SRC_DIR, 'data')    # arquivos CSV
CSV_PATH  = os.path.join(DATA_DIR, 'users.csv')
STATIC_DIR = os.path.join(SRC_DIR, 'static') # assets estáticos (css/js/img)
MESSAGES_PATH = os.path.join(DATA_DIR, 'messages.csv')
POSTS_PATH = os.path.join(DATA_DIR, 'posts.csv')

# Config básica do Flask, apontando onde estão templates e estáticos
app = Flask(__name__, template_folder=PAGES_DIR, static_folder=STATIC_DIR)

# Secret para sessão (pega do env se existir, senão gera um aleatório)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

# Garante que o CSV de usuários exista com cabeçalho correto
def ensure_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CSV_PATH):
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'username', 'password', 'email'])  # cabeçalho

# Garante CSV de mensagens (DM)
def ensure_messages_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(MESSAGES_PATH):
        with open(MESSAGES_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'sender_id', 'receiver_id', 'timestamp', 'content'])

# Garante CSV de posts (com suporte a likes e likes_by)
def ensure_posts_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(POSTS_PATH):
        with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'author_id', 'author_name', 'timestamp', 'content', 'likes', 'likes_by'])

# Próximo ID para usuários
def next_id():
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(row['id']) for row in reader if row.get('id')]
        return (max(ids) + 1) if ids else 1

# Próximo ID para mensagens
def next_message_id():
    ensure_messages_csv()
    with open(MESSAGES_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(r['id']) for r in reader if r.get('id')]
        return (max(ids) + 1) if ids else 1

# Próximo ID para posts
def next_post_id():
    ensure_posts_csv()
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(r['id']) for r in reader if r.get('id')]
        return (max(ids) + 1) if ids else 1

# Landing page
@app.route('/')
def index():
    return render_template('index.html')

# Tela de cadastro
@app.get('/register')
def register_page():
    return render_template('createaccount.html')

# Salva novo usuário no CSV
@app.route('/salvar', methods=['POST'])
def salvar():
    ensure_csv()
    username = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()
    email = request.form.get('email', '').strip()

    # Adiciona como nova linha no CSV
    with open(CSV_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([next_id(), username, password, email])

    # Volta para a página inicial
    return redirect(url_for('index'))

# Login básico: aceita usuário ou email + senha
@app.post('/login')
def login():
    ensure_csv()
    login_input = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()

    # Campos obrigatórios
    if not login_input or not password:
        return redirect(url_for('index'))

    # Procura linha no CSV com credenciais válidas
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)  # usa cabeçalho: id, username, password, email
        for row in reader:
            row_user = (row.get('username') or '').strip()
            row_email = (row.get('email') or '').strip()
            row_pass = (row.get('password') or '').strip()

            credencial_ok = (login_input == row_user) or (login_input == row_email)
            senha_ok = (password == row_pass)

            if credencial_ok and senha_ok:
                # Login OK → grava na sessão
                session['user_id'] = row.get('id')
                session['username'] = row_user
                session['email'] = row_email
                return redirect(url_for('home_page'))

    # Se não achou, credenciais inválidas → volta para /
    return redirect(url_for('index', erro=1))

# Decorator simples para proteger rotas (exige login)
def login_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            # opcional: flash('Faça login para continuar')
            return redirect(url_for('index'))
        return view_func(*args, **kwargs)
    return wrapper

# Logout: limpa sessão e volta à página inicial
@app.get('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# Página principal (feed) – requer login
@app.get('/home')
@login_required
def home_page():
    ensure_posts_csv()
    # Lê os posts do CSV (utf-8 padrão; se usar Excel e der BOM, trocar por utf-8-sig)
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        posts = list(reader)
    # Ordena por id desc (mais recente em cima)
    posts.sort(key=lambda x: int(x['id']), reverse=True)
    # Passo user_id para o template para saber se o usuário curtiu cada post
    return render_template(
        'feed.html',
        posts=posts,
        username=session.get('username'),
        user_id=str(session.get('user_id'))
    )

# Tela "esqueci a senha" (placeholder)
@app.get('/recover')
def recover_page():
    return render_template('recoverpassword.html')

# Auxiliar: lê todos os usuários (id/username/email)
def get_all_users():
    ensure_csv()
    users = []
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            users.append({
                'id': r['id'],
                'username': r['username'],
                'email': r['email'],
            })
    return users

# Confere se um user_id existe no CSV
def user_exists(user_id):
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get('id') == str(user_id):
                return True
    return False

# Inbox redireciona para o feed por enquanto
@app.get('/inbox')
@login_required
def inbox():
    return redirect(url_for('home_page'))

# API: lista de usuários (para o seletor do chat) – não inclui o próprio usuário
@app.get('/api/users')
@login_required
def api_users():
    uid = str(session.get('user_id'))
    users = [u for u in get_all_users() if u['id'] != uid]
    return jsonify({'users': users})

# API: busca mensagens entre mim e o parceiro (com since_id para polling incremental)
@app.get('/api/messages')
@login_required
def api_messages():
    partner_id = request.args.get('partner_id', type=str)
    since_id = request.args.get('since_id', default=0, type=int)
    me = str(session.get('user_id'))

    # Validação básica
    if not partner_id or not user_exists(partner_id):
        return jsonify({'error': 'partner_id inválido'}), 400

    ensure_messages_csv()
    items = []
    with open(MESSAGES_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if not r.get('id'):
                continue
            try:
                mid = int(r['id'])
            except:
                continue
            if mid <= since_id:
                continue
            s = r['sender_id']
            t = r['receiver_id']
            # Mensagens em que eu sou remetente ou destinatário com o parceiro
            if (s == me and t == partner_id) or (s == partner_id and t == me):
                items.append({
                    'id': mid,
                    'sender_id': s,
                    'receiver_id': t,
                    'timestamp': r['timestamp'],
                    'content': r['content'],
                })
    items.sort(key=lambda x: x['id'])
    return jsonify({'messages': items})

# API: envia mensagem para o parceiro
@app.post('/api/send')
@login_required
def api_send():
    data = request.get_json(silent=True) or {}
    partner_id = str(data.get('partner_id', '')).strip()
    content = str(data.get('content', '')).strip()
    me = str(session.get('user_id'))

    # Validações
    if not partner_id or not user_exists(partner_id):
        return jsonify({'error': 'partner_id inválido'}), 400
    if not content:
        return jsonify({'error': 'Mensagem vazia'}), 400

    ensure_messages_csv()
    mid = next_message_id()
    now = datetime.utcnow().isoformat() + 'Z'  # ISO UTC
    with open(MESSAGES_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([mid, me, partner_id, now, content])

    return jsonify({'ok': True, 'id': mid, 'timestamp': now})

# Cria novo post
@app.post('/postar')
@login_required
def postar():
    ensure_posts_csv()
    content = request.form.get('content', '').strip()
    if not content:
        return redirect(url_for('home_page'))

    # Grava o post com contador de likes zerado e likes_by vazio
    with open(POSTS_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            next_post_id(),
            session['user_id'],
            session['username'],
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            content,
            0,           # likes
            ''           # likes_by (lista de user_ids separados por ';')
        ])
    return redirect(url_for('home_page'))

# Toggle de curtida: se já curtiu, remove; se não, adiciona
@app.post('/curtir/<int:post_id>')
@login_required
def curtir(post_id):
    ensure_posts_csv()
    me = str(session.get('user_id'))

    # Lê todos os posts
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        posts = list(reader)
        fieldnames = list(reader.fieldnames or [])

    # Garante que a coluna likes_by exista (compatível com arquivos mais antigos)
    if 'likes_by' not in fieldnames:
        fieldnames.append('likes_by')
        for p in posts:
            if 'likes_by' not in p:
                p['likes_by'] = ''

    # Aplica o toggle no post alvo
    for p in posts:
        if int(p['id']) == post_id:
            likes_by = [x for x in (p.get('likes_by') or '').split(';') if x]
            if me in likes_by:
                # Já curtiu → remover
                likes_by = [x for x in likes_by if x != me]
            else:
                # Ainda não curtiu → adicionar
                likes_by.append(me)
            p['likes_by'] = ';'.join(likes_by)
            # Mantém o contador coerente com o tamanho de likes_by
            p['likes'] = str(len(likes_by))
            break

    # Reescreve o CSV com a atualização
    with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(posts)

    return redirect(url_for('home_page'))

@app.get('/api/post_likes')
@login_required
def api_post_likes():
    # Retorna { post_id: {likes: int, likes_by: "1;2;..."} }
    ensure_posts_csv()
    result = {}
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for r in reader:
            pid = r.get('id')
            if not pid:
                continue
            likes_by = (r.get('likes_by') or '').strip()
            try:
                likes = int(r.get('likes') or 0)
            except:
                likes = 0
            result[pid] = {'likes': likes, 'likes_by': likes_by}
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)