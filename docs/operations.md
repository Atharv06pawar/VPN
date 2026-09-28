# BharatTunnel Operations & Runbook 🇮🇳

This runbook covers day-to-day operations, incident response, monitoring, and administrative procedures for the BharatTunnel India Gateway and Control Plane.

---

## 1. Service Management Commands

### WireGuard Gateway Service
```bash
# Check interface status
sudo wg show wg0

# Detailed tab-separated dump of all peers and transfer stats
sudo wg show wg0 dump

# Restart WireGuard tunnel interface
sudo systemctl restart wg-quick@wg0

# Check kernel logs for WireGuard errors
sudo journalctl -u wg-quick@wg0 -n 50 --no-pager
```

### BharatTunnel Control Plane
```bash
# Check running containers
docker compose ps

# View real-time API logs (sensitive keys/passwords automatically redacted)
docker compose logs -f api

# Restart API container
docker compose restart api

# Check database connection health
docker compose exec postgres pg_isready -U bharat -d bharattunnel
```

---

## 2. Gateway Telemetry & Health Checks

Run the automated health check script:
```bash
# Human-readable summary
sudo /opt/bharattunnel/infrastructure/gateway/health-check.sh

# JSON output for monitoring / Prometheus node exporter / Datadog
sudo /opt/bharattunnel/infrastructure/gateway/health-check.sh --json
```

Example JSON response:
```json
{
  "healthy": 1,
  "wireguardRunning": true,
  "ipForwardingEnabled": 1,
  "outboundInternet": true,
  "peers": {
    "total": 42,
    "active": 18
  },
  "traffic": {
    "rxBytes": 1428571428,
    "txBytes": 9876543210
  },
  "system": {
    "load1m": "0.14",
    "memUsedPercent": 34,
    "diskUsedPercent": 22
  },
  "timestamp": "2026-09-29T04:15:00Z"
}
```

---

## 3. Incident Response & Emergency Procedures

### 3.1. Emergency Peer Revocation (Abuse or Compromised Key)
If a peer key is suspected of being compromised or engaging in abusive traffic:
1. Revoke instantly via CLI:
   ```bash
   sudo wg set wg0 peer <PEER_PUBLIC_KEY> remove
   ```
2. Mark device revoked in the database:
   ```bash
   docker compose exec api npm run db:revoke-peer -- --key=<PEER_PUBLIC_KEY>
   ```

### 3.2. Server Key Rotation
To rotate the India Gateway's Curve25519 keypair:
1. Generate new keypair:
   ```bash
   wg genkey | tee /etc/wireguard/server_new.key | wg pubkey > /etc/wireguard/server_new.pub
   ```
2. Update `/etc/wireguard/wg0.conf` with new private key.
3. Update `VPN_SERVER_PUBLIC_KEY` in `.env`.
4. Restart WireGuard and notify users to regenerate/re-import device configs:
   ```bash
   sudo systemctl restart wg-quick@wg0
   docker compose restart api
   ```

### 3.3. Backup and Disaster Recovery
- Automated backups run daily via cron:
  ```bash
  sudo /opt/bharattunnel/infrastructure/gateway/backup.sh
  ```
- Backups are stored in `/var/backups/bharattunnel/` with 14-day retention.
- To restore:
  ```bash
  # Restore WireGuard configurations
  tar -xzf /var/backups/bharattunnel/<TIMESTAMP>/wireguard_etc_*.tar.gz -C /etc

  # Restore PostgreSQL database
  gunzip -c /var/backups/bharattunnel/<TIMESTAMP>/bharattunnel_db_*.sql.gz | docker compose exec -T postgres psql -U bharat bharattunnel
  ```
