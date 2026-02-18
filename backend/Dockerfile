# Dockerfile for Backend (Node.js)
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# SECURITY FIX (V7): Run as non-root user to prevent container privilege escalation
# Creates a dedicated system user with no login shell
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs --no-create-home nodeuser \
 && chown -R nodeuser:nodejs /app

USER nodeuser

# Expose port
EXPOSE 5000

# Start application (use node directly in production, not nodemon)
CMD ["node", "server.js"]
