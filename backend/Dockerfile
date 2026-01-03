FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install streamrip
RUN pip install --no-cache-dir streamrip

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create music directories with proper permissions
RUN mkdir -p /music /music2 /music3 && chmod 777 /music /music2 /music3

# Expose port
EXPOSE 8000

# Set umask for new files to be world-readable/writable (allows host user to manage files)
ENV UMASK=0000

# Run the application with proper umask
CMD ["sh", "-c", "umask 0000 && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
