# app.py
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from functools import wraps
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import secrets
import sqlite3
import os

# ========================================
# CONFIGURAÇÃO
# ========================================
BASE_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(BASE_DIR, 'src')
PAGES_DIR = os.path.join(SRC_DIR, 'pages')
STATIC_DIR = os.path.join(SRC_DIR, 'static')
DATA_DIR = os.path.join(SRC_DIR, 'data')
DB_FILE = os.path.join(DATA_DIR, 'dataBase.db')

app = Flask(__name__, template_folder=PAGES_DIR, static_folder=STATIC_DIR)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

# Garante que a pasta de dados existe
os.makedirs(DATA_DIR, exist_ok=True)

# ========================================
# FUNÇÕES DE BANCO (SQLITE)
# ========================================
def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def query_db(query, args=(), one=False):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    conn.close()
    return (dict(rv[0]) if rv else None) if one else [dict(row) for row in rv]

def execute_db(query, args=()):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, args)
    conn.commit()
    last_id = cur.lastrowid
    conn.close()
    return last_id

# ========================================
# HELPERS
# ========================================
def to_sp_display(ts_str):
    if not ts_str: return ""
    try:
        if isinstance(ts_str, datetime): ts_str = ts_str.isoformat()
        dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        return dt.astimezone(ZoneInfo("America/Sao_Paulo")).strftime("%d/%m/%Y %H:%M")
    except:
        return ts_str.split('.')[0] # Fallback simples

def create_notification(user_id, type, actor_id=None, post_id=None, text=None):
    try:
        if not text:
            actor_name = "Alguém"
            if actor_id:
                u = query_db("SELECT username FROM users WHERE id = ?", (actor_id,), one=True)
                if u: actor_name = u['username']
            
            if type == 'like': text = f"{actor_name} curtiu seu post"
            elif type == 'friend_accepted': text = f"{actor_name} aceitou sua solicitação"
            elif type == 'friend_request': text = f"{actor_name} enviou solicitação"
            elif type == 'dm': text = f"Nova mensagem de {actor_name}"
        
        execute_db('''
            INSERT INTO notifications (user_id, type, actor_id, message_id, timestamp, read, text)
            VALUES (?, ?, ?, ?, ?, 0, ?)
        ''', (user_id, type, actor_id, post_id, datetime.now(timezone.utc).isoformat(), text))
    except Exception as e:
        print(f"Erro ao criar notificação: {e}")

def login_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session: return redirect(url_for('index'))
        return view_func(*args, **kwargs)
    return wrapper

# ========================================
# LÓGICA DE AMIZADE
# ========================================
def are_friends(u1, u2):
    if str(u1) == str(u2): return True
    res = query_db('''
        SELECT 1 FROM friends 
        WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
        AND status = 1
    ''', (u1, u2, u2, u1), one=True)
    return res is not None

def check_pending_request(u1, u2):
    res = query_db('''
        SELECT 1 FROM friends 
        WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))
        AND status = 0
    ''', (u1, u2, u2, u1), one=True)
    return res is not None

# ========================================
# ROTAS PRINCIPAIS
# ========================================
@app.route('/')
def index(): return render_template('index.html')

@app.get('/register')
def register_page(): return render_template('createaccount.html')

@app.get('/recover')
def recover_page(): return render_template('recoverpassword.html')

@app.route('/salvar', methods=['POST'])
def salvar():
    username = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()
    email = request.form.get('email', '').strip()
    try:
        execute_db("INSERT INTO users (username, password, email) VALUES (?, ?, ?)", (username, password, email))
    except:
        return redirect(url_for('register_page', msg='Erro: Usuário ou email já existe.'))
    return redirect(url_for('index'))

@app.post('/login')
def login():
    login_input = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()
    
    user = query_db("SELECT id, username, email FROM users WHERE (username = ? OR email = ?) AND password = ?", 
                   (login_input, login_input, password), one=True)

    if not user: return redirect(url_for('index', erro=1))
    
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['email'] = user['email']
    return redirect(url_for('home_page'))

@app.get('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.get('/home')
@login_required
def home_page():
    me = session.get('user_id')
    # Posts meus ou de amigos (status=1)
    posts = query_db('''
        SELECT * FROM posts 
        WHERE author_id = ? 
        OR author_id IN (
            SELECT CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END
            FROM friends WHERE (user1_id = ? OR user2_id = ?) AND status = 1
        )
        ORDER BY id DESC
    ''', (me, me, me, me))
    
    for p in posts: p['timestamp_display'] = to_sp_display(p['timestamp'])

    return render_template('feed.html',
        posts=posts, username=session.get('username'), user_id=str(me)
    )

@app.get('/perfil')
@login_required
def meu_perfil(): return redirect(url_for('perfil', user_id=session.get('user_id')))

@app.get('/perfil/<user_id>')
@login_required
def perfil(user_id):
    profile_user = query_db("SELECT id, username, email, bio FROM users WHERE id = ?", (user_id,), one=True)
    if not profile_user: return redirect(url_for('home_page'))

    recent_posts = query_db("SELECT * FROM posts WHERE author_id = ? ORDER BY id DESC LIMIT 5", (user_id,))
    for p in recent_posts: p['timestamp_display'] = to_sp_display(p['timestamp'])

    curr, target = str(session.get('user_id')), str(user_id)
    return render_template('feed.html',
        profile_user=profile_user, recent_posts=recent_posts,
        username=session.get('username'), user_id=curr,
        is_my_profile=(curr == target),
        are_we_friends=are_friends(curr, target),
        has_pending_request=check_pending_request(curr, target)
    )

# ========================================
# ROTAS DE AÇÃO
# ========================================
@app.post('/postar')
@login_required
def postar():
    content = request.form.get('content', '').strip()
    if content:
        execute_db('''
            INSERT INTO posts (author_id, author_name, timestamp, content, likes, likes_by)
            VALUES (?, ?, ?, ?, 0, '')
        ''', (session['user_id'], session['username'], datetime.now(timezone.utc).isoformat(), content))
    return redirect(url_for('home_page'))

@app.post('/add_friend/<user_id>')
@login_required
def add_friend(user_id):
    try:
        me, target = int(session.get('user_id')), int(user_id)
        if me != target and not check_pending_request(me, target) and not are_friends(me, target):
            execute_db("INSERT INTO friends (user1_id, user2_id, status, timestamp) VALUES (?, ?, 0, ?)",
                    (me, target, datetime.now().strftime('%d/%m/%Y %H:%M')))
            create_notification(target, 'friend_request', me)
    except Exception as e:
        print(f"Erro add_friend: {e}")
    return redirect(request.referrer or url_for('home_page'))

# ========================================
# APIS (JSON)
# ========================================
@app.get('/api/users')
@login_required
def api_all_users():
    # CORREÇÃO: Adicionado 'email' para permitir busca
    users = query_db("SELECT id, username, email FROM users WHERE id != ?", (session.get('user_id'),))
    return jsonify({'users': users})

@app.get('/api/friends')
@login_required
def api_friends():
    me = session.get('user_id')
    # Só retorna amigos confirmados (status=1)
    sql = '''
        SELECT u.id, u.username, u.email FROM users u
        JOIN friends f ON (u.id = f.user1_id OR u.id = f.user2_id)
        WHERE (f.user1_id = ? OR f.user2_id = ?) AND f.status = 1 AND u.id != ?
    '''
    users = query_db(sql, (me, me, me))
    return jsonify({'users': users})

@app.get('/api/messages')
@login_required
def api_messages():
    partner, since_id = request.args.get('partner_id'), request.args.get('since_id', 0)
    me = str(session.get('user_id'))
    
    if not are_friends(me, partner): return jsonify({'error': 'Não são amigos'}), 400

    msgs = query_db('''
        SELECT id, sender_id, receiver_id, timestamp, content FROM messages 
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        AND id > ? ORDER BY id ASC
    ''', (me, partner, partner, me, since_id))
    
    return jsonify({'messages': [{**m, 'sender_id':str(m['sender_id']), 'timestamp_display': to_sp_display(m['timestamp'])} for m in msgs]})

@app.post('/api/send')
@login_required
def api_send():
    data = request.get_json(silent=True) or {}
    partner, content = str(data.get('partner_id', '')), data.get('content', '').strip()
    me = str(session.get('user_id'))

    if not are_friends(me, partner): return jsonify({'error': 'Erro'}), 400

    mid = execute_db("INSERT INTO messages (sender_id, receiver_id, timestamp, content) VALUES (?,?,?,?)",
                    (me, partner, datetime.now(timezone.utc).isoformat(), content))
    create_notification(partner, 'dm', me, mid)
    return jsonify({'ok': True})

@app.get('/api/notifications')
@login_required
def api_notif():
    me = session.get('user_id')
    notifs = query_db("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20", (me,))
    items = []
    for n in notifs:
        items.append({
            'id':n['id'], 'type':n['type'], 'read':str(n['read']), 'text':n['text'], 
            'actor_id': n['actor_id'], 'timestamp_display': to_sp_display(n['timestamp'])
        })
    unread = sum(1 for x in items if x['read'] == '0')
    return jsonify({'unread': unread, 'items': items})

@app.post('/api/notifications/mark_all_read')
@login_required
def mark_read():
    execute_db("UPDATE notifications SET read = 1 WHERE user_id = ?", (session.get('user_id'),))
    return jsonify({'ok': True})

@app.post('/api/friend_request/accept')
@login_required
def api_accept():
    try:
        me = int(session.get('user_id'))
        data = request.get_json(force=True)
        req_id = int(data.get('requester_id'))
        
        # Tenta achar o pedido nas duas direções
        exists = query_db("SELECT 1 FROM friends WHERE (user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?)", 
                         (req_id, me, me, req_id), one=True)
        
        if exists:
            # Atualiza para Aceito (1) em qualquer direção que esteja
            execute_db("UPDATE friends SET status = 1 WHERE (user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?)", 
                      (req_id, me, me, req_id))
            
            # Limpa notificações
            execute_db("DELETE FROM notifications WHERE user_id = ? AND type = 'friend_request' AND actor_id = ?", (me, req_id))
            create_notification(req_id, 'friend_accepted', me)
            return jsonify({'ok': True})
            
        return jsonify({'ok': False, 'error': 'Pedido não encontrado'}), 404
    except Exception as e:
        print(f"Erro API Accept: {e}")
        return jsonify({'ok': False, 'error': str(e)}), 400

@app.post('/api/friend_request/reject')
@login_required
def api_reject():
    try:
        me, req_id = int(session.get('user_id')), int(request.get_json().get('requester_id'))
        execute_db("DELETE FROM friends WHERE (user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?) AND status=0", 
                  (req_id, me, me, req_id))
        execute_db("DELETE FROM notifications WHERE user_id = ? AND type = 'friend_request' AND actor_id = ?", (me, req_id))
        return jsonify({'ok': True})
    except:
        return jsonify({'ok': False}), 400

# API Likes
@app.get('/api/post_likes')
@login_required
def api_likes():
    posts = query_db("SELECT id, likes, likes_by FROM posts")
    return jsonify({str(p['id']): {'likes': p['likes'], 'likes_by': p['likes_by']} for p in posts})

@app.post('/api/toggle_like/<int:post_id>')
@login_required
def api_toggle_like(post_id):
    me = str(session.get('user_id'))
    post = query_db("SELECT likes_by, author_id FROM posts WHERE id = ?", (post_id,), one=True)
    if not post: return jsonify({'success': False})
    
    likes_by = [x for x in (post['likes_by'] or '').split(';') if x]
    liked = False
    
    if me in likes_by: likes_by.remove(me)
    else:
        likes_by.append(me)
        liked = True
        if str(post['author_id']) != me: create_notification(post['author_id'], 'like', me, post_id)
            
    execute_db("UPDATE posts SET likes_by = ?, likes = ? WHERE id = ?", (';'.join(likes_by), len(likes_by), post_id))
    return jsonify({'success': True, 'likes': len(likes_by), 'liked': liked})

if __name__ == '__main__':
    app.run(host="127.0.0.1", port=5001, debug=True)