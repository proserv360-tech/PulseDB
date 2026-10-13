#!/usr/bin/env bash
# PulseDB collector one-line installer (Linux/macOS, requires Node 20+).
#   curl -fsSL https://your-pulsedb.example/install-collector.sh | \
#     PULSEDB_URL=https://your-pulsedb.example PULSEDB_SDK_KEY=sk_... bash
set -euo pipefail
DIR="${PULSEDB_COLLECTOR_DIR:-$HOME/.pulsedb-collector}"
mkdir -p "$DIR" && cd "$DIR"
echo "Installing pulsedb-collector into $DIR"
curl -fsSL "${PULSEDB_URL:?set PULSEDB_URL}/collector/pulsedb-collector.mjs" -o pulsedb-collector.mjs
printf '{"name":"pulsedb-collector-host","type":"module","dependencies":{"pg":"^8.18.0"}}\n' > package.json
npm install --silent --no-audit --no-fund
cat > run.sh <<RUN
#!/usr/bin/env bash
export PULSEDB_URL="${PULSEDB_URL}"
export PULSEDB_SDK_KEY="${PULSEDB_SDK_KEY:?set PULSEDB_SDK_KEY}"
exec node "$DIR/pulsedb-collector.mjs" "\$@"
RUN
chmod +x run.sh
echo "Installed. Start with: $DIR/run.sh  (or wire it into systemd)"
