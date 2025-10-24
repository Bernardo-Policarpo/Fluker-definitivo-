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

def ensure_friends_csv():
    """Cria o CSV de amizades se não existir"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(FRIENDS_PATH):
        with open(FRIENDS_PATH, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(['user1_id', 'user2_id', 'status', 'timestamp'])

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

def get_user_by_id(user_id):
    """Busca usuário por ID"""
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
# FUNÇÕES AUXILIARES
# ========================================
def format_timestamp(ts_str):
    """Formata timestamp para exibição amigável"""
    try:
        if 'T' in ts_str:
            dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        else:
            dt = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d/%m/%Y %H:%M")
    except:
        return ts_str

# ========================================
# SISTEMA DE AMIZADES
# ========================================
def get_friends(user_id):
    """Retorna lista de amigos mútuos do usuário"""
    ensure_friends_csv()
    friends = []
    user_id_str = str(user_id)
    
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row['user1_id'] == user_id_str and row['user2_id'] != user_id_str and row['status'] == 'accepted'):
                friends.append(row['user2_id'])
            elif (row['user2_id'] == user_id_str and row['user1_id'] != user_id_str and row['status'] == 'accepted'):
                friends.append(row['user1_id'])
    
    return friends

def get_friend_requests(user_id):
    """Retorna solicitações de amizade pendentes para o usuário"""
    ensure_friends_csv()
    requests = []
    user_id_str = str(user_id)
    
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row['user2_id'] == user_id_str and row['status'] == 'pending'):
                requests.append({
                    'user_id': row['user1_id'],
                    'username': get_user_by_id(row['user1_id'])['username'],
                    'timestamp': row['timestamp']
                })
    
    return requests

def are_friends(user1_id, user2_id):
    """Verifica se dois usuários são amigos mútuos"""
    if user1_id == user2_id:
        return True
    
    user1_friends = get_friends(user1_id)
    return str(user2_id) in user1_friends

def send_friend_request(sender_id, receiver_id):
    """Envia uma solicitação de amizade"""
    ensure_friends_csv()
    
    # Verifica se já existe uma solicitação ou amizade
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if ((row['user1_id'] == str(sender_id) and row['user2_id'] == str(receiver_id)) or
                (row['user1_id'] == str(receiver_id) and row['user2_id'] == str(sender_id))):
                return False  # Já existe uma solicitação/amizade
    
    # Adiciona nova solicitação
    with open(FRIENDS_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([
            str(sender_id),
            str(receiver_id),
            'pending',
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    return True

def accept_friend_request(user1_id, user2_id):
    """Aceita uma solicitação de amizade"""
    ensure_friends_csv()
    rows = []
    updated = False
    
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            if (row['user1_id'] == str(user2_id) and row['user2_id'] == str(user1_id) and row['status'] == 'pending'):
                row['status'] = 'accepted'
                updated = True
            rows.append(row)
    
    if updated:
        with open(FRIENDS_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        # Cria notificação para quem enviou a solicitação
        create_notification(
            user_id=user2_id,
            type='friend_accepted',
            actor_id=user1_id,
            text=f"{get_user_by_id(user1_id)['username']} aceitou sua solicitação de amizade!"
        )
        
        return True
    
    return False

def check_pending_request(user1_id, user2_id):
    """Verifica se existe solicitação pendente entre dois usuários"""
    ensure_friends_csv()
    with open(FRIENDS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if ((row['user1_id'] == str(user1_id) and row['user2_id'] == str(user2_id) and row['status'] == 'pending') or
                (row['user1_id'] == str(user2_id) and row['user2_id'] == str(user1_id) and row['status'] == 'pending')):
                return True
    return False

# ========================================
# SISTEMA DE NOTIFICAÇÕES
# ========================================
def create_notification(user_id, type, actor_id=None, post_id=None, text=None):
    """Cria uma nova notificação"""
    ensure_notifications_csv()
    
    if not text:
        actor_name = get_user_by_id(actor_id)['username'] if actor_id else ''
        if type == 'like':
            text = f"{actor_name} curtiu seu post"
        elif type == 'friend_accepted':
            text = f"{actor_name} aceitou sua solicitação de amizade"
        elif type == 'friend_request':
            text = f"{actor_name} enviou uma solicitação de amizade"
    
    with open(NOTIF_PATH, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([
            next_notif_id(),
            str(user_id),
            type,
            str(actor_id) if actor_id else '',
            str(post_id) if post_id else '',
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '0',  # não lida
            text
        ])

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
    """Feed principal com posts de amigos mútuos"""
    ensure_posts_csv()
    user_id = str(session.get('user_id'))
    
    # Busca amigos mútuos
    friends = get_friends(user_id)
    friends.append(user_id)  # Inclui os próprios posts
    
    # Carrega posts do CSV
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        all_posts = list(csv.DictReader(f))
    
    # Filtra posts apenas de amigos mútuos
    posts = [p for p in all_posts if p['author_id'] in friends]

    # Adiciona timestamp formatado em cada post
    for p in posts:
        p['timestamp_display'] = format_timestamp(p.get('timestamp', ''))

    # Ordena do mais recente pro mais antigo
    posts.sort(key=lambda x: int(x['id']), reverse=True)

    return render_template(
        'feed.html',
        posts=posts,
        username=session.get('username'),
        user_id=str(session.get('user_id')),
        friend_requests=get_friend_requests(user_id)
    )

@app.get('/perfil')
@login_required
def meu_perfil():
    """Redireciona para o próprio perfil"""
    return redirect(url_for('perfil', user_id=session.get('user_id')))

@app.get('/perfil/<user_id>')
@login_required
def perfil(user_id):
    """Página de perfil do usuário"""
    profile_user = get_user_by_id(user_id)
    if not profile_user:
        return redirect(url_for('home_page'))
    
    # Busca os 3 posts mais recentes do usuário
    ensure_posts_csv()
    user_posts = []
    
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['author_id'] == str(user_id):
                user_posts.append(row)
    
    # Ordena e pega os 3 mais recentes
    user_posts.sort(key=lambda x: int(x['id']), reverse=True)
    recent_posts = user_posts[:3]
    
    # Formata timestamps
    for p in recent_posts:
        p['timestamp_display'] = format_timestamp(p.get('timestamp', ''))
    
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
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            content,
            0,   # likes
            ''   # likes_by (IDs separados por ';')
        ])
    
    return redirect(url_for('home_page'))

@app.post('/curtir/<int:post_id>')
@login_required
def curtir(post_id):
    """Curte ou descurte um post (toggle) - AJAX version"""
    ensure_posts_csv()
    me = str(session.get('user_id'))

    # Lê todos os posts
    with open(POSTS_PATH, 'r', newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        posts = list(reader)
        fieldnames = list(reader.fieldnames or [])

    # Garante que o campo likes_by existe
    if 'likes_by' not in fieldnames:
        fieldnames.append('likes_by')
        for p in posts:
            if 'likes_by' not in p:
                p['likes_by'] = ''

    post_author_id = None
    was_liked = False
    new_likes_count = 0
    
    # Aplica o toggle no post certo
    for p in posts:
        if int(p['id']) == post_id:
            post_author_id = p['author_id']
            likes_by = [x for x in (p.get('likes_by') or '').split(';') if x]
            
            if me in likes_by:
                # Já curti, então descurto
                likes_by = [x for x in likes_by if x != me]
                was_liked = False
            else:
                # Ainda não curti, então curto
                likes_by.append(me)
                was_liked = True
            
            p['likes_by'] = ';'.join(likes_by)
            p['likes'] = str(len(likes_by))
            new_likes_count = len(likes_by)
            break

    # Reescreve o CSV com a atualização
    with open(POSTS_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(posts)
    
    # Cria notificação se foi uma curtida (não descurtida)
    if was_liked and post_author_id and post_author_id != me:
        create_notification(
            user_id=post_author_id,
            type='like',
            actor_id=me,
            post_id=post_id
        )

    if request.headers.get('X-Requested-With') == 'fetch':
        return jsonify({
            'success': True,
            'likes': new_likes_count,
            'liked': was_liked
        })
    
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
        # Cria notificação para o usuário que recebeu a solicitação
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
    """Aceita solicitação de amizade"""
    receiver_id = str(session.get('user_id'))
    
    if accept_friend_request(receiver_id, user_id):
        pass  # Notificação é criada dentro da função
    
    return redirect(request.referrer or url_for('home_page'))

# ========================================
# API - USUÁRIOS
# ========================================
@app.get('/api/users')
@login_required
def api_users():
    """Lista usuários disponíveis pro chat (apenas amigos mútuos)"""
    uid = str(session.get('user_id'))
    all_users = get_all_users()
    
    # Filtra apenas amigos mútuos
    friends = get_friends(uid)
    users = [u for u in all_users if u['id'] != uid and u['id'] in friends]
    
    return jsonify({'users': users})

@app.get('/api/all_users')
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
    """Busca mensagens entre mim e outro usuário (apenas se forem amigos)"""
    partner_id = request.args.get('partner_id', type=str)
    since_id = request.args.get('since_id', default=0, type=int)
    me = str(session.get('user_id'))

    # Validação - só permite chat com amigos mútuos
    if not partner_id or not user_exists(partner_id) or not are_friends(me, partner_id):
        return jsonify({'error': 'partner_id inválido ou não são amigos'}), 400

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
    """Envia uma mensagem pra outro usuário (apenas se forem amigos)"""
    data = request.get_json(silent=True) or {}
    partner_id = str(data.get('partner_id', '')).strip()
    content = str(data.get('content', '')).strip()
    me = str(session.get('user_id'))

    # Validações - só permite chat com amigos mútuos
    if not partner_id or not user_exists(partner_id) or not are_friends(me, partner_id):
        return jsonify({'error': 'partner_id inválido ou não são amigos'}), 400
        
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
            if r.get('user_id') == me:
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
        if r['user_id'] == me:
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
    # Garante que todos os CSVs existam
    ensure_csv()
    ensure_messages_csv()
    ensure_posts_csv()
    ensure_notifications_csv()
    ensure_friends_csv()
    
    app.run(debug=True)