import sqlite3
import os

# Caminho exato baseado nos seus arquivos
DB_PATH = os.path.join("src", "data", "dataBase.db")

def fix_database():
    if not os.path.exists(DB_PATH):
        print(f"ERRO: Banco não encontrado em {DB_PATH}")
        return

    print(f"Conectando ao banco: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 1. Criar tabelas que antes eram CSV (caso não existam)
    print("Verificando tabelas...")
    
    # Tabela Posts
    c.execute('''CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id INTEGER,
        author_name TEXT,
        timestamp TEXT,
        content TEXT,
        likes INTEGER DEFAULT 0,
        likes_by TEXT DEFAULT ''
    )''')

    # Tabela Mensagens
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        timestamp TEXT,
        content TEXT
    )''')

    # Tabela Amigos
    c.execute('''CREATE TABLE IF NOT EXISTS friends (
        user1_id INTEGER,
        user2_id INTEGER,
        status INTEGER, 
        timestamp TEXT,
        PRIMARY KEY (user1_id, user2_id)
    )''')

    # Tabela Notificações (Garantir que existe)
    c.execute('''CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        actor_id INTEGER,
        message_id INTEGER,
        timestamp TEXT,
        read INTEGER DEFAULT 0,
        text TEXT
    )''')

    # 2. CORREÇÃO DO ERRO (Adicionar coluna timestamp se faltar)
    try:
        c.execute("SELECT timestamp FROM notifications LIMIT 1")
    except sqlite3.OperationalError:
        print("⚠️ Coluna 'timestamp' faltando em notifications. Adicionando agora...")
        c.execute("ALTER TABLE notifications ADD COLUMN timestamp TEXT")
        print("✅ Coluna adicionada com sucesso!")
    except Exception as e:
        print(f"Erro ao verificar notifications: {e}")

    conn.commit()
    conn.close()
    print("\n--- BANCO DE DADOS CORRIGIDO E PRONTO ---")

if __name__ == '__main__':
    fix_database()