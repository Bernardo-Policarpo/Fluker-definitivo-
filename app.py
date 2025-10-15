from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from functools import wraps
from datetime import datetime
import secrets
import csv
import os

BASE_DIR = os.path.dirname(__file__)
SRC_DIR  = os.path.join(BASE_DIR, 'src')
PAGES_DIR = os.path.join(SRC_DIR, 'pages')
DATA_DIR  = os.path.join(SRC_DIR, 'data')
CSV_PATH  = os.path.join(DATA_DIR, 'users.csv')
STATIC_DIR = os.path.join(SRC_DIR, 'static')
MESSAGES_PATH = os.path.join(DATA_DIR, 'messages.csv')

app = Flask(__name__, template_folder = PAGES_DIR, static_folder=STATIC_DIR)

app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

def ensure_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CSV_PATH):
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'username', 'password', 'email'])  # cabeçalho

def ensure_messages_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(MESSAGES_PATH):
        with open(MESSAGES_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'sender_id', 'receiver_id', 'timestamp', 'content'])

def next_id():
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(row['id']) for row in reader if row.get('id')]
        return (max(ids) + 1) if ids else 1
    
def next_message_id():
    ensure_messages_csv()
    with open(MESSAGES_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(r['id']) for r in reader if r.get('id')]
        return (max(ids) + 1) if ids else 1
    
@app.route('/')
def index():
    return render_template('index.html')

@app.get('/register')
def register_page():
    return render_template('createaccount.html')

@app.route('/salvar', methods=['POST'])
def salvar():
    ensure_csv()
    username = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()
    email = request.form.get('email', '').strip()

    # adiciona como “linha” ao CSV
    with open(CSV_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([next_id(), username, password, email])

    # redireciona de volta para a página
    return redirect(url_for('index'))

@app.post('/login')
def login():
    ensure_csv()
    login_input = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()

    if not login_input or not password:
        # campos obrigatórios faltando → volta para a página inicial
        return redirect(url_for('index'))

    # Procura uma linha no CSV com username e password na mesma linha
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

def login_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            # opcional: flash('Faça login para continuar')
            return redirect(url_for('index'))
        return view_func(*args, **kwargs)
    return wrapper

@app.get('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.get('/home')  # pós-login
@login_required
def home_page():
    return render_template('feed.html')

@app.get('/recover')
def recover_page():
    return render_template('recoverpassword.html')

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

def user_exists(user_id):
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get('id') == str(user_id):
                return True
    return False

@app.get('/inbox')
@login_required
def inbox():
    return redirect(url_for('home_page'))

@app.get('/api/users')
@login_required
def api_users():
    uid = str(session.get('user_id'))
    users = [u for u in get_all_users() if u['id'] != uid]
    return jsonify({'users': users})

@app.get('/api/messages')
@login_required
def api_messages():
    partner_id = request.args.get('partner_id', type=str)
    since_id = request.args.get('since_id', default=0, type=int)
    me = str(session.get('user_id'))

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
    data = request.get_json(silent=True) or {}
    partner_id = str(data.get('partner_id', '')).strip()
    content = str(data.get('content', '')).strip()
    me = str(session.get('user_id'))

    if not partner_id or not user_exists(partner_id):
        return jsonify({'error': 'partner_id inválido'}), 400
    if not content:
        return jsonify({'error': 'Mensagem vazia'}), 400

    ensure_messages_csv()
    mid = next_message_id()
    now = datetime.utcnow().isoformat() + 'Z'
    with open(MESSAGES_PATH, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([mid, me, partner_id, now, content])

    return jsonify({'ok': True, 'id': mid, 'timestamp': now})

if __name__ == '__main__':
    app.run(debug=True)