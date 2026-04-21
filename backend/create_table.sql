
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    chat_id TEXT,
    user_message TEXT,
    bot_response TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);