# Сборка и раздача фронтенда (React/CRA) + nginx reverse-proxy к бэкенду
FROM node:18-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Пустой REACT_APP_API_URL → относительные пути (/api/...), проксируются nginx
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# --- runtime ---
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]