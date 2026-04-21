import os
import toml
from dotenv import load_dotenv
from fastapi import FastAPI
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
# FastAPI app
# -------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=env_secrets["api_key"])

# -------------------------------
# Request model
# -------------------------------
class ChatRequest(BaseModel):
    message: str
    chat_id: str

# -------------------------------
# DB connection
# -------------------------------
def get_connection():
    return psycopg2.connect(
        host=env_config["db_host"],
        dbname=env_config["db_name"],
        user=env_secrets["user"],
        password=env_secrets["password"]
    )

# -------------------------------
# DB Functions
# -------------------------------
def save_chat(chat_id, user_message, bot_response):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_history (chat_id, user_message, bot_response) VALUES (%s, %s, %s)",
        (chat_id, user_message, bot_response)
    )
    conn.commit()
    cur.close()
    conn.close()

def load_chat_history(chat_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT user_message, bot_response FROM chat_history WHERE chat_id = %s ORDER BY timestamp ASC",
        (chat_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    messages = []
    for user_msg, bot_msg in rows:
        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": bot_msg})
    return messages

# -------------------------------
# Routes
# -------------------------------

@app.get("/")
def root():
    return {"message": "AI Chatbot API is running"}

# NEW: Fetch all unique chats for the Sidebar
@app.get("/chats")
def get_all_chats():
    conn = get_connection()
    cur = conn.cursor()
    # Grabs the first message of each chat to use as a title
    cur.execute("""
        SELECT DISTINCT ON (chat_id) chat_id, user_message 
        FROM chat_history 
        ORDER BY chat_id, timestamp ASC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    
    return [{"id": r[0], "title": r[1][:30] + "..." if len(r[1]) > 30 else r[1]} for r in rows]

# Fetch history for a specific chat
@app.get("/history/{chat_id}")
def history(chat_id: str):
    return load_chat_history(chat_id)

# Delete a specific chat
@app.delete("/chat/{chat_id}")
def delete_chat(chat_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM chat_history WHERE chat_id = %s", (chat_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Deleted"}

# -------------------------------
# Chat (STREAM)
# -------------------------------
@app.post("/chat-stream")
def chat_stream(req: ChatRequest):

    def generate():
        full_reply = ""
        try:
            # 1. Load context
            messages = load_chat_history(req.chat_id)
            messages.append({"role": "user", "content": req.message})

            # 2. Get streaming response
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                stream=True
            )

            # 3. Yield chunks
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_reply += content
                    yield content.encode("utf-8")

            # 4. Save to DB once finished
            if full_reply:
                save_chat(req.chat_id, req.message, full_reply)

        except Exception as e:
            print(f"Error: {e}")
            yield f"Error: {str(e)}".encode("utf-8")

    return StreamingResponse(
        generate(), 
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )