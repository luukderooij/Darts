# Gebruik een lichte Python image
FROM python:3.12-slim

# Zet de werkmap in de container
WORKDIR /app

# 1. Kopieer requirements (Let op: nu met 'backend/' ervoor!)
COPY backend/requirements.txt .

# 2. Installeer dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 3. Kopieer de rest van de backend code
COPY backend/ .

# 4. Start het commando
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]