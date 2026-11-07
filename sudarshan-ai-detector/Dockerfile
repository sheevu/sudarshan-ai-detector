FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Default: start FastAPI server (supports /detect, /models, /health)
# To run as MCP server: python -m scripts.mcp_server --transport stdio
CMD ["uvicorn", "scripts.api:app", "--host", "0.0.0.0", "--port", "8000"]
