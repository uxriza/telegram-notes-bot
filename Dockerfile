FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src

RUN npm install --omit=dev

ENV NODE_ENV=production
ENV DATA_DIR=/data

CMD ["npm", "start"]
