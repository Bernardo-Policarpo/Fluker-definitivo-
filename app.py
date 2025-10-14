from flask import Flask, render_template, request, redirect, url_for
import csv
import os

BASE_DIR = os.path.dirname(__file__)
SRC_DIR  = os.path.join(BASE_DIR, 'src')
PAGES_DIR = os.path.join(SRC_DIR, 'pages')
DATA_DIR  = os.path.join(SRC_DIR, 'data')
CSV_PATH  = os.path.join(DATA_DIR, 'users.csv')
STATIC_DIR = os.path.join(SRC_DIR, 'static')

app = Flask(__name__, template_folder = PAGES_DIR, static_folder=STATIC_DIR)


def ensure_csv():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(CSV_PATH):
        with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'username', 'password', 'email'])  # cabeçalho

def next_id():
    ensure_csv()
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        ids = [int(row['id']) for row in reader if row.get('id')]
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
    username = request.form.get('usuario', '').strip()
    password = request.form.get('senha', '').strip()

    print('[DEBUG] Tentando login com:', username, password)

    if not username or not password:
        # campos obrigatórios faltando → volta para a página inicial
        return redirect(url_for('index'))

    # Procura uma linha no CSV com username e password na mesma linha
    with open(CSV_PATH, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)  # usa cabeçalho: id, username, password, email
        for row in reader:
            # Atenção: no CSV o cabeçalho está como 'username' e 'password'
            if row.get('username') == username and row.get('password') == password:
                # Login OK → vai para /home
                return redirect(url_for('home_page'))

    # Se não achou, credenciais inválidas → volta para /
    return redirect(url_for('index', erro=1))

@app.get('/home')  # pós-login
def home_page():
    return render_template('feed.html')

@app.get('/recover')
def recover_page():
    return render_template('recoverpassword.html')

if __name__ == '__main__':
    app.run(debug=True)