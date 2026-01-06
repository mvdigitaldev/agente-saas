FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expor porta
EXPOSE 8000

# Usar uvicorn para produção
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

