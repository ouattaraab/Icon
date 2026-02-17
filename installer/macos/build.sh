#!/bin/bash
# Build the macOS PKG installer for Icon Agent
# Usage: ./build.sh [version] [target-arch]
# Example: ./build.sh 0.1.0 aarch64-apple-darwin
#          ./build.sh 0.1.0 x86_64-apple-darwin
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AGENT_DIR="${ROOT_DIR}/agent"
BUILD_DIR="${SCRIPT_DIR}/build"
VERSION="${1:-0.1.0}"
TARGET="${2:-aarch64-apple-darwin}"
PKG_NAME="Icon-Agent-${VERSION}-${TARGET}.pkg"

echo "=== Building Icon Agent macOS PKG v${VERSION} (${TARGET}) ==="

# Clean
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/payload/usr/local/bin"
mkdir -p "${BUILD_DIR}/scripts"

# Build Rust agent + watchdog (release)
echo "[1/5] Building Rust agent and watchdog..."
cd "${AGENT_DIR}"
cargo build --release --target "${TARGET}"

RELEASE_DIR="${AGENT_DIR}/target/${TARGET}/release"

# Copy binaries
echo "[2/5] Copying binaries..."
cp "${RELEASE_DIR}/icon-agent" "${BUILD_DIR}/payload/usr/local/bin/"
cp "${RELEASE_DIR}/icon-watchdog" "${BUILD_DIR}/payload/usr/local/bin/"
chmod 755 "${BUILD_DIR}/payload/usr/local/bin/icon-agent"
chmod 755 "${BUILD_DIR}/payload/usr/local/bin/icon-watchdog"

# Show binary sizes
AGENT_SIZE=$(du -h "${BUILD_DIR}/payload/usr/local/bin/icon-agent" | cut -f1)
WATCHDOG_SIZE=$(du -h "${BUILD_DIR}/payload/usr/local/bin/icon-watchdog" | cut -f1)
echo "  Agent:    ${AGENT_SIZE}"
echo "  Watchdog: ${WATCHDOG_SIZE}"

# Copy post-install script
echo "[3/5] Preparing installer scripts..."
cp "${SCRIPT_DIR}/postinstall.sh" "${BUILD_DIR}/scripts/postinstall"
chmod +x "${BUILD_DIR}/scripts/postinstall"

# Create preinstall script (stop existing services before upgrade)
cat > "${BUILD_DIR}/scripts/preinstall" << 'PREINSTALL'
#!/bin/bash
# Stop existing services before upgrade
if launchctl list | grep -q ci.gs2e.icon-agent; then
    echo "Stopping existing Icon Agent..."
    launchctl unload /Library/LaunchDaemons/ci.gs2e.icon-agent.plist 2>/dev/null || true
fi
if launchctl list | grep -q ci.gs2e.icon-watchdog; then
    echo "Stopping existing Icon Watchdog..."
    launchctl unload /Library/LaunchDaemons/ci.gs2e.icon-watchdog.plist 2>/dev/null || true
fi
exit 0
PREINSTALL
chmod +x "${BUILD_DIR}/scripts/preinstall"

# Build component package
echo "[4/5] Building component package..."
pkgbuild \
    --root "${BUILD_DIR}/payload" \
    --scripts "${BUILD_DIR}/scripts" \
    --identifier "ci.gs2e.icon-agent" \
    --version "${VERSION}" \
    --install-location "/" \
    "${BUILD_DIR}/IconAgent.pkg"

# Build product archive (distribution)
echo "[5/5] Building distribution package..."
productbuild \
    --package "${BUILD_DIR}/IconAgent.pkg" \
    --identifier "ci.gs2e.icon-agent" \
    --version "${VERSION}" \
    "${SCRIPT_DIR}/${PKG_NAME}"

# Sign package if identity available
if security find-identity -v -p basic 2>/dev/null | grep -q "Developer ID Installer"; then
    echo "Signing package..."
    IDENTITY=$(security find-identity -v -p basic 2>/dev/null | grep "Developer ID Installer" | head -1 | awk -F'"' '{print $2}')
    productsign --sign "${IDENTITY}" "${SCRIPT_DIR}/${PKG_NAME}" "${SCRIPT_DIR}/${PKG_NAME}.signed"
    mv "${SCRIPT_DIR}/${PKG_NAME}.signed" "${SCRIPT_DIR}/${PKG_NAME}"
    echo "Package signed with: ${IDENTITY}"
else
    echo "No Developer ID Installer identity found, skipping signing"
fi

# Compute checksum
CHECKSUM=$(shasum -a 256 "${SCRIPT_DIR}/${PKG_NAME}" | awk '{print $1}')

echo ""
echo "=== Build Complete ==="
echo "  Output:  ${SCRIPT_DIR}/${PKG_NAME}"
echo "  Size:    $(du -h "${SCRIPT_DIR}/${PKG_NAME}" | cut -f1)"
echo "  SHA-256: ${CHECKSUM}"
echo ""
echo "Deploy via MDM (Jamf/Mosyle):"
echo "  1. Upload ${PKG_NAME} to MDM server"
echo "  2. Create policy targeting pilot group"
echo "  3. Set install trigger: enrollment + recurring check-in"

# Clean build dir
rm -rf "${BUILD_DIR}"
