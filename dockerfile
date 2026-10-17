FROM oven/bun:1

WORKDIR /app

# install deps first so this layer is cached until package.json / bun.lock change
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

# the agent runs its tools here; mount a folder over it with -v
RUN mkdir /workspace && chown bun:bun /workspace
WORKDIR /workspace

USER bun
# set PI_AGENT_MODE=manual to be prompted before writes / non-read-only commands
CMD ["bun", "run", "/app/src/agent/agent.ts"]
