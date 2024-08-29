FROM python:3.12.5-slim

WORKDIR /app

COPY . /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

RUN npm install

RUN npm run build

EXPOSE 5052

ENV PORT=5052
ENV MAX_POSTGRES_WORKERS=50
ENV POSTGRES_USER="admin"
ENV POSTGRES_PASSWORD=""
ENV POSTGRES_DB="admin"
ENV POSTGRES_HOST="172.17.0.1"
ENV POSTGRES_PORT="5434"

CMD ["python", "main.py"]
