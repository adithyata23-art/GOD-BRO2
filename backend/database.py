import hashlib
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "database.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = os.urandom(16).hex()
    salted = f"{salt}${password}".encode("utf-8")
    pwd_hash = hashlib.sha256(salted).hexdigest()
    return f"{salt}${pwd_hash}"


def verify_password(password: str, stored_value: str) -> bool:
    try:
        salt, _ = stored_value.split("$", 1)
        expected = hash_password(password, salt=salt)
        return expected == stored_value
    except Exception:
        return False


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email_or_usn TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interview_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            domain TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT,
            score REAL,
            feedback TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)

    conn.commit()
    conn.close()


def register_user(name: str, email_or_usn: str, password: str):
    name = (name or "").strip()
    email_or_usn = (email_or_usn or "").strip()
    password = (password or "").strip()

    if not name or not email_or_usn or not password:
        return False, "All fields (Name, USN/Email, Password) are required."

    if len(password) < 6:
        return False, "Password must be at least 6 characters long."

    conn = get_connection()
    cursor = conn.cursor()

    try:
        pwd_hash = hash_password(password)
        cursor.execute(
            "INSERT INTO users (name, email_or_usn, password_hash) VALUES (?, ?, ?)",
            (name, email_or_usn, pwd_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return True, {
            "id": user_id,
            "name": name,
            "email_or_usn": email_or_usn
        }
    except sqlite3.IntegrityError:
        return False, "An account with this Email or USN already exists."
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()


def authenticate_user(email_or_usn: str, password: str):
    email_or_usn = (email_or_usn or "").strip()
    password = (password or "").strip()

    if not email_or_usn or not password:
        return False, "Please enter both Email/USN and Password."

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id, name, email_or_usn, password_hash FROM users WHERE LOWER(email_or_usn) = LOWER(?)",
            (email_or_usn,)
        )
        user = cursor.fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            return False, "Invalid Email/USN or password."

        return True, {
            "id": user["id"],
            "name": user["name"],
            "email_or_usn": user["email_or_usn"]
        }
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()


def save_interview_record(user_id, domain, difficulty, question, answer, score, feedback):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO interview_history (user_id, domain, difficulty, question, answer, score, feedback)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, domain, difficulty, question, answer, score, feedback)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_user_interview_history(user_id, limit=20):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT id, domain, difficulty, question, answer, score, feedback, created_at
            FROM interview_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, limit)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

