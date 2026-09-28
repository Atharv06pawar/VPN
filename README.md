# BharatTunnel 🇮🇳

> **Production-Oriented India-Exit WireGuard VPN Service & Control Plane**  
> Engineered specifically for Indian students and expatriates living abroad (initially Russia and neighboring regions) who require encrypted, legitimate access to Indian digital resources, academic portals, banking, and government platforms with an authentic Indian public IPv4 address.

[![CI](https://github.com/bharattunnel/bharattunnel/actions/workflows/ci.yml/badge.svg)](https://github.com/bharattunnel/bharattunnel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WireGuard](https://img.shields.io/badge/VPN-WireGuard-88171a.svg)](https://www.wireguard.com/)

---

## 1. Core Architecture

BharatTunnel adheres to a strict architectural rule: **Never implement custom cryptography or proprietary VPN protocols.**

- **Data Plane**: Linux Kernel **WireGuard** (`wg0`) running state-of-the-art `Curve25519` key exchange and `ChaCha20-Poly1305` authenticated encryption.
- **Control Plane**: Modern TypeScript monorepo providing tenant authentication, IP address allocation, device provisioning, QR code generation, bandwidth quota enforcement, and administrative governance.

```text
User Device (Phone/Laptop)
           │
           │ WireGuard Encrypted Tunnel (UDP:51820)
           ▼
BharatTunnel India Gateway (Mumbai-1)
           │
           │ nftables NAT Masquerade
           ▼
Indian Internet (Verified Indian Public IP)
```

---

## 2. Key Capabilities & Features

- **Standard WireGuard Compatibility**: Directly compatible with the official WireGuard clients on Android, iOS, Windows, macOS, and Linux via downloadable `.conf` files and mobile QR codes.
- **Zero Browsing Activity Logs**: We collect zero browsing history, visited URLs, or DNS query logs. Telemetry is restricted to operational metrics (bytes transferred, handshake timestamp, gateway CPU/RAM).
- **Collision-Free IP Address Management (IPAM)**: Subnet IP allocator with database row-level locking (`10.50.0.0/24`) that automatically allocates and reclaims tunnel IPs upon device revocation.
- **Command Injection Immunity**: All interactions with the host Linux system use parameterized argument arrays (`execFile` with `shell: false`) with strict alphanumeric/base64 whitelisting. Shell string interpolation is strictly prohibited.
- **Argon2id Authentication**: Password security backed by Argon2id (64 MiB memory cost, 3 iterations, 4 parallelism threads).
- **Fair-Share Quota**: 50 GB / month per account and a configurable limit of 2 devices per student to prevent network abuse.
- **Admin Control Center (`/admin`)**: Real-time server telemetry (CPU, RAM, Disk, WireGuard state, network throughput), user suspension (which immediately drops active kernel tunnels), device revocation, and audit logging.

---

## 3. Monorepo Organization

```text
bharattunnel/
├── apps/
│   ├── web/                    # Next.js 14 / React 18 / Tailwind CSS web application
│   └── api/                    # Fastify REST API, Prisma ORM, Argon2id, JWT auth
├── packages/
│   ├── shared/                 # Domain types, Zod validation schemas, constants
│   ├── config/                 # Typed environment configuration loader
│   └── wireguard/              # WireGuard manager, RFC 7748 keygen, IP allocator, safe-exec
├── infrastructure/
│   ├── docker/                 # Multi-stage production Dockerfiles for API and Web
│   ├── gateway/                # Ubuntu/Debian server bootstrap, nftables firewall, health checks
│   └── scripts/                # Database migrations and backup scripts
├── docs/
│   ├── architecture.md         # Detailed architectural specification & threat model
│   ├── development.md          # Local developer setup and Mock driver guide
│   ├── deployment.md           # Production cloud VPS setup and acceptance testing
│   ├── security.md             # Security audit, injection defenses, and privacy model
│   └── operations.md           # Runbook, monitoring, key rotation, and disaster recovery
├── tests/                      # Unit, integration, and security test suites
├── docker-compose.yml          # Container orchestration for PostgreSQL, API, and Web
├── .env.example                # Sample environment configurations
└── README.md
```

---

## 4. Quickstart (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/bharattunnel/bharattunnel.git
cd bharattunnel
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*Note: In local development, `WIREGUARD_DRIVER=mock` allows developing and testing without requiring Linux kernel or root privileges.*

### 3. Run Test Suite
```bash
npm run test
```
Runs 33 automated tests covering:
- IP arithmetic & collision prevention
- Curve25519 key generation & RFC 7748 clamping
- WireGuard configuration & QR code generation
- Command injection attack fuzzing
- Logging credential redaction
- Device lifecycle & IP reclamation

### 4. Start Development Servers
```bash
# Terminal 1: Fastify REST API (http://localhost:4000)
npm run dev:api

# Terminal 2: Next.js Frontend Dashboard (http://localhost:3000)
npm run dev:web
```

---

## 5. Production Gateway Deployment

To deploy the gateway on an Indian VPS (Ubuntu 22.04/24.04 in Mumbai / Bengaluru):

```bash
# 1. Run automated gateway bootstrap (installs WireGuard & configures sysctl)
sudo ./infrastructure/gateway/bootstrap-gateway.sh

# 2. Configure nftables firewall and NAT masquerade
sudo ./infrastructure/gateway/configure-firewall.sh

# 3. Check gateway health
sudo ./infrastructure/gateway/health-check.sh
```

See [docs/deployment.md](docs/deployment.md) for step-by-step cloud production instructions.

---

## 6. Honest Technical Limitations

- **Not &quot;100% Anonymous&quot;**: WireGuard traffic is encrypted and authenticated, but network operators can see you are connecting to an Indian IP address over UDP port 51820.
- **No Law-Breaking or Abuse**: BharatTunnel includes rate limiting, administrative revocation, and abuse reporting. It is intended strictly for legitimate educational, academic, and personal connectivity by Indian students abroad.
- **Port Forwarding**: Inbound port forwarding from the public internet into client devices is disabled by default for student security.

---

## 7. License

Released under the [MIT License](LICENSE). WireGuard is a registered trademark of Jason A. Donenfeld.
