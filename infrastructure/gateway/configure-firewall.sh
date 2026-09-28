#!/usr/bin/env bash
# ==============================================================================
# BharatTunnel 🇮🇳 - Gateway Firewall & NAT Configuration
# Uses modern nftables with fallback to iptables-nft
# ==============================================================================
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "[-] ERROR: Must be run as root." >&2
  exit 1
fi

EXT_IFACE=$(ip -4 route show default 2>/dev/null | awk '{print $5}' | head -n1)
if [[ -z "${EXT_IFACE}" ]]; then
  echo "[-] ERROR: Unable to detect external network interface." >&2
  exit 1
fi

VPN_IFACE="wg0"
VPN_SUBNET="10.50.0.0/24"
SSH_PORT="22"
WG_PORT="51820"

echo "[+] Configuring nftables firewall on external interface: ${EXT_IFACE}..."

NFT_CONF="/etc/nftables.conf"

cat <<EOF > "${NFT_CONF}"
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;

        # Allow established and related connections
        ct state established,related accept

        # Drop invalid connections
        ct state invalid drop

        # Allow loopback
        iif "lo" accept

        # Allow ICMP / Ping (rate-limited)
        ip protocol icmp icmp type { echo-request, echo-reply } limit rate 5/second accept
        ip6 nexthdr icmpv6 icmpv6 type { echo-request, echo-reply } limit rate 5/second accept

        # WireGuard UDP listen port
        udp dport ${WG_PORT} accept

        # SSH Management Port
        tcp dport ${SSH_PORT} accept

        # Web & API Ports (HTTPS / HTTP for certbot)
        tcp dport 443 accept
        tcp dport 80 accept

        # Allow DNS queries from WireGuard clients to local resolver
        iif "${VPN_IFACE}" udp dport 53 accept
        iif "${VPN_IFACE}" tcp dport 53 accept
    }

    chain forward {
        type filter hook forward priority filter; policy drop;

        # Allow traffic from WireGuard to external internet
        iifname "${VPN_IFACE}" oifname "${EXT_IFACE}" accept

        # Allow returning established traffic from external internet to WireGuard
        iifname "${EXT_IFACE}" oifname "${VPN_IFACE}" ct state established,related accept
    }

    chain output {
        type filter hook output priority filter; policy accept;
    }
}

table ip nat {
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;

        # Masquerade (NAT) outgoing WireGuard client traffic to the Indian public IP
        ip saddr ${VPN_SUBNET} oifname "${EXT_IFACE}" masquerade
    }
}
EOF

# Apply ruleset
nft -f "${NFT_CONF}"
systemctl enable nftables
systemctl restart nftables

echo "[✓] nftables configured and active."
echo "[+] WireGuard NAT Masquerade: ${VPN_SUBNET} -> ${EXT_IFACE}"
