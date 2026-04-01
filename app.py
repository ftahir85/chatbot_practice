    # app.py
from fastapi import FastAPI

# Create FastAPI instance
app = FastAPI()

# Root endpoint
@app.get("/")
def read_root():
    return {"message": "Hello, FastAPI is running!"}

# Test endpoint
@app.get("/ping")
def ping():
    return {"status": "pong"}  
    
import streamlit as st
import psycopg2
import toml
import os
from dotenv import load_dotenv
from loguru import logger
from openai import OpenAI
import atexit



# Load environment variable
load_dotenv()
ENV = os.getenv("ENV", "development")

# Load config files
config = toml.load("config.toml")
secrets = toml.load(".secrets.toml")

env_config = config[ENV]
env_secrets = secrets[ENV]

# Setup logging
# logging_setup.py
import os
from loguru import logger
import atexit

# -------------------------------
# Create logs folder if it doesn't exist
# -------------------------------
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# -------------------------------
# Configure loguru logger
# -------------------------------
logger.add(
    os.path.join(LOG_DIR, "chatbot_{time:YYYY-MM-DD}.log"),  # daily log file
    rotation="1 day",    # new log each day
    retention="7 days",  # keep last 7 days of logs
    level="INFO",
    format="{time} | {level} | {name}:{function}:{line} - {message}"
)

# -------------------------------
# App startup/shutdown logging
# -------------------------------
logger.info("Application started")

def log_shutdown():
    logger.info("Application shutdown")

atexit.register(log_shutdown)

# -------------------------------
# Logging helper functions
# -------------------------------

def log_user_message(message: str):
    """Log when a user sends a message"""
    logger.info("User sent a message: {}", message)

def log_api_response():
    """Log successful OpenAI API response"""
    logger.info("OpenAI API response generated successfully")

def log_api_error(error: Exception):
    """Log OpenAI API error"""
    logger.error("OpenAI API error: {}", error)

def log_db_connection_success():
    """Log successful database connection"""
    logger.info("Database connected successfully")

def log_db_connection_failure(error: Exception):
    """Log database connection failure"""
    logger.error("Database connection failed: {}", error)

def log_db_insert_success(message: str):
    """Log successful database insert"""
    logger.info("Chat saved to database: {}", message)

def log_db_insert_failure(error: Exception):
    """Log database insert failure"""
    logger.error("Failed to save chat: {}", error)
    
    
# OpenAI setup
client = OpenAI(api_key=env_secrets["api_key"])



# Database connection
def get_connection():
    try:
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

# Save chat to database
def save_chat(user_message, bot_response):

    conn = get_connection()

    if conn is None:
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

# ✅ ADD THIS FUNCTION HERE
def load_chat_history():
    conn = get_connection()

    if conn is None:
        return []

    cur = conn.cursor()

    cur.execute(
        "SELECT user_message, bot_response FROM chat_history ORDER BY timestamp ASC"
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    messages = []

    for user_msg, bot_msg in rows:
        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": bot_msg})

    logger.info("Chat history loaded from database")

    return messages


# Get response from OpenAI


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


# --- Streamlit UI ---
st.title("AI Chatbot")

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = load_chat_history()

if "is_waiting" not in st.session_state:
    st.session_state.is_waiting = False

# Render chat history cleanly using Streamlit's native chat components
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# --- Bot Generation State ---
# If we are waiting for a response, handle it here BEFORE the chat input
if st.session_state.is_waiting:
    last_user_message = st.session_state.messages[-1]["content"]
    
    # Show the bot thinking in the UI
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = get_response(st.session_state.messages)
            st.markdown(response)
    
    # Save bot response to state
    st.session_state.messages.append(
        {"role": "assistant", "content": response}
    )
    
    # Save to database
    save_chat(last_user_message, response)
    logger.info("Response generated and saved")
    
    # Unlock input and rerun to reset the UI
    st.session_state.is_waiting = False
    st.rerun()

# --- Chat Input ---
# This will automatically be disabled when st.session_state.is_waiting is True
user_input = st.chat_input(
    "Type your message...",
    disabled=st.session_state.is_waiting
)

# --- User Input State ---
if user_input:
    logger.info(f"User sent message: {user_input}")
    
    # Save user message
    st.session_state.messages.append(
        {"role": "user", "content": user_input}
    )
    
    # Lock input box
    st.session_state.is_waiting = True
    
    # Rerun immediately to disable the input box and trigger the generation block above
    st.rerun()