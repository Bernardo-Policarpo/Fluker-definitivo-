import sqlite3

# ========================================
# Criar tabelas
# ========================================
conexao = sqlite3.connect("dataBase.db")
cursor = conexao.cursor()

#usuários
cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        username TEXT,
        password TEXT,
        email TEXT,
        bio TEXT
    )
""")

#posts
cursor.execute("""
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        author_id INTEGER,
        author_name TEXT,
        timestamp TEXT,
        content TEXT,
        likes INTEGER,
        likes_by TEXT
    )
""")

#Notificações
cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        user_id INTEGER,
        type TEXT,
        actor_id INTEGER,
        message_id INTEGER,
        read INTEGER,
        text TEXT
    )
""")

#Mensagens
cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        sender_id INTEGER,
        receiver_id INTEGER,
        timestamp TEXT,
        content TEXT
    )
""")

#Amigos
cursor.execute("""
    CREATE TABLE IF NOT EXISTS friends (  
        user1_id INTEGER,
        user2_id INTEGER,
        status INTEGER,
        timestamp TEXT
    )
""")

conexao.commit()

conexao.close()
