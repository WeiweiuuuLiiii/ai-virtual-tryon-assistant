#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Create .env from example if missing
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo ""
  echo "  Created .env — add your Anthropic key before running:"
  echo "    ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
fi

echo ""
echo "  StyleSignal starting at http://localhost:8000"
echo ""

./mvnw spring-boot:run
