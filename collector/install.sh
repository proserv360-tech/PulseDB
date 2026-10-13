#!/usr/bin/env bash
# FATHOM collector one-line installer (Linux/macOS, requires Node 20+).
#   curl -fsSL https://your-fathom.example/install-collector.sh | \
#     FATHOM_URL=https://your-fathom.example FATHOM_SDK_KEY=sk_... bash
set -euo pipefail
DIR="${FATHOM_COLLECTOR_DIR:-$HOME/.fathom-collector}"
mkdir -p "$DIR" && cd "$DIR"
echo "Installing fathom-collector into $DIR"
curl -fsSL "${FATHOM_URL:?set FATHOM_URL}/collector/fathom-collector.mjs" -o fathom-collector.mjs
printf '{"name":"fathom-collector-host","type":"module","dependencies":{"pg":"^8.18.0"}}\n' > package.json
npm install --silent --no-audit --no-fund
cat > run.sh <<RUN
#!/usr/bin/env bash
export FATHOM_URL="${FATHOM_URL}"
export FATHOM_SDK_KEY="${FATHOM_SDK_KEY:?set FATHOM_SDK_KEY}"
exec node "$DIR/fathom-collector.mjs" "\$@"
RUN
chmod +x run.sh
echo "Installed. Start with: $DIR/run.sh  (or wire it into systemd)"
