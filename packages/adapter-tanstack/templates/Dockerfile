# Builds the app into a small image. Irreplaceable state lives in the /data volume.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod && mkdir -p /data

# A minimal runtime (Node and little else, no shell), as a user without root rights: fewer
# packages means fewer vulnerabilities to patch (smithable security --level release checks it).
# Pinned by digest, so a build is reproducible; a Smithable update moves the pin.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/server.mjs ./
# Third-party notices travel with the image (LICENSES/README.md).
COPY --from=build /app/LICENSES ./LICENSES
COPY --from=build --chown=nonroot:nonroot /data /data
VOLUME /data
EXPOSE 3000
HEALTHCHECK CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["server.mjs"]
