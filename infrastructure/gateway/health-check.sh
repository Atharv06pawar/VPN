#!/usr/bin/env bash
# ==============================================================================
# BharatTunnel 🇮🇳 - Gateway Health & Telemetry Verification Script
# Can be executed standalone or invoked via cron / monitoring agent
# ==============================================================================
set -euo pipefail

FORMAT="${1:-text}"
EXIT_CODE=0

# 1. Check WireGuard Interface
WG_RUNNING=false
ACTIVE_PEERS=0
TOTAL_PEERS=0
RX_BYTES=0
TX_BYTES=0

if wg show wg0 >/dev/null 2>&1; then
  WG_RUNNING=true
  TOTAL_PEERS=$(wg show wg0 peers 2>/dev/null | grep -c . || true)
  # Active peers: handshakes within the last 180 seconds (3 mins)
  NOW=$(date +%s)
  while IFS=$'\t' read -r pub endpoint allowed latest rx tx keepalive; do
    if [[ "${latest}" -gt 0 ]] && (( NOW - latest < 180 )); then
      ACTIVE_PEERS=$((ACTIVE_PEERS + 1))
    fi
    RX_BYTES=$((RX_BYTES + rx))
    TX_BYTES=$((TX_BYTES + tx))
  done < <(wg show wg0 dump | tail -n +2)
else
  EXIT_CODE=1
fi

# 2. Check IP Forwarding
IP_FORWARD=$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null || echo "0")
if [[ "${IP_FORWARD}" != "1" ]]; then
  EXIT_CODE=1
fi

# 3. Check Outbound Internet Connectivity
INTERNET_OK=false
if curl -s4 --max-time 3 https://1.1.1.1 >/dev/null 2>&1 || ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
  INTERNET_OK=true
else
  EXIT_CODE=1
fi

# 4. Gather System Metrics
CPU_LOAD=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo "0.0")
MEM_TOTAL=$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo "1")
MEM_AVAIL=$(awk '/MemAvailable/ {print $2}' /proc/meminfo 2>/dev/null || echo "0")
MEM_USED_PCT=$(( (MEM_TOTAL - MEM_AVAIL) * 100 / MEM_TOTAL ))
DISK_USED_PCT=$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')

if [[ "${FORMAT}" == "--json" ]]; then
  cat <<EOF
{
  "healthy": $(( EXIT_CODE == 0 ? 1 : 0 )),
  "wireguardRunning": ${WG_RUNNING},
  "ipForwardingEnabled": $(( IP_FORWARD == 1 ? 1 : 0 )),
  "outboundInternet": ${INTERNET_OK},
  "peers": {
    "total": ${TOTAL_PEERS},
    "active": ${ACTIVE_PEERS}
  },
  "traffic": {
    "rxBytes": ${RX_BYTES},
    "txBytes": ${TX_BYTES}
  },
  "system": {
    "load1m": "${CPU_LOAD}",
    "memUsedPercent": ${MEM_USED_PCT},
    "diskUsedPercent": ${DISK_USED_PCT}
  },
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
else
  echo "--- BharatTunnel Gateway Health Report ---"
  echo "Status:                 $([[ ${EXIT_CODE} -eq 0 ]] && echo 'HEALTHY' || echo 'DEGRADED/ERROR')"
  echo "WireGuard (wg0):        $([[ "${WG_RUNNING}" == "true" ]] && echo 'UP' || echo 'DOWN')"
  echo "IP Forwarding:          $([[ "${IP_FORWARD}" == "1" ]] && echo 'ENABLED' || echo 'DISABLED')"
  echo "Internet Egress:        $([[ "${INTERNET_OK}" == "true" ]] && echo 'OK' || echo 'FAILED')"
  echo "Peers (Active/Total):   ${ACTIVE_PEERS} / ${TOTAL_PEERS}"
  echo "Memory Used:            ${MEM_USED_PCT}%"
  echo "Disk Used:              ${DISK_USED_PCT}%"
  echo "1m Load Average:        ${CPU_LOAD}"
  echo "------------------------------------------"
fi

exit ${EXIT_CODE}
