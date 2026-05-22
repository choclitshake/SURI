import sqlite3
import os

DATABASE_URL = os.getenv("DATABASE_URL", "suri.db")

def reset_db():
    conn = sqlite3.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    tables_to_clear = [
        "misconception_logs",
        "progression_logs",
        "practice_attempts",
        "competency_status",
        "diagnostic_logs",
        "sessions"
    ]
    
    for table in tables_to_clear:
        cursor.execute(f"DELETE FROM {table}")
        conn.commit()
        
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"{table}: {count} rows remaining")
        
    conn.close()

if __name__ == "__main__":
    reset_db()
