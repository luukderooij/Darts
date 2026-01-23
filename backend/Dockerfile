# Gebruik een lichte Python image
FROM python:3.12-slim

# Zet de werkmap
WORKDIR /app
# Installeer dependencies (zorg dat je een requirements.txt hebt!)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopieer de rest van de backend code
COPY . .

# Expose de poort (ter info)
EXPOSE 8000

# Start commando
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]