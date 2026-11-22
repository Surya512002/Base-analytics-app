FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY keeper ./keeper
COPY shared ./shared
COPY tsconfig.json ./
CMD ["npm", "run", "keeper"]
