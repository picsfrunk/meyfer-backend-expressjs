# Imagen base liviana
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./

RUN npm install --quiet --no-optional \
    && npm cache clean --force

COPY . .

ENV PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
