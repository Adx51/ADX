FROM node:22-alpine AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache python3 make g++ sqlite-libs

WORKDIR /app

COPY server ./server
RUN cd server && npm ci --omit=dev

COPY --from=builder /build/dist ./dist

COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3001

CMD [ "/run.sh" ]
