# pi_agent

## Run in a Docker sandbox

The bash tool has no guardrails yet, so run the agent inside Docker.

### Build the image

```bash
docker build -f dockerfile -t pi-agent .
```

### Run the container

```bash
mkdir -p sandbox
docker run -it --rm \
  --env-file .env \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 1g --pids-limit 256 \
  -v "$PWD/sandbox":/workspace \
  pi-agent
```
