FROM node:alpine
COPY . /tmp/src
RUN cd /tmp/src \
    && npm install \
    && npm run build \
    && mv lib/ /matrix-alias-bot/ \
    && mv node_modules / \
    && cd / \
    && rm -rf /tmp/*

ENV NODE_ENV=production
ENV NODE_CONFIG_DIR=/data/config
CMD node /matrix-alias-bot/index.js
VOLUME ["/data"]