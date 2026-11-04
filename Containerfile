FROM docker.io/library/node:22.23.2-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts ./scripts
RUN npm run install:ci
COPY . .
RUN npm run build:node

FROM docker.io/library/node:22.23.2-bookworm-slim
ARG REVISION
LABEL org.opencontainers.image.title="hjkl" \
      org.opencontainers.image.revision=$REVISION
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules/vinext ./node_modules/vinext
COPY --from=build /app/node_modules/react ./node_modules/react
COPY --from=build /app/node_modules/react-dom ./node_modules/react-dom
COPY --from=build /app/node_modules/scheduler ./node_modules/scheduler
COPY --from=build /app/node_modules/ipaddr.js ./node_modules/ipaddr.js
COPY scripts/serve.mjs ./serve.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "serve.mjs"]
