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

# ✅ CORS (VERY IMPORTANT for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=env_secrets["api_key"])

class ChatRequest(BaseModel):
    message: str

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
# DB functions
# -------------------------------
def save_chat(user_message, bot_response):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_history (user_message, bot_response) VALUES (%s,%s)",
        (user_message, bot_response)
    )
    conn.commit()
    cur.close()
    conn.close()

def load_chat_history():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_message, bot_response FROM chat_history ORDER BY timestamp ASC")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    messages = []
    for u, b in rows:
        messages.append({"role": "user", "content": u})
        messages.append({"role": "assistant", "content": b})

    return messages

# -------------------------------
# Routes
# -------------------------------
@app.get("/")
def root():
    return {"message": "AI Chatbot API is running"}

@app.get("/history")
def history():
    return load_chat_history()

# -------------------------------
# NORMAL CHAT (non-stream)
# -------------------------------
@app.post("/chat")
def chat(req: ChatRequest):
    messages = load_chat_history()
    messages.append({"role": "user", "content": req.message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    )

    reply = response.choices[0].message.content
    save_chat(req.message, reply)

    return {"response": reply}

# -------------------------------
# STREAMING CHAT (FIXED)
# -------------------------------
@app.post("/chat-stream")
def chat_stream(req: ChatRequest):

    def generate():
        full_reply = ""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": req.message}],
                stream=True
            )

            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    full_reply += content
                    yield content.encode("utf-8")  # ✅ important

            # ✅ Save full response after stream completes
            save_chat(req.message, full_reply)

        except Exception as e:
            error_msg = f"\nError: {str(e)}"
            yield error_msg.encode("utf-8")

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )