# 🚀 Chatbot Application (React + Tailwind + FastAPI + PostgreSQL + Nginx)

This project is a fully containerized AI chatbot system that brings together:

- **Frontend:** React + Tailwind CSS + Vite
- **Backend:** FastAPI + OpenAI GPT-4o-mini
- **Database:** PostgreSQL with migration scripts
- **Nginx:** Reverse proxy + HTTPS (SSL via Let's Encrypt) + frontend static file server
- **Voice:** OpenAI Whisper (speech-to-text) + TTS (text-to-speech)

It is designed to be flexible — you can run it locally in development mode or deploy it fully on EC2 in production with HTTPS.

---

## 📂 Project Structure

```
chatbot_practice/
├── .dockerignore
├── .env                          # Docker environment variables (not in git)
├── .env.example                  # Template for .env
├── .gitignore
├── docker-compose.yml            # Orchestration of services
│
├── backend/                      # FastAPI backend
│   ├── .secrets.toml             # API keys & DB password (not in git)
│   ├── Dockerfile                # Backend Docker image
│   ├── config.toml               # Backend configuration
│   ├── fastapp.py                # Main FastAPI application
│   └── requirements.txt          # Python dependencies
│
├── chatbot-ui/                   # React + Tailwind frontend
│   ├── Dockerfile                # Frontend Docker image
│   ├── nginx.conf                # Nginx config for production container
│   ├── tailwind.config.js        # Tailwind CSS configuration
│   ├── postcss.config.js         # PostCSS configuration
│   ├── vite.config.ts            # Vite configuration
│   ├── package.json              # Node dependencies
│   ├── index.html                # HTML entry point
│   └── src/
│       ├── main.jsx              # React entry point
│       ├── App.jsx               # Main app component
│       ├── index.css             # Global styles (Tailwind directives)
│       ├── styles.css            # Additional custom styles
│       └── components/
│           ├── ChatWindow.jsx    # Chat messages, input, voice
│           └── Sidebar.jsx       # Chat list & navigation
│
└── db/                           # Database setup
    ├── migrations/               # SQL migration files
    │   ├── 001_create_tables.sql # Creates chats & chat_history tables
    │   └── 002_add_source_column.sql # Adds source column to chat_history
    └── scripts/
        └── apply_migrations.sh  # Helper script to run migrations
```

---

## 🔧 Features

- 💬 **Multi-session chat** — create, switch, and delete chat sessions
- 🧠 **GPT-4o-mini** — powered by OpenAI's fast and affordable model
- 🎤 **Voice input** — hold mic button to speak, Whisper transcribes it
- 🔊 **Voice output** — bot responses are played as audio via TTS
- 💾 **Chat history** — all conversations saved to PostgreSQL
- 🔒 **HTTPS** — SSL certificate via Let's Encrypt (Certbot)
- 🐳 **Docker** — fully containerized for easy deployment
- 📦 **DB Migrations** — versioned SQL migration files

---

## 🐳 Running the Project

Make sure you have **Docker** installed and running.

### Step 1 — Create `.env` file

```
DOCKER_ENV=development
POSTGRES_DB=chatbot_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
OPENAI_API_KEY=your-openai-key
DB_HOST=db
DB_PORT=5432
```

### Step 2 — Create `backend/.secrets.toml`

## ▶️ Development Mode

Runs frontend, backend, and db as separate containers.
The React app runs with hot reload for faster iteration.

```bash
# Run all services
docker compose --profile dev --env-file .env up --build

# Stop containers
docker compose --profile dev --env-file .env down

# Build and run separately
docker compose --profile dev --env-file .env build
docker compose --profile dev --env-file .env up
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:8000

---

## 🚀 Production Mode (EC2 + Nginx + HTTPS)

In production, the React app is built into static files and served by Nginx.
No separate frontend container is needed.

Nginx handles:
- Serving static frontend files (`/`)
- Reverse proxying API requests to backend (`/api/`)
- HTTPS via Let's Encrypt SSL certificate

### Step 1 — Run backend and database

```bash
docker compose --env-file .env up --build -d
```

### Step 2 — Run database migrations

```bash
docker exec chatbot_db psql -U postgres -d chatbot_dev \
  -f /docker-entrypoint-initdb.d/migrations/001_create_tables.sql

docker exec chatbot_db psql -U postgres -d chatbot_dev \
  -f /docker-entrypoint-initdb.d/migrations/002_add_source_column.sql
```

### Step 3 — Build and serve frontend via Nginx

```bash
cd chatbot-ui
npm install
npm run build
sudo cp -r dist/* /usr/share/nginx/html/
sudo systemctl restart nginx
```

### Step 4 — Setup HTTPS (first time only)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d domain.ddns.net
```


---

## ⚙️ Important Notes

### `.env`
Contains service-specific variables used by `docker-compose.yml`.


### `config.toml`
Application-level settings for the backend only.
**Note:** No secrets should be stored here.

### `.secrets.toml`
Contains sensitive credentials — **never commit to git**.
Add `.secrets.toml` to your `.gitignore`.

### Nginx
Nginx proxies `/api/` requests to the backend at `localhost:8000`.
Frontend static files are served from `/usr/share/nginx/html/`.

---

## 🔄 After Making Changes

### Backend changes (fastapp.py, config.toml):
```bash
docker compose restart backend
```

### New migration files added:
```bash
docker exec chatbot_db psql -U postgres -d chatbot_dev \
  -f /docker-entrypoint-initdb.d/migrations/00X_your_migration.sql
```

### Frontend changes:
```bash
cd chatbot-ui
npm run build
sudo cp -r dist/* /usr/share/nginx/html/
sudo systemctl restart nginx
```

---
