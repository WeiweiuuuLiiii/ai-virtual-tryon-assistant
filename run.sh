#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Create .env from example if missing
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo ""
  echo "  Created .env — add your API keys before running:"
  echo "    ANTHROPIC_API_KEY=sk-ant-..."
  echo "    REPLICATE_API_TOKEN=r8_..."
  echo ""
fi

# Export .env vars so Spring Boot can read them via ${ENV_VAR:}
if [ -f "$ROOT/.env" ]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

echo ""
echo "  StyleSignal starting at http://localhost:8000"
echo ""

./mvnw spring-boot:run
