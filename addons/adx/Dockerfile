FROM node:22-alpine

RUN apk add --no-cache python3 make g++ sqlite-libs

WORKDIR /app

COPY server ./server
RUN cd server && npm ci --omit=dev

COPY dist ./dist

COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3001

CMD [ "/run.sh" ]
