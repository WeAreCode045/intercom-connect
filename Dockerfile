# Simple production Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server/index.js"]
