#!/usr/bin/env bash
# ==============================================================================
# BharatTunnel 🇮🇳 - India Gateway Bootstrap Script
# Target OS: Ubuntu 22.04 / 24.04 LTS or Debian 12 (Bookworm)
# ==============================================================================
set -euo pipefail

echo "========================================================"
echo "    BharatTunnel 🇮🇳 - Gateway Provisioning Script       "
echo "========================================================"

# 1. Ensure Root Privileges
if [[ "${EUID}" -ne 0 ]]; then
  echo "[-] ERROR: This script must be executed as root (use sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# 2. Update System & Install Core VPN Networking Dependencies
echo "[+] Updating apt repositories and installing required packages..."
apt-get update -y
apt-get install -y --no-install-recommends \
  wireguard \
  wireguard-tools \
  nftables \
  iptables \
  curl \
  jq \
  procps \
  iproute2 \
  qrencode \
  ca-certificates

# 3. Detect External Network Interface & Public IP
echo "[+] Detecting external network routing..."
EXT_IFACE=$(ip -4 route show default 2>/dev/null | awk '{print $5}' | head -n1)
if [[ -z "${EXT_IFACE}" ]]; then
  echo "[-] ERROR: Unable to auto-detect default external network interface." >&2
  exit 1
fi
echo "[+] External interface detected: ${EXT_IFACE}"

PUBLIC_IP=$(curl -s4 --max-time 5 https://api.ipify.org || curl -s4 --max-time 5 https://ifconfig.me || echo "UNKNOWN_IP")
echo "[+] Indian Gateway Public IP: ${PUBLIC_IP}"

# 4. Configure Linux Kernel IP Forwarding & Security Parameters
echo "[+] Hardening sysctl network settings..."
SYSCTL_CONF="/etc/sysctl.d/99-bharattunnel.conf"
cat <<EOF > "${SYSCTL_CONF}"
# Enable IPv4 forwarding for WireGuard NAT
net.ipv4.ip_forward = 1

# Disable IPv6 forwarding unless explicitly provisioned to prevent accidental IPv6 leaks
net.ipv6.conf.all.forwarding = 0
net.ipv6.conf.default.forwarding = 0

# Mitigate IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
EOF

sysctl --system --pattern="net.ipv4|net.ipv6" >/dev/null

# 5. Create WireGuard Directory & Secure File Permissions
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

SERVER_PRIV_KEY="/etc/wireguard/server.key"
SERVER_PUB_KEY="/etc/wireguard/server.pub"

if [[ ! -f "${SERVER_PRIV_KEY}" ]]; then
  echo "[+] Generating server Curve25519 keypair..."
  wg genkey | tee "${SERVER_PRIV_KEY}" | wg pubkey > "${SERVER_PUB_KEY}"
  chmod 600 "${SERVER_PRIV_KEY}"
  chmod 644 "${SERVER_PUB_KEY}"
else
  echo "[*] Server keys already exist at ${SERVER_PRIV_KEY}. Preserving."
fi

SERVER_PUB=$(cat "${SERVER_PUB_KEY}")

# 6. Initialize /etc/wireguard/wg0.conf
WG_CONF="/etc/wireguard/wg0.conf"
if [[ ! -f "${WG_CONF}" ]]; then
  echo "[+] Writing baseline WireGuard interface config (${WG_CONF})..."
  cat <<EOF > "${WG_CONF}"
[Interface]
Address = 10.50.0.1/24
ListenPort = 51820
PrivateKey = $(cat "${SERVER_PRIV_KEY}")

# Firewall & NAT rules handled dynamically by /etc/nftables.conf or iptables
EOF
  chmod 600 "${WG_CONF}"
fi

# 7. Enable and Start WireGuard Systemd Service
echo "[+] Enabling and starting wg-quick@wg0 systemd service..."
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0

# 8. Verify Interface Status
if wg show wg0 >/dev/null 2>&1; then
  echo "[✓] WireGuard interface wg0 is ACTIVE."
else
  echo "[-] WARNING: WireGuard interface wg0 failed to initialize. Inspect 'journalctl -u wg-quick@wg0'."
fi

echo ""
echo "========================================================"
echo "    BharatTunnel Gateway Bootstrap Complete!           "
echo "========================================================"
echo "Gateway Public IP:     ${PUBLIC_IP}"
echo "Server Public Key:     ${SERVER_PUB}"
echo "Listen Port:           51820 (UDP)"
echo "Internal Subnet:       10.50.0.1/24"
echo "External Interface:    ${EXT_IFACE}"
echo "========================================================"
