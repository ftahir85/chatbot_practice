# app.py
import os
import streamlit as st
import toml
from dotenv import load_dotenv
import atexit
from openai import OpenAI

# -------------------------------
# Load environment variables
# -------------------------------
load_dotenv()
ENV = os.getenv("ENV", "development")

# Load config files
config = toml.load("config.toml")
secrets = toml.load(".secrets.toml")

env_config = config[ENV]
env_secrets = secrets[ENV]

# -------------------------------
# Logger setup
# -------------------------------
from loguru import logger

def setup_logger(log_dir="logs"):
    os.makedirs(log_dir, exist_ok=True)
    logger.add(
        os.path.join(log_dir, "chatbot_{time:YYYY-MM-DD}.log"),
        rotation="1 day",
        retention="7 days",
        level="INFO",
        format="{time} | {level} | {name}:{function}:{line} - {message}"
    )
    logger.info("Logger initialized")
    return logger

logger = setup_logger()
logger.info("Application started")

def log_shutdown():
    logger.info("Application shutdown")
atexit.register(log_shutdown)

# -------------------------------
# OpenAI client
# -------------------------------
client = OpenAI(api_key=env_secrets["api_key"])

# -------------------------------
# Database connection
# -------------------------------
def get_connection():
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=env_config["db_host"],
            dbname=env_config["db_name"],
            user=env_secrets["user"],
            password=env_secrets["password"]
        )
        logger.info("Database connected")
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

# -------------------------------
# Chat DB functions
# -------------------------------
def save_chat(user_message, bot_response):
    conn = get_connection()
    if not conn:
        return
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_history (user_message, bot_response) VALUES (%s,%s)",
        (user_message, bot_response)
    )
    conn.commit()
    cur.close()
    conn.close()
    logger.info("Chat saved to database")

def load_chat_history():
    conn = get_connection()
    if not conn:
        return []
    cur = conn.cursor()
    cur.execute("SELECT user_message, bot_response FROM chat_history ORDER BY timestamp ASC")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    messages = []
    for user_msg, bot_msg in rows:
        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": bot_msg})

    logger.info("Chat history loaded from database")
    return messages

# -------------------------------
# OpenAI response
# -------------------------------
def get_response(messages):
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages
        )
        reply = response.choices[0].message.content
        logger.info("OpenAI response generated")
        return reply
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        return "Sorry, something went wrong."

# -------------------------------
# Streamlit UI
# -------------------------------
st.title("AI Chatbot")

# Session state
if "messages" not in st.session_state:
    st.session_state.messages = load_chat_history()
if "is_waiting" not in st.session_state:
    st.session_state.is_waiting = False

# Display chat history
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# Bot generation
if st.session_state.is_waiting:
    last_user_message = st.session_state.messages[-1]["content"]
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = get_response(st.session_state.messages)
            st.markdown(response)

    st.session_state.messages.append({"role": "assistant", "content": response})
    save_chat(last_user_message, response)
    logger.info("Response generated and saved")

    st.session_state.is_waiting = False
    st.rerun()

# User input
user_input = st.chat_input("Type your message...", disabled=st.session_state.is_waiting)

if user_input:
    logger.info(f"User sent message: {user_input}")
    st.session_state.messages.append({"role": "user", "content": user_input})
    st.session_state.is_waiting = True
    st.rerun()