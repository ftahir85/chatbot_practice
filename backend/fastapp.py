import os
import toml
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
import psycopg2
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# -------------------------------
# Load environment
# -------------------------------
load_dotenv()
ENV = os.getenv("ENV", "development")

config = toml.load("config.toml")
secrets = toml.load(".secrets.toml")

env_config = config[ENV]
env_secrets = secrets[ENV]

# -------------------------------
# FastAPI app & Router
# -------------------------------
app = FastAPI()
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=env_secrets["api_key"])

# -------------------------------
# Request models
# -------------------------------
class ChatRequest(BaseModel):
    message: str
    chat_id: str

class CreateChatRequest(BaseModel):
    title: str = "New Chat"

# -------------------------------
# DB connection
# -------------------------------
def get_connection():
    return psycopg2.connect(
        host=env_config["db_host"],
        dbname=env_config["db_name"],
        user=env_secrets["user"],
        password=env_secrets["password"],
        connect_timeout=5
    )

# -------------------------------
# DB setup
# -------------------------------
def init_db():
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT DEFAULT 'New Chat',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id SERIAL PRIMARY KEY,
                chat_id TEXT NOT NULL,
                user_message TEXT NOT NULL,
                bot_response TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_chat
                    FOREIGN KEY(chat_id)
                    REFERENCES chats(id)
                    ON DELETE CASCADE
            )
        """)

        conn.commit()
        cur.close()
        print("✅ Database initialized")
    except Exception as e:
        print(f"❌ DB init error: {e}")
    finally:
        if conn:
            conn.close()

# -------------------------------
# DB Functions
# -------------------------------
def create_chat(chat_id, title="New Chat"):
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO chats (id, title)
            VALUES (%s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (str(chat_id), title))
        conn.commit()
        cur.close()
        return {"id": str(chat_id), "title": title}
    except Exception as e:
        print(f"❌ Create chat error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat")
    finally:
        if conn:
            conn.close()

def save_chat(chat_id, user_message, bot_response):
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Ensure chat exists before saving history
        cur.execute("""
            INSERT INTO chats (id, title)
            VALUES (%s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (str(chat_id), "New Chat"))

        cur.execute("""
            INSERT INTO chat_history (chat_id, user_message, bot_response)
            VALUES (%s, %s, %s)
        """, (str(chat_id), user_message, bot_response))

        # Update title from first user message if still default
        cur.execute("""
            UPDATE chats
            SET title = %s
            WHERE id = %s
              AND (title = 'New Chat' OR title IS NULL OR title = '')
        """, (
            user_message[:25] + ("..." if len(user_message) > 25 else ""),
            str(chat_id)
        ))

        conn.commit()
        cur.close()
        print(f"✅ DB SAVE SUCCESS: {chat_id}")
    except Exception as e:
        print(f"❌ DB SAVE ERROR: {e}")
        raise
    finally:
        if conn:
            conn.close()

def load_chat_history(chat_id):
    conn = None
    messages = []
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT user_message, bot_response
            FROM chat_history
            WHERE chat_id = %s
            ORDER BY timestamp ASC, id ASC
        """, (str(chat_id),))
        rows = cur.fetchall()
        cur.close()

        for user_msg, bot_msg in rows:
            messages.append({"role": "user", "content": user_msg})
            messages.append({"role": "assistant", "content": bot_msg})
    except Exception as e:
        print(f"❌ DB Load Error: {e}")
    finally:
        if conn:
            conn.close()
    return messages

def get_all_chats_from_db():
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title
            FROM chats
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        cur.close()
        return [{"id": row[0], "title": row[1] or "New Chat"} for row in rows]
    except Exception as e:
        print(f"❌ Error in get_all_chats_from_db: {e}")
        return []
    finally:
        if conn:
            conn.close()

def delete_chat_from_db(chat_id):
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM chats WHERE id = %s", (str(chat_id),))
        conn.commit()
        cur.close()
        return {"message": "Deleted"}
    except Exception as e:
        print(f"❌ Delete Error: {e}")
        raise HTTPException(status_code=500, detail="Delete failed")
    finally:
        if conn:
            conn.close()

# -------------------------------
# Routes
# -------------------------------
@api_router.get("/chats")
def get_all_chats():
    return get_all_chats_from_db()

@api_router.post("/chat")
def create_chat_route(req: CreateChatRequest):
    import uuid
    chat_id = str(uuid.uuid4())
    return create_chat(chat_id, req.title)

@api_router.get("/history/{chat_id}")
def history(chat_id: str):
    return load_chat_history(chat_id)

@api_router.delete("/chat/{chat_id}")
def delete_chat(chat_id: str):
    return delete_chat_from_db(chat_id)

@api_router.post("/chat-stream")
def chat_stream(req: ChatRequest):
    def generate():
        full_reply = ""
        try:
            # Ensure chat exists
            create_chat(req.chat_id, "New Chat")

            messages = load_chat_history(req.chat_id)
            messages.append({"role": "user", "content": req.message})

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                stream=True
            )

            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_reply += content
                    yield content.encode("utf-8")

            if full_reply:
                print(f"DEBUG: Finalizing response for {req.chat_id}")
                save_chat(req.chat_id, req.message, full_reply)

        except Exception as e:
            print(f"❌ STREAM ERROR: {e}")
            yield f"Error: {str(e)}".encode("utf-8")

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

app.include_router(api_router)

# Initialize DB tables at startup
init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fastapp:app", host="127.0.0.1", port=8000, reload=True)
