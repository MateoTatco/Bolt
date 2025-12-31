# Dockerfile for LibreOffice headless DOCX to PDF converter
# This runs in Cloud Run for FREE (2M requests/month free tier)

FROM ubuntu:22.04

# Install LibreOffice and dependencies
RUN apt-get update && \
    apt-get install -y \
    libreoffice \
    libreoffice-writer \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Node.js (for the HTTP server)
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copy server code
COPY server.js .

# Expose port
EXPOSE 8080

# Run the server
CMD ["node", "server.js"]


