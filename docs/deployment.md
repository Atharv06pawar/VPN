# BharatTunnel Production Deployment Guide 🇮🇳

This guide details how to deploy a production-grade **BharatTunnel India-Exit Gateway and Control Plane** on an Indian cloud VPS.

---

## 1. Cloud Infrastructure Selection

For the India exit gateway, deploy a virtual machine in an Indian data center:

| Provider | Recommended Region | Datacenter Location |
|---|---|---|
| **AWS** | `ap-south-1` | Mumbai / Hyderabad |
| **Google Cloud** | `asia-south1` | Mumbai / Delhi |
| **Oracle Cloud** | `ap-mumbai-1` / `ap-hyderabad-1` | Mumbai / Hyderabad (Free Tier Eligible) |
| **DigitalOcean** | `blr1` | Bengaluru |
| **Linode / Akamai**| `in-maa` | Chennai / Mumbai |

### Recommended Server Sizing
- **OS**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, or Debian 12 (Bookworm)
- **CPU**: 2 vCPU
- **RAM**: 2 GB to 4 GB
- **Bandwidth**: 1 Gbps port with at least 1 TB to 5 TB monthly egress allowance
- **Public IPv4**: 1 dedicated static IPv4 address (mandatory)

---

## 2. Server Provisioning & Gateway Setup

### Step 1: Connect via SSH
```bash
ssh root@<YOUR_INDIAN_VPS_IP>
```

### Step 2: Clone the Repository & Make Scripts Executable
```bash
git clone https://github.com/bharattunnel/bharattunnel.git /opt/bharattunnel
cd /opt/bharattunnel
chmod +x infrastructure/gateway/*.sh
```

### Step 3: Run the Gateway Bootstrap Script
```bash
sudo ./infrastructure/gateway/bootstrap-gateway.sh
```
This script automatically:
- Installs `wireguard`, `wireguard-tools`, `nftables`, and network diagnostics.
- Detects the default public network interface (e.g., `eth0`, `ens3`, `enp1s0`).
- Configures kernel sysctl parameters (`net.ipv4.ip_forward=1`, disables IPv6 leak paths, enables anti-spoofing reverse path filtering).
- Generates `/etc/wireguard/server.key` and `/etc/wireguard/server.pub`.
- Initializes `/etc/wireguard/wg0.conf` on subnet `10.50.0.1/24` listening on UDP `51820`.
- Enables and starts the `wg-quick@wg0` systemd unit.

### Step 4: Configure the Firewall & NAT Masquerading
```bash
sudo ./infrastructure/gateway/configure-firewall.sh
```
This configures `nftables` to:
- Drop all incoming traffic by default.
- Open only **UDP 51820** (WireGuard), **TCP 22** (SSH), **TCP 80** (HTTP for ACME), and **TCP 443** (HTTPS).
- Masquerade outgoing WireGuard client packets (`10.50.0.0/24`) through the public interface to the Indian public IP.
- Ensure internal databases (PostgreSQL/Redis) are never reachable from the public internet.

---

## 3. Control Plane Deployment

### Step 1: Configure Environment Variables
Create `/opt/bharattunnel/.env`:
```env
NODE_ENV=production
PORT=4000
API_BASE_URL=https://api.yourdomain.in
WEB_BASE_URL=https://yourdomain.in

# Database
DATABASE_URL=postgresql://bharat:STRONG_DB_PASSWORD@localhost:5432/bharattunnel?schema=public

# Authentication Secrets (Generate with `openssl rand -hex 32`)
JWT_SECRET=YOUR_64_CHAR_HEX_RANDOM_SECRET
SESSION_SECRET=YOUR_64_CHAR_HEX_RANDOM_SECRET
COOKIE_SECRET=YOUR_64_CHAR_HEX_RANDOM_SECRET

# WireGuard Gateway Parameters
VPN_SERVER_HOST=<YOUR_INDIAN_VPS_PUBLIC_IP>
VPN_SERVER_PORT=51820
VPN_SERVER_PUBLIC_KEY=<SERVER_PUBLIC_KEY_FROM_/etc/wireguard/server.pub>
VPN_NETWORK=10.50.0.0/24
VPN_GATEWAY_IP=10.50.0.1
VPN_DNS_SERVER=10.50.0.1,1.1.1.1
VPN_INTERFACE=wg0

# Use 'system' driver in production to control real kernel interface
WIREGUARD_DRIVER=system

# Resource Limits
MAX_DEVICES_PER_USER=2
MONTHLY_BANDWIDTH_GB=50
MAX_ACTIVE_SESSIONS=2

# Admin Initialization
ADMIN_EMAIL=admin@yourdomain.in
ADMIN_INITIAL_PASSWORD=YOUR_STRONG_ADMIN_PASSWORD
```

### Step 2: Build & Start Services with Docker Compose
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 4. End-to-End Verification Test Plan

From a client machine outside India (e.g., student laptop in Moscow, Russia):

1. **Login & Device Creation**:
   - Navigate to `https://yourdomain.in`.
   - Register a student account and log in.
   - Click **Add Device** -> name the device "Student Laptop".
   - Download the `.conf` file (or scan the QR code using the official WireGuard Android/iOS app).

2. **Handshake & Routing Verification**:
   - Activate the tunnel in WireGuard.
   - Run in the client terminal:
     ```bash
     curl https://api.ipify.org
     curl https://ipinfo.io/json
     ```
   - **Expected Result**:
     - The returned IP must match `<YOUR_INDIAN_VPS_PUBLIC_IP>`.
     - `country` must report `IN` (India).
     - `region` should report `Maharashtra` / `Karnataka` / `Telangana`.

3. **Verify Disconnection & Revocation**:
   - Deactivate tunnel -> Traffic immediately reverts to local ISP.
   - In BharatTunnel dashboard, click **Revoke Device**.
   - Reactivate tunnel -> No packets forward; handshake fails.
