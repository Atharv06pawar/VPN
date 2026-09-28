#!/usr/bin/env bash
# ==============================================================================
# BharatTunnel 🇮🇳 - Server Keypair Generator
# Generates Curve25519 keypair for the Indian WireGuard gateway
# ==============================================================================
set -euo pipefail

DEST_DIR="${1:-/etc/wireguard}"

if ! command -v wg >/dev/null 2>&1; then
  echo "[-] ERROR: 'wg' binary not found. Please install wireguard-tools." >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"
chmod 700 "${DEST_DIR}"

PRIV_FILE="${DEST_DIR}/server.key"
PUB_FILE="${DEST_DIR}/server.pub"

if [[ -f "${PRIV_FILE}" ]]; then
  echo "[!] Server key already exists at ${PRIV_FILE}."
  echo "    To overwrite, explicitly delete the file first."
  cat "${PUB_FILE}"
  exit 0
fi

# Generate Curve25519 private key & public key
wg genkey | tee "${PRIV_FILE}" | wg pubkey > "${PUB_FILE}"
chmod 600 "${PRIV_FILE}"
chmod 644 "${PUB_FILE}"

echo "[✓] Server keypair successfully generated."
echo "Public Key: $(cat "${PUB_FILE}")"
echo "Private Key securely stored in ${PRIV_FILE}"
