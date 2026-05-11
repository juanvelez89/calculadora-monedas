# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Eliminar config por defecto
RUN rm -rf /usr/share/nginx/html/*

# Copiar el build de Angular
COPY --from=builder /app/dist/calculadora-monedas/browser /usr/share/nginx/html

# Copiar config de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
