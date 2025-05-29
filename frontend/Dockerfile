# frontend/Dockerfile

# 1. Build stage
FROM node:18-alpine AS build
WORKDIR /app

# 2. Copy package files & install
COPY package*.json ./
RUN npm ci

# 3. Copy source & build
COPY . .
RUN npm run build

# 4. Production stage with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
