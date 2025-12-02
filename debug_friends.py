import sqlite3
import os

DB_PATH = os.path.join("src", "data", "dataBase.db")

def check_db():
    if not os.path.exists(DB_PATH):
        print("❌ Banco não encontrado.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    print("\n--- USUÁRIOS ---")
    users = c.execute("SELECT id, username, email FROM users").fetchall()
    for u in users:
        print(f"ID: {u['id']} (Tipo: {type(u['id']).__name__}) | Nome: {u['username']}")

    print("\n--- AMIZADES (Tabela friends) ---")
    friends = c.execute("SELECT user1_id, user2_id, status FROM friends").fetchall()
    
    if not friends:
        print("❌ Nenhuma amizade encontrada na tabela.")
    else:
        for f in friends:
            st = "✅ Aceito" if f['status'] == 1 else "⏳ Pendente"
            print(f"De: {f['user1_id']} -> Para: {f['user2_id']} | Status: {f['status']} ({st})")
            print(f"   Tipos: user1={type(f['user1_id']).__name__}, user2={type(f['user2_id']).__name__}")

    conn.close()

if __name__ == "__main__":
    check_db()