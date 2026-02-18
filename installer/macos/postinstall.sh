#!/bin/bash
# Icon Agent — macOS Post-Installation Script
# Executed after PKG installation
set -e

ICON_DIR="/usr/local/bin"
DATA_DIR="/var/lib/icon"
LOG_DIR="/var/log/icon"
CONFIG_DIR="/etc/icon"
AGENT_PLIST="/Library/LaunchDaemons/ci.gs2e.icon-agent.plist"
WATCHDOG_PLIST="/Library/LaunchDaemons/ci.gs2e.icon-watchdog.plist"
AGENT_BINARY="${ICON_DIR}/icon-agent"
WATCHDOG_BINARY="${ICON_DIR}/icon-watchdog"
SERVER_URL="${ICON_SERVER_URL:-https://icon.gs2e.ci}"

echo "=== Icon Agent Post-Install ==="

# Create directories with restrictive permissions
mkdir -p "${DATA_DIR}" "${LOG_DIR}" "${CONFIG_DIR}"
chmod 700 "${DATA_DIR}"
chmod 755 "${LOG_DIR}"
chmod 700 "${CONFIG_DIR}"

# Generate encryption key for local DB (only on fresh install)
if [ ! -f "${CONFIG_DIR}/config.toml" ]; then
    echo "Generating fresh configuration..."
    DB_KEY=$(openssl rand -hex 32)

    cat > "${CONFIG_DIR}/config.toml" << EOF
server_url = "${SERVER_URL}"
proxy_port = 8443
heartbeat_interval_secs = 60
event_sync_interval_secs = 30
event_batch_size = 100
local_retention_days = 7
data_dir = "${DATA_DIR}"
db_encryption_key = "${DB_KEY}"
websocket_url = "wss://icon.gs2e.ci/ws"
EOF

    chmod 600 "${CONFIG_DIR}/config.toml"
else
    echo "Existing configuration preserved"
fi

# Set binary permissions
chmod 755 "${AGENT_BINARY}"
chmod 755 "${WATCHDOG_BINARY}"

# Install Agent LaunchDaemon
cat > "${AGENT_PLIST}" << 'PLISTEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ci.gs2e.icon-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/icon-agent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>/var/log/icon/agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/icon/agent.error.log</string>
    <key>WorkingDirectory</key>
    <string>/var/lib/icon</string>
</dict>
</plist>
PLISTEOF

# Install Watchdog LaunchDaemon
cat > "${WATCHDOG_PLIST}" << 'PLISTEOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ci.gs2e.icon-watchdog</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/icon-watchdog</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>/var/log/icon/watchdog.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/icon/watchdog.error.log</string>
    <key>WorkingDirectory</key>
    <string>/var/lib/icon</string>
</dict>
</plist>
PLISTEOF

# Install CA certificate into macOS System keychain so the MITM proxy is trusted.
# The agent generates the CA on first run; if the cert already exists from a
# previous install we install it now so interception works immediately.
CA_CERT="${DATA_DIR}/icon-ca.crt"
if [ -f "${CA_CERT}" ]; then
    echo "Installing CA certificate into System keychain..."
    security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CA_CERT}" \
        && echo "CA certificate installed" \
        || echo "WARNING: Failed to install CA certificate (will be retried by the agent on first boot)"
else
    echo "CA certificate not yet generated (will be created and installed on first agent boot)"
fi

# NOTE: System proxy PAC URL configuration is now handled by the agent itself
# on first boot (via proxy::system_proxy::configure_system_proxy). The watchdog
# also re-applies it if it detects tampering. No need to configure it here.

# Load daemons
launchctl load -w "${AGENT_PLIST}"
launchctl load -w "${WATCHDOG_PLIST}"

echo ""
echo "=== Icon Agent installed and started ==="
echo "  Server:   ${SERVER_URL}"
echo "  Data:     ${DATA_DIR}"
echo "  Logs:     ${LOG_DIR}"
echo "  Agent:    launchctl list ci.gs2e.icon-agent"
echo "  Watchdog: launchctl list ci.gs2e.icon-watchdog"
