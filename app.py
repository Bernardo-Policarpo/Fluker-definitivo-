"""
========================================
SOCIAL MEDIA PLATFORM - FLASK APP
========================================
Sistema de rede social com:
- Autenticação de usuários
- Feed de posts com sistema de curtidas
- Chat DM (mensagens diretas)
- Notificações em tempo real
- Armazenamento em CSV
"""

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from functools import wraps
from datetime import datetime
import secrets
import csv
import os

# ========================================
# CONFIGURAÇÃO DE DIRETÓRIOS
# ========================================
BASE_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(BASE_DIR, 'src')
PAGES_DIR = os.path.join(SRC_DIR, 'pages')      # Templates HTML
DATA_DIR = os.path.join(SRC_DIR, 'data')        # Arquivos CSV
STATIC_DIR = os.path.join(SRC_DIR, 'static')    # CSS/JS/Imagens

# Paths dos arquivos CSV
CSV_PATH = os.path.join(DATA_DIR, 'users.csv')
MESSAGES_PATH = os.path.join(DATA_DIR, 'messages.csv')
POSTS_PATH = os.path.join(DATA_DIR, 'posts.csv')
NOTIF_PATH = os.path.join(DATA_DIR, 'notifications.csv')

# ========================================
# CONFIGURAÇÃO DO FLASK
# ========================================
app = Flask(__name__, template_folder=PAGES_DIR, static_folder=STATIC_DIR)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

# ========================================
# INICIALIZAÇÃO DOS ARQUIVOS CSV
# ========================================
def ensure_csv():
    """Cria o CSV de usuários se não existir"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CSV_PATH):
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'username', 'password', 'email'])

def ensure_messages_csv():
    """Cria o CSV de mensagens se não existir"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(MESSAGES_PATH):
        with open(MESSAGES_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'sender_id', 'receiver_id', 'timestamp', 'content'])

def ensure_posts_csv():
    """Cria o CSV de posts se não existir (com suporte a curtidas)"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(POSTS_PATH):
        with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'author_id', 'author_name', 'timestamp', 'content', 'likes', 'likes_by'])

def ensure_notifications_csv():
    """Cria o CSV de notificações se não existir"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(NOTIF_PATH):
        with open(NOTIF_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'user_id', 'type', 'actor_id', 'message_id', 'timestamp', 'read', 'text'])

# ========================================
# GERADORES DE ID
# ========================================
def next_id():
    """Pega o maior ID de usuário e retorna o próximo"""
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(row['id']) for row in reader if row.get('id')]
        return (max(ids) + 1) if ids else 1

def next_message_id():
    """Pega o maior ID de mensagem e retorna o próximo"""
    ensure_messages_csv()
    with open(MESSAGES_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(r['id']) for r in reader if r.get('id')]
        return (max(ids) + 1) if ids else 1

def next_post_id():
    """Pega o maior ID de post e retorna o próximo"""
    ensure_posts_csv()
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(r['id']) for r in reader if r.get('id')]
        return (max(ids) + 1) if ids else 1

def next_notif_id():
    """Pega o maior ID de notificação e retorna o próximo"""
    ensure_notifications_csv()
    with open(NOTIF_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(x['id']) for x in reader if x.get('id')]
        return (max(ids) + 1) if ids else 1

# ========================================
# UTILITÁRIOS DE USUÁRIOS
# ========================================
def get_all_users():
    """Busca todos os usuários cadastrados (sem senha)"""
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

def user_exists(user_id):
    """Checa se um user_id existe no sistema"""
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get('id') == str(user_id):
                return True
    return False

# ========================================
# DECORATOR DE AUTENTICAÇÃO
# ========================================
def login_required(view_func):
    """Protege rotas que precisam de login ativo"""
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return view_func(*args, **kwargs)
    return wrapper

# ========================================
# ROTAS - PÁGINAS PÚBLICAS
# ========================================
@app.route('/')
def index():
    """Tela inicial / Login"""
    return render_template('index.html')

@app.get('/register')
def register_page():
    """Tela de cadastro"""
    return render_template('createaccount.html')

@app.get('/recover')
def recover_page():
    """Tela de recuperação de senha"""
    return render_template('recoverpassword.html')

# ========================================
# ROTAS - AUTENTICAÇÃO
# ========================================
@app.route('/salvar', methods=['POST'])
def salvar():
    """Cria uma nova conta de usuário"""
    ensure_csv()
    username = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()
    email = request.form.get('email', '').strip()

    # Adiciona novo usuário no CSV
    with open(CSV_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([next_id(), username, password, email])

    return redirect(url_for('index'))

@app.post('/login')
def login():
    """Faz login com username ou email"""
    ensure_csv()
    login_input = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()

    # Validação básica
    if not login_input or not password:
        return redirect(url_for('index'))

    # Procura credenciais no CSV
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_user = (row.get('username') or '').strip()
            row_email = (row.get('email') or '').strip()
            row_pass = (row.get('password') or '').strip()

            credencial_ok = (login_input == row_user) or (login_input == row_email)
            senha_ok = (password == row_pass)

            if credencial_ok and senha_ok:
                # Login OK: cria sessão
                session['user_id'] = row.get('id')
                session['username'] = row_user
                session['email'] = row_email
                return redirect(url_for('home_page'))

    # Credenciais erradas
    return redirect(url_for('index', erro=1))

@app.get('/logout')
def logout():
    """Desloga o usuário"""
    session.clear()
    return redirect(url_for('index'))

# ========================================
# ROTAS - PÁGINAS PROTEGIDAS
# ========================================
@app.get('/home')
@login_required
def home_page():
    """Feed principal com todos os posts"""
    ensure_posts_csv()

    # Carrega posts do CSV
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        posts = list(csv.DictReader(f))

    # Função para converter timestamp UTC para horário de São Paulo
    def to_sp_display(ts_str: str) -> str:
        try:
            # Se for ISO (com "T")
            if 'T' in ts_str:
                dt = datetime.fromisoformat(ts_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
            else:
                # Formato antigo "YYYY-MM-DD HH:MM:SS" sem tz => considere UTC
                dt = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)

            # Converte para fuso de São Paulo
            dt_sp = dt.astimezone(ZoneInfo("America/Sao_Paulo"))
            return dt_sp.strftime("%d/%m/%Y %H:%M")
        except Exception:
            return ts_str

    # Adiciona timestamp formatado em cada post
    for p in posts:
        p['timestamp_display'] = to_sp_display(p.get('timestamp', ''))

    # Ordena do mais recente pro mais antigo
    posts.sort(key=lambda x: int(x['id']), reverse=True)

    return render_template(
        'feed.html',
        posts=posts,
        username=session.get('username'),
        user_id=str(session.get('user_id'))
    )

@app.get('/inbox')
@login_required
def inbox():
    """Inbox (por enquanto só redireciona pro feed)"""
    return redirect(url_for('home_page'))

# ========================================
# ROTAS - POSTS
# ========================================
@app.post('/postar')
@login_required
def postar():
    """Cria um novo post no feed"""
    ensure_posts_csv()
    content = request.form.get('content', '').strip()
    
    if not content:
        return redirect(url_for('home_page'))

    # Salva post com curtidas zeradas
    with open(POSTS_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([
            next_post_id(),
            session['user_id'],
            session['username'],
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            content,
            0,   # likes
            ''   # likes_by (IDs separados por ';')
        ])
    
    return redirect(url_for('home_page'))

@app.post('/curtir/<int:post_id>')
@login_required
def curtir(post_id):
    """Curte ou descurte um post (toggle)"""
    ensure_posts_csv()
    me = str(session.get('user_id'))

    # Lê todos os posts
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        posts = list(reader)
        fieldnames = list(reader.fieldnames or [])

    # Garante que o campo likes_by existe (compatibilidade com CSVs antigos)
    if 'likes_by' not in fieldnames:
        fieldnames.append('likes_by')
        for p in posts:
            if 'likes_by' not in p:
                p['likes_by'] = ''

    # Aplica o toggle no post certo
    for p in posts:
        if int(p['id']) == post_id:
            likes_by = [x for x in (p.get('likes_by') or '').split(';') if x]
            
            if me in likes_by:
                # Já curti, então descurto
                likes_by = [x for x in likes_by if x != me]
            else:
                # Ainda não curti, então curto
                likes_by.append(me)
            
            p['likes_by'] = ';'.join(likes_by)
            p['likes'] = str(len(likes_by))
            break

    # Reescreve o CSV com a atualização
    with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(posts)

    return redirect(url_for('home_page'))

# ========================================
# API - USUÁRIOS
# ========================================
@app.get('/api/users')
@login_required
def api_users():
    """Lista usuários disponíveis pro chat (menos eu mesmo)"""
    uid = str(session.get('user_id'))
    users = [u for u in get_all_users() if u['id'] != uid]
    return jsonify({'users': users})

# ========================================
# API - MENSAGENS (CHAT DM)
# ========================================
@app.get('/api/messages')
@login_required
def api_messages():
    """Busca mensagens entre mim e outro usuário (com suporte a polling incremental)"""
    partner_id = request.args.get('partner_id', type=str)
    since_id = request.args.get('since_id', default=0, type=int)
    me = str(session.get('user_id'))

    # Validação
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
            
            # Só pega mensagens novas (id > since_id)
            if mid <= since_id:
                continue
            
            s = r['sender_id']
            t = r['receiver_id']
            
            # Filtra mensagens entre mim e o parceiro
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

@app.post('/api/send')
@login_required
def api_send():
    """Envia uma mensagem pra outro usuário"""
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
    now = datetime.utcnow().isoformat() + 'Z'

    # Salva mensagem no CSV
    with open(MESSAGES_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([mid, me, partner_id, now, content])

    # Cria notificação pro destinatário
    ensure_notifications_csv()
    sender_name = session.get('username') or f'user_{me}'
    notif_text = f'Nova DM de: {sender_name}'
    
    with open(NOTIF_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([
            next_notif_id(),
            partner_id,
            'dm',
            me,
            mid,
            now,
            '0',
            notif_text
        ])

    return jsonify({'ok': True, 'id': mid, 'timestamp': now})

# ========================================
# API - CURTIDAS
# ========================================
@app.get('/api/post_likes')
@login_required
def api_post_likes():
    """Retorna o estado de curtidas de todos os posts (pra sincronizar no front)"""
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

# ========================================
# API - NOTIFICAÇÕES
# ========================================
@app.get('/api/notifications')
@login_required
def api_notifications():
    """Lista notificações do usuário atual"""
    ensure_notifications_csv()
    me = str(session.get('user_id'))
    items = []
    
    with open(NOTIF_PATH, 'r', newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r.get('user_id') == me and r.get('type') == 'dm':
                items.append(r)
    
    # Ordena do mais recente pro mais antigo
    def sort_key(x):
        try:
            return int(x.get('id') or 0)
        except:
            return 0
    
    items.sort(key=sort_key, reverse=True)
    unread = sum(1 for x in items if (x.get('read') or '0') == '0')
    
    return jsonify({'unread': unread, 'items': items[:50]})

@app.post('/api/notifications/mark_all_read')
@login_required
def api_notifications_mark_all_read():
    """Marca todas as notificações do usuário como lidas"""
    ensure_notifications_csv()
    me = str(session.get('user_id'))
    
    # Lê todas as notificações
    with open(NOTIF_PATH, 'r', newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
        fields = rows[0].keys() if rows else [
            'id', 'user_id', 'type', 'actor_id', 'message_id', 'timestamp', 'read', 'text'
        ]
    
    # Marca como lidas as minhas notificações
    for r in rows:
        if r['user_id'] == me and r.get('type') == 'dm':
            r['read'] = '1'
    
    # Reescreve o CSV
    with open(NOTIF_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    
    return jsonify({'ok': True})

# ========================================
# INICIALIZAÇÃO
# ========================================
if __name__ == '__main__':
    app.run(debug=True)