FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
ENV NODE_ENV=production SESSIONS_DIR=/data/sessions PORT=4010
VOLUME ["/data"]
EXPOSE 4010
USER node
CMD ["node", "src/server.js"]
