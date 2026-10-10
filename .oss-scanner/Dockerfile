# The image Anthropic's OSS Scanner builds to audit Smithable offline (projects/smithable in
# github.com/anthropics/oss-scanner points here). Network is available only while this file builds,
# so everything an audit may need is fetched here: the engine's packages, its build, and one
# generated app with its own packages installed, since the apps Smithable generates are what
# runs in the world. Test by hand: docker build -f .oss-scanner/Dockerfile -t smithable-scan .
FROM node:24-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive CI=1 SMITHABLE_NO_PICTURES=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/* && corepack enable

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

# The engine, built as its maintainers build it (CLAUDE.md: pnpm install, pnpm build).
RUN pnpm install --frozen-lockfile && pnpm build

# The unit tests, so the image is known to work; a failure is reported, not fatal.
RUN pnpm test || echo "WARNING: pnpm test reported failures"

# A generated app with its packages installed and type-checked, at /app (outside /src, so the
# engine checkout's own Git is not its parent): the CRM starter, made the way a person makes one.
RUN git config --global user.name "OSS Scanner" && git config --global user.email scanner@example.invalid \
    && node packages/cli/dist/bin.js new /app --starter crm --yes \
    && cd /app && (pnpm typecheck || pnpm exec tsc --noEmit || echo "WARNING: the app's type check reported failures")
