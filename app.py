# app.py
"""
========================================
REDE SOCIAL - APLICAÇÃO FLASK
========================================
Sistema completo de rede social com:
- Autenticação de usuários
- Feed de posts com curtidas
- Chat DM entre amigos
- Notificações em tempo real
- Sistema de amizades
- Armazenamento em CSV
"""

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from functools import wraps
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import secrets
import csv
import os

# ========================================
# CONFIGURAÇÃO DE DIRETÓRIOS
# ========================================
BASE_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(BASE_DIR, 'src')
PAGES_DIR = os.path.join(SRC_DIR, 'pages')
DATA_DIR = os.path.join(SRC_DIR, 'data')
STATIC_DIR = os.path.join(SRC_DIR, 'static')

# Caminhos dos arquivos CSV
CSV_PATH = os.path.join(DATA_DIR, 'users.csv')
MESSAGES_PATH = os.path.join(DATA_DIR, 'messages.csv')
POSTS_PATH = os.path.join(DATA_DIR, 'posts.csv')
NOTIF_PATH = os.path.join(DATA_DIR, 'notifications.csv')
FRIENDS_PATH = os.path.join(DATA_DIR, 'friends.csv')

# ========================================
# CONFIGURAÇÃO DO FLASK
# ========================================
app = Flask(__name__, template_folder=PAGES_DIR, static_folder=STATIC_DIR)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

# ========================================
# INICIALIZAÇÃO DOS ARQUIVOS CSV
# ========================================

def ensure_csv():
    """Garante que o CSV de usuários existe"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CSV_PATH):
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'username', 'password', 'email'])

def ensure_messages_csv():
    """Garante que o CSV de mensagens existe"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(MESSAGES_PATH):
        with open(MESSAGES_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'sender_id', 'receiver_id', 'timestamp', 'content'])

def ensure_posts_csv():
    """Garante que o CSV de posts existe com suporte a curtidas"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(POSTS_PATH):
        with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'author_id', 'author_name', 'timestamp', 'content', 'likes', 'likes_by'])

def ensure_notifications_csv():
    """Garante que o CSV de notificações existe"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(NOTIF_PATH):
        with open(NOTIF_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['id', 'user_id', 'type', 'actor_id', 'message_id', 'timestamp', 'read', 'text'])

def ensure_friends_csv():
    """Garante que o CSV de amizades existe"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(FRIENDS_PATH):
        with open(FRIENDS_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['user1_id', 'user2_id', 'status', 'timestamp'])

# ========================================
# UTILITÁRIOS DE POSTS
# ========================================

def load_posts():
    """Carrega todos os posts do CSV"""
    ensure_posts_csv()
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        posts = list(reader)
        fieldnames = list(reader.fieldnames or ['id', 'author_id', 'author_name', 'timestamp', 'content', 'likes', 'likes_by'])
        
        # Garante que todos os posts têm todas as colunas
        for p in posts:
            for field in fieldnames:
                if field not in p:
                    p[field] = ''
        
        return posts, fieldnames

def save_posts(posts, fieldnames):
    """Salva a lista completa de posts de volta no CSV"""
    with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(posts)

# ========================================
# GERADORES DE ID
# ========================================

def next_id():
    """Retorna o próximo ID disponível para usuários"""
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(row['id']) for row in reader if row.get('id')]
        return (max(ids) + 1) if ids else 1

def next_message_id():
    """Retorna o próximo ID disponível para mensagens"""
    ensure_messages_csv()
    with open(MESSAGES_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(r['id']) for r in reader if r.get('id')]
        return (max(ids) + 1) if ids else 1

def next_post_id():
    """Retorna o próximo ID disponível para posts"""
    ensure_posts_csv()
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(r['id']) for r in reader if r.get('id')]
        return (max(ids) + 1) if ids else 1

def next_notif_id():
    """Retorna o próximo ID disponível para notificações"""
    ensure_notifications_csv()
    with open(NOTIF_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(x['id']) for x in reader if x.get('id')]
        return (max(ids) + 1) if ids else 1

# ========================================
# FUNÇÕES DE HORÁRIO
# ========================================

def to_sp_display(ts_str: str) -> str:
    """
    Converte timestamp UTC para horário de São Paulo
    Aceita formatos: ISO 8601, YYYY-MM-DD HH:MM:SS, DD/MM/YYYY HH:MM
    Retorna: DD/MM/YYYY HH:MM
    """
    try:
        if not ts_str:
            return ""
        
        sp_tz = ZoneInfo("America/Sao_Paulo")
        dt = None

        # Tenta ISO 8601
        if 'T' in ts_str:
            try:
                dt = datetime.fromisoformat(ts_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        # Tenta YYYY-MM-DD HH:MM:SS
        if dt is None:
            try:
                dt = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        # Tenta DD/MM/YYYY HH:MM
        if dt is None:
            try:
                dt = datetime.strptime(ts_str, "%d/%m/%Y %H:%M").replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        if dt is None:
            return ts_str

        return dt.astimezone(sp_tz).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return ts_str

def tz_sp():
    """Retorna timezone de São Paulo (fallback para UTC se não disponível)"""
    try:
        return ZoneInfo("America/Sao_Paulo")
    except Exception:
        return timezone.utc

# ========================================
# SISTEMA DE NOTIFICAÇÕES
# ========================================

def create_notification(user_id, type, actor_id=None, post_id=None, text=None):
    """
    Cria uma nova notificação para o usuário
    Tipos: 'like', 'friend_accepted', 'friend_request', 'dm'
    """
    ensure_notifications_csv()
    
    # Gera texto automático se não fornecido
    if not text:
        actor_name = ''
        if actor_id:
            u = get_user_by_id(actor_id)
            actor_name = u['username'] if u else f"user_{actor_id}"
        
        if type == 'like':
            text = f"{actor_name} curtiu seu post"
        elif type == 'friend_accepted':
            text = f"{actor_name} aceitou sua solicitação de amizade"
        elif type == 'friend_request':
            text = f"{actor_name} enviou uma solicitação de amizade"
        elif type == 'dm':
            text = f"Nova DM de: {actor_name}"
    
    # Salva no CSV
    with open(NOTIF_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([
            next_notif_id(),
            str(user_id),
            type,
            str(actor_id) if actor_id else '',
            str(post_id) if post_id else '',
            datetime.now(timezone.utc).isoformat(),
            '0',  # não lida
            text
        ])

# ========================================
# UTILITÁRIOS DE USUÁRIOS
# ========================================

def get_all_users():
    """Retorna todos os usuários cadastrados (sem senha)"""
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
    """Verifica se um usuário existe pelo ID"""
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get('id') == str(user_id):
                return True
    return False

def get_user_by_id(user_id):
    """Busca usuário por ID (sem senha)"""
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get('id') == str(user_id):
                return {
                    'id': r['id'],
                    'username': r['username'],
                    'email': r['email']
                }
    return None

# ========================================
# DECORATOR DE AUTENTICAÇÃO
# ========================================

def login_required(view_func):
    """Protege rotas que exigem login"""
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return view_func(*args, **kwargs)
    return wrapper

# ========================================
# SISTEMA DE AMIZADES
# ========================================

def get_friends(user_id):
    """Retorna lista de IDs dos amigos mútuos do usuário"""
    ensure_friends_csv()
    friends = []
    user_id_str = str(user_id)
    
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Status '1' = amizade aceita
            if row['status'] == '1':
                if row['user1_id'] == user_id_str and row['user2_id'] != user_id_str:
                    friends.append(row['user2_id'])
                elif row['user2_id'] == user_id_str and row['user1_id'] != user_id_str:
                    friends.append(row['user1_id'])
    
    return friends

def get_friend_requests(user_id):
    """Retorna solicitações de amizade pendentes recebidas pelo usuário"""
    ensure_friends_csv()
    requests = []
    user_id_str = str(user_id)
    
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Status '0' = pendente, user2 é quem recebe
            if row['user2_id'] == user_id_str and row['status'] == '0':
                u = get_user_by_id(row['user1_id'])
                requests.append({
                    'user_id': row['user1_id'],
                    'username': u['username'] if u else f"user_{row['user1_id']}",
                    'timestamp': row['timestamp']
                })
    
    return requests

def are_friends(user1_id, user2_id):
    """Verifica se dois usuários são amigos mútuos"""
    if str(user1_id) == str(user2_id):
        return True
    
    user1_friends = get_friends(user1_id)
    return str(user2_id) in user1_friends

def send_friend_request(sender_id, receiver_id):
    """Envia uma solicitação de amizade (cria pendência)"""
    ensure_friends_csv()
    s = str(sender_id)
    r = str(receiver_id)
    
    if s == r:
        return False
    
    # Verifica se já existe alguma relação
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if ((row['user1_id'] == s and row['user2_id'] == r) or
                (row['user1_id'] == r and row['user2_id'] == s)):
                return False
    
    # Cria nova solicitação pendente
    with open(FRIENDS_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([
            s, r, '0', datetime.now().strftime('%d/%m/%Y %H:%M')
        ])
    
    return True

def check_pending_request(user1_id, user2_id):
    """Verifica se existe solicitação pendente entre dois usuários"""
    ensure_friends_csv()
    a = str(user1_id)
    b = str(user2_id)
    
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['status'] == '0':
                if ((row['user1_id'] == a and row['user2_id'] == b) or
                    (row['user1_id'] == b and row['user2_id'] == a)):
                    return True
    
    return False

def update_friend_request_status(requester_id: str, target_id: str, new_status: str) -> bool:
    """
    Atualiza o status de uma solicitação de amizade
    new_status: '1' (aceita) ou '2' (rejeitada)
    Retorna True se atualizou alguma linha
    """
    ensure_friends_csv()
    requester_id = str(requester_id)
    target_id = str(target_id)
    updated = False
    rows = []
    fieldnames = ['user1_id', 'user2_id', 'status', 'timestamp']

    # Lê todas as linhas
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        if reader.fieldnames:
            fieldnames = reader.fieldnames
        
        for row in reader:
            # Atualiza se encontrar a solicitação pendente
            if (row.get('user1_id') == requester_id and
                row.get('user2_id') == target_id and
                row.get('status') == '0'):
                row['status'] = str(new_status)
                updated = True
            rows.append(row)

    # Reescreve o arquivo se houve mudança
    if updated:
        with open(FRIENDS_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    return updated

def delete_pending_friend_request(requester_id: str, target_id: str) -> bool:
    """
    Remove uma solicitação pendente do CSV
    Usado para rejeitar solicitações
    """
    ensure_friends_csv()
    requester_id = str(requester_id)
    target_id = str(target_id)

    # Lê todas as linhas
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
        fieldnames = rows[0].keys() if rows else ['user1_id', 'user2_id', 'status', 'timestamp']

    before = len(rows)
    
    # Filtra removendo a solicitação pendente
    rows = [
        r for r in rows
        if not (r.get('user1_id') == requester_id and 
                r.get('user2_id') == target_id and 
                r.get('status') == '0')
    ]
    
    removed_any = len(rows) < before

    # Reescreve se removeu algo
    if removed_any:
        with open(FRIENDS_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    return removed_any

def remove_friend_request_notifications(target_user_id: str, requester_id: str) -> int:
    """
    Remove notificações de solicitação de amizade após aceitar/rejeitar
    Retorna quantas foram removidas
    """
    ensure_notifications_csv()
    target_user_id = str(target_user_id)
    requester_id = str(requester_id)

    # Lê todas as notificações
    with open(NOTIF_PATH, 'r', newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
        fieldnames = rows[0].keys() if rows else [
            'id', 'user_id', 'type', 'actor_id', 'message_id', 'timestamp', 'read', 'text'
        ]

    before = len(rows)
    
    # Remove notificações de friend_request relacionadas
    rows = [
        r for r in rows
        if not (r.get('user_id') == target_user_id and
                r.get('type') == 'friend_request' and
                r.get('actor_id') == requester_id)
    ]
    
    removed = before - len(rows)

    # Reescreve o arquivo
    with open(NOTIF_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return removed

# ========================================
# ROTAS - PÁGINAS PÚBLICAS
# ========================================

@app.route('/')
def index():
    """Página inicial / Login"""
    return render_template('index.html')

@app.get('/register')
def register_page():
    """Página de cadastro"""
    return render_template('createaccount.html')

@app.get('/recover')
def recover_page():
    """Página de recuperação de senha"""
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

    # Adiciona novo usuário
    with open(CSV_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([next_id(), username, password, email])

    return redirect(url_for('index'))

@app.post('/login')
def login():
    """Faz login com username ou email"""
    ensure_csv()
    login_input = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()

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
                # Login bem-sucedido
                session['user_id'] = row.get('id')
                session['username'] = row_user
                session['email'] = row_email
                return redirect(url_for('home_page'))

    # Credenciais inválidas
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
    """Feed principal com posts do usuário e amigos"""
    ensure_posts_csv()
    me = str(session.get('user_id'))

    # Carrega todos os posts
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        all_posts = list(csv.DictReader(f))

    # Pega lista de amigos
    my_friends = set(get_friends(me))

    # Filtra posts: meus ou de amigos
    visible_posts = []
    for p in all_posts:
        author_id = p.get('author_id')
        if not author_id:
            continue
        
        if author_id == me or author_id in my_friends:
            p['timestamp_display'] = to_sp_display(p.get('timestamp', ''))
            visible_posts.append(p)

    # Ordena do mais recente para o mais antigo
    visible_posts.sort(key=lambda x: int(x['id']), reverse=True)

    # Pega solicitações pendentes
    pending_requests = get_friend_requests(me)

    return render_template(
        'feed.html',
        posts=visible_posts,
        username=session.get('username'),
        user_id=me,
        friend_requests=pending_requests
    )

@app.get('/perfil')
@login_required
def meu_perfil():
    """Redireciona para o próprio perfil"""
    return redirect(url_for('perfil', user_id=session.get('user_id')))

@app.get('/perfil/<user_id>')
@login_required
def perfil(user_id):
    """Página de perfil de um usuário"""
    profile_user = get_user_by_id(user_id)
    if not profile_user:
        return redirect(url_for('home_page'))

    # Carrega posts do usuário
    ensure_posts_csv()
    user_posts = []
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('author_id') == str(user_id):
                user_posts.append(row)

    # Ordena e pega os 3 mais recentes
    user_posts.sort(key=lambda x: int(x['id']), reverse=True)
    recent_posts = user_posts[:3]
    
    for p in recent_posts:
        p['timestamp_display'] = to_sp_display(p.get('timestamp', ''))

    # Verifica relação com o usuário atual
    current_user_id = str(session.get('user_id'))
    is_my_profile = (current_user_id == str(user_id))
    are_we_friends = are_friends(current_user_id, user_id)
    has_pending_request = check_pending_request(current_user_id, user_id)

    return render_template(
        'feed.html',
        profile_user=profile_user,
        recent_posts=recent_posts,
        username=session.get('username'),
        user_id=current_user_id,
        is_my_profile=is_my_profile,
        are_we_friends=are_we_friends,
        has_pending_request=has_pending_request,
        friend_requests=get_friend_requests(current_user_id)
    )

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
            datetime.now(timezone.utc).isoformat(),
            content,
            0,   # likes
            ''   # likes_by
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

    # Garante que a coluna likes_by existe
    if 'likes_by' not in fieldnames:
        fieldnames.append('likes_by')
        for p in posts:
            if 'likes_by' not in p:
                p['likes_by'] = ''

    post_author_id = None
    was_liked = False

    # Processa o toggle de curtida
    for p in posts:
        if int(p['id']) == post_id:
            post_author_id = p.get('author_id')
            likes_by = [x for x in (p.get('likes_by') or '').split(';') if x]
            
            if me in likes_by:
                # Remove curtida
                likes_by = [x for x in likes_by if x != me]
                was_liked = False
            else:
                # Adiciona curtida
                likes_by.append(me)
                was_liked = True
            
            p['likes_by'] = ';'.join(likes_by)
            p['likes'] = str(len(likes_by))
            break

    # Reescreve o arquivo
    with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(posts)

    # Cria notificação se curtiu post de outro usuário
    if was_liked and post_author_id and post_author_id != me:
        create_notification(
            user_id=post_author_id,
            type='like',
            actor_id=me,
            post_id=post_id
        )

    return redirect(request.referrer or url_for('home_page'))

# ========================================
# ROTAS - AMIZADES
# ========================================

@app.post('/add_friend/<user_id>')
@login_required
def add_friend(user_id):
    """Envia solicitação de amizade"""
    sender_id = str(session.get('user_id'))
    
    if send_friend_request(sender_id, user_id):
        create_notification(
            user_id=user_id,
            type='friend_request',
            actor_id=sender_id,
            text=f"{session.get('username')} enviou uma solicitação de amizade"
        )
    
    return redirect(request.referrer or url_for('home_page'))

@app.post('/accept_friend/<user_id>')
@login_required
def accept_friend(user_id):
    """Aceita solicitação de amizade (rota legada, use a API)"""
    receiver_id = str(session.get('user_id'))
    update_friend_request_status(user_id, receiver_id, '1')
    
    # Remove notificação de solicitação
    remove_friend_request_notifications(receiver_id, user_id)
    
    # Cria notificação de aceite
    create_notification(
        user_id=user_id,
        type='friend_accepted',
        actor_id=receiver_id,
        text=f"{session.get('username')} aceitou sua solicitação de amizade!"
    )
    
    return redirect(request.referrer or url_for('home_page'))

# ========================================
# API - USUÁRIOS
# ========================================

@app.get('/api/friends')
@login_required
def api_users():
    """Lista apenas amigos mútuos (para o chat)"""
    uid = str(session.get('user_id'))
    all_users = get_all_users()
    friends = get_friends(uid)
    
    # Filtra apenas amigos
    users = [u for u in all_users if u['id'] != uid and u['id'] in friends]
    
    return jsonify({'users': users})

@app.get('/api/users')
@login_required
def api_all_users():
    """Lista todos os usuários (para busca)"""
    uid = str(session.get('user_id'))
    users = [u for u in get_all_users() if u['id'] != uid]
    
    return jsonify({'users': users})

# ========================================
# API - MENSAGENS (CHAT DM)
# ========================================

@app.get('/api/messages')
@login_required
def api_messages():
    """Busca mensagens entre mim e outro usuário (apenas amigos)"""
    partner_id = request.args.get('partner_id', type=str)
    since_id = request.args.get('since_id', default=0, type=int)
    me = str(session.get('user_id'))

    # Valida se são amigos
    if not partner_id or not user_exists(partner_id) or not are_friends(me, partner_id):
        return jsonify({'error': 'partner_id inválido ou não são amigos'}), 400

    ensure_messages_csv()
    items = []
    
    # Lê mensagens entre os dois usuários
    with open(MESSAGES_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if not r.get('id'):
                continue
            
            try:
                mid = int(r['id'])
            except:
                continue
            
            # Pula mensagens antigas (polling incremental)
            if mid <= since_id:
                continue
            
            s = r['sender_id']
            t = r['receiver_id']
            
            # Filtra conversas entre me e partner
            if (s == me and t == partner_id) or (s == partner_id and t == me):
                items.append({
                    'id': mid,
                    'sender_id': s,
                    'receiver_id': t,
                    'timestamp_display': to_sp_display(r.get('timestamp', '')),
                    'content': r['content'],
                })
    
    # Ordena por ID
    items.sort(key=lambda x: x['id'])
    
    return jsonify({'messages': items})

@app.post('/api/send')
@login_required
def api_send():
    """Envia uma mensagem para outro usuário (apenas amigos)"""
    data = request.get_json(silent=True) or {}
    partner_id = str(data.get('partner_id', '')).strip()
    content = str(data.get('content', '')).strip()
    me = str(session.get('user_id'))

    # Valida se são amigos
    if not partner_id or not user_exists(partner_id) or not are_friends(me, partner_id):
        return jsonify({'error': 'partner_id inválido ou não são amigos'}), 400
    
    if not content:
        return jsonify({'error': 'Mensagem vazia'}), 400

    # Salva mensagem
    ensure_messages_csv()
    mid = next_message_id()
    now = datetime.now(timezone.utc).isoformat()
    
    with open(MESSAGES_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([mid, me, partner_id, now, content])

    # Cria notificação para o destinatário
    sender_name = session.get('username') or f'user_{me}'
    create_notification(
        user_id=partner_id,
        type='dm',
        actor_id=me,
        post_id=mid,
        text=f'Nova DM de: {sender_name}'
    )
    
    return jsonify({'ok': True, 'id': mid, 'timestamp': now})

# ========================================
# API - POSTS
# ========================================

@app.delete('/api/delete_post/<int:post_id>')
@login_required
def api_delete_post(post_id):
    """Exclui um post pelo ID (apenas se for do autor)"""
    me = str(session.get('user_id'))
    
    # Carrega posts
    posts, fieldnames = load_posts()
    
    initial_count = len(posts)
    
    # Filtra posts, mantendo apenas os que NÃO são o post_id OU que não pertencem ao usuário atual
    posts = [
        p for p in posts
        if not (p.get('id') == str(post_id) and p.get('author_id') == me)
    ]
    
    # Verifica se houve exclusão
    if len(posts) < initial_count:
        save_posts(posts, fieldnames)
        return jsonify({'success': True, 'message': 'Post excluído com sucesso'}), 200
    
    # Se chegou aqui, ou o post não existe, ou não pertence ao usuário
    return jsonify({'success': False, 'message': 'Post não encontrado ou você não tem permissão para excluí-lo'}), 403

@app.put('/api/modify_post/<int:post_id>')
@login_required
def api_modify_post(post_id):
    """Modifica o conteúdo de um post pelo ID (apenas se for do autor)"""
    me = str(session.get('user_id'))
    data = request.get_json(silent=True) or {}
    new_content = str(data.get('content', '')).strip()
    
    if not new_content:
        return jsonify({'success': False, 'message': 'Conteúdo do post não pode ser vazio'}), 400
    
    # Carrega posts
    posts, fieldnames = load_posts()
    updated = False
    
    # Busca e atualiza o post
    for p in posts:
        if p.get('id') == str(post_id) and p.get('author_id') == me:
            p['content'] = new_content
            # Atualiza o timestamp para refletir a modificação
            p['timestamp'] = datetime.now(timezone.utc).isoformat()
            updated = True
            break
            
    if updated:
        save_posts(posts, fieldnames)
        return jsonify({'success': True, 'message': 'Post modificado com sucesso', 'new_content': new_content}), 200
    
    # Se chegou aqui, ou o post não existe, ou não pertence ao usuário
    return jsonify({'success': False, 'message': 'Post não encontrado ou você não tem permissão para modificá-lo'}), 403

# ========================================
# API - CURTIDAS
# ========================================

@app.get('/api/post_likes')
@login_required
def api_post_likes():
    """Retorna estado de curtidas de todos os posts (para sincronização)"""
    posts, _ = load_posts()
    result = {}
    
    for r in posts:
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

@app.post('/api/toggle_like/<int:post_id>')
@login_required
def api_toggle_like(post_id):
    """Toggle de curtida via API (para React)"""
    ensure_posts_csv()
    me = str(session.get('user_id'))

    # Carrega posts
    posts, fieldnames = load_posts()

    post_author_id = None
    liked_now = False
    new_likes_count = 0

    # Processa toggle
    for p in posts:
        try:
            if int(p['id']) == post_id:
                post_author_id = p.get('author_id')
                likes_by = [x for x in (p.get('likes_by') or '').split(';') if x]
                
                if me in likes_by:
                    likes_by = [x for x in likes_by if x != me]
                    liked_now = False
                else:
                    likes_by.append(me)
                    liked_now = True
                
                p['likes_by'] = ';'.join(likes_by)
                p['likes'] = str(len(likes_by))
                new_likes_count = len(likes_by)
                break
        except ValueError:
            continue

    # Salva posts
    save_posts(posts, fieldnames)

    # Cria notificação se curtiu
    if liked_now and post_author_id and post_author_id != me:
        create_notification(
            user_id=post_author_id,
            type='like',
            actor_id=me,
            post_id=post_id
        )

    return jsonify({
        'success': True,
        'likes': new_likes_count,
        'liked': liked_now,
    })

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
    
    # Lê notificações do usuário
    with open(NOTIF_PATH, 'r', newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r.get('user_id') != me:
                continue

            # Converte timestamp para horário de SP
            ts_iso = r.get('timestamp', '')
            ts_disp = to_sp_display(ts_iso)

            # Monta texto com horário
            base_text = r.get('text') or 'Nova notificação'
            
            if ts_disp and f"({ts_disp})" not in base_text:
                composed_text = f"{base_text} ({ts_disp})"
            else:
                composed_text = base_text

            # Monta item
            item = dict(r)
            item['timestamp_display'] = ts_disp
            item['text'] = composed_text
            item.pop('timestamp', None)

            items.append(item)

    # Ordena por ID decrescente
    def sort_key(x):
        try:
            return int(x.get('id') or 0)
        except:
            return 0

    items.sort(key=sort_key, reverse=True)
    
    # Conta não lidas
    unread = sum(1 for x in items if (x.get('read') or '0') == '0')
    
    return jsonify({'unread': unread, 'items': items[:50]})

@app.post('/api/notifications/mark_all_read')
@login_required
def api_notifications_mark_all_read():
    """Marca todas as notificações como lidas e remove do CSV"""
    ensure_notifications_csv()
    me = str(session.get('user_id'))

    # Lê todas as notificações
    with open(NOTIF_PATH, 'r', newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
        fieldnames = rows[0].keys() if rows else [
            'id', 'user_id', 'type', 'actor_id', 'message_id', 'timestamp', 'read', 'text'
        ]

    # Marca minhas notificações como lidas
    for r in rows:
        if r.get('user_id') == me:
            r['read'] = '1'

    # Remove as que ficaram lidas (minhas)
    rows = [r for r in rows if not (r.get('user_id') == me and (r.get('read') or '0') == '1')]

    # Reescreve o CSV
    with open(NOTIF_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return jsonify({'ok': True})

# ========================================
# API - SOLICITAÇÕES DE AMIZADE
# ========================================

@app.post('/api/friend_request/accept')
@login_required
def api_friend_request_accept():
    """Aceita uma solicitação de amizade"""
    me = str(session.get('user_id'))
    data = request.get_json(silent=True) or {}
    requester_id = str(data.get('requester_id') or '').strip()
    
    if not requester_id:
        return jsonify({'ok': False, 'error': 'requester_id ausente'}), 400

    # Atualiza status para aceito
    ok = update_friend_request_status(requester_id, me, '1')
    
    if not ok:
        return jsonify({'ok': False, 'error': 'Solicitação não encontrada ou já processada'}), 400

    # Remove notificação de solicitação
    remove_friend_request_notifications(target_user_id=me, requester_id=requester_id)

    # Cria notificação de aceite
    create_notification(
        user_id=requester_id,
        type='friend_accepted',
        actor_id=me,
        text=f"{get_user_by_id(me)['username']} aceitou sua solicitação de amizade!"
    )
    
    return jsonify({'ok': True})

@app.post('/api/friend_request/reject')
@login_required
def api_friend_request_reject():
    """Rejeita uma solicitação de amizade"""
    me = str(session.get('user_id'))
    data = request.get_json(silent=True) or {}
    requester_id = str(data.get('requester_id') or '').strip()
    
    if not requester_id:
        return jsonify({'ok': False, 'error': 'requester_id ausente'}), 400

    # Remove a solicitação pendente
    removed = delete_pending_friend_request(requester_id, me)
    
    if not removed:
        return jsonify({'ok': False, 'error': 'Solicitação não encontrada ou já processada'}), 400

    # Remove notificações relacionadas
    remove_friend_request_notifications(target_user_id=me, requester_id=requester_id)

    return jsonify({'ok': True})

# ========================================
# INICIALIZAÇÃO
# ========================================

if __name__ == '__main__':
    # Garante que todos os CSVs existem
    ensure_csv()
    ensure_messages_csv()
    ensure_posts_csv()
    ensure_notifications_csv()
    ensure_friends_csv()
    
    # Inicia servidor
    app.run(host="127.0.0.1", port=5001, debug=True)