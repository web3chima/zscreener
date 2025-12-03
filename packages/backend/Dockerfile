FROM node:18-alpine

WORKDIR /app

# Copy root configuration files
COPY package.json package-lock.json tsconfig.json ./

# Copy the backend package.json
COPY packages/backend/package.json packages/backend/

# Copy the SDK package.json (Backend depends on SDK)
COPY packages/sdk/package.json packages/sdk/

# Install all dependencies (from root to ensure workspace links work)
RUN npm ci

# Copy the SDK source code
COPY packages/sdk packages/sdk

# Copy the backend source code
COPY packages/backend packages/backend

# Build the SDK first (Backend depends on it)
WORKDIR /app/packages/sdk
RUN npm run build --if-present

# Set working directory to backend
WORKDIR /app/packages/backend

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 4000

# Start the application
CMD ["npm", "start"]
