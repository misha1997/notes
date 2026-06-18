# Бэкенд: Express + MySQL2
FROM node:18-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Директрия под загрузки создаётся приложением при старте, но volume
# монтируется сюда в docker-compose
VOLUME ["/app/uploads"]

EXPOSE 3001
CMD ["npm", "start"]