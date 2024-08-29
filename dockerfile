# Use an official Python runtime as a parent image
FROM python:3.12.5-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Install Node.js and npm
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install npm dependencies
RUN npm install

# Build the frontend assets using Webpack
RUN npm run build

# Expose the port the app runs on
EXPOSE 5052

# Set environment variables
ENV PORT=5052
ENV MAX_POSTGRES_WORKERS=50
ENV POSTGRES_USER="admin"
ENV POSTGRES_PASSWORD=""
ENV POSTGRES_DB="admin"
ENV POSTGRES_HOST="172.17.0.1"
ENV POSTGRES_PORT="5434"

# Command to run the Tornado server
CMD ["python", "main.py"]

# docker image build -t hutterite-bookshelf .
# docker run -p 5000:5000 -d hutterite-bookshelf
# docker tag hutterite-bookshelf jarebear/hutterite-bookshelf
# docker push jarebear/hutterite-bookshelf