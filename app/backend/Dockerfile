# ─── Development Stage ───────────────────────────────────────────────
FROM python:3.12-slim AS development

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files
COPY . .

# Run with hot reload
CMD ["uvicorn", "fastapp:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ─── Production Stage ────────────────────────────────────────────────
FROM python:3.12-slim AS production

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "fastapp:app", "--host", "0.0.0.0", "--port", "8000"]
