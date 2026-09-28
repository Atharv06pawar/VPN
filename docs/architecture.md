# BharatTunnel Architecture 🇮🇳

## 1. Executive Summary & Objective

**BharatTunnel** is a production-oriented India-exit VPN service engineered primarily for Indian students and expatriates living abroad (initially students in Russia and neighboring regions) who need legitimate access to Indian digital resources, academic portals, banking/government services, and internet platforms that require an Indian IP address.

### Core Architecture Philosophy
1. **Never reinvent cryptography or VPN protocols**: We strictly use the battle-tested, kernel-level **WireGuard** protocol and modern Linux networking (`nftables` / `iptables`, kernel IP forwarding).
2. **Clear separation of concerns**:
   - **Data Plane**: WireGuard (`wg0`) running in the Linux kernel handling cryptographic encapsulation (`ChaCha20-Poly1305`), key exchange (`Curve25519`), and line-rate packet forwarding.
   - **Control Plane**: The BharatTunnel application suite (Next.js web client, Fastify/Node.js REST API, Prisma ORM, and WireGuard Gateway Manager) managing identity, device quotas, peer provisioning, IP address allocation, and telemetry.
3. **Strict Privacy**:
   - Zero storage or inspection of packet destinations, visited URLs, DNS queries, or payload contents.
   - Telemetry is restricted to operational metrics: peer handshake timestamps, aggregate transfer bytes (RX/TX), and server resource utilization.
4. **Command Injection Immunity**:
   - Operating system commands are never executed via arbitrary shell string interpolation (`exec("wg ...")`).
   - All system invocations utilize validated, parameterized argument arrays (`execFile` / `spawn`) with strict alphanumeric/base64 whitelisting.

---

## 2. High-Level System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       Client Device                         │
│  (Official WireGuard Client on Android, iOS, Windows, macOS) │
└──────────────────────────────┬──────────────────────────────┘
                               │
            1. REST API (HTTPS)│ 2. WireGuard Tunnel (UDP:51820)
            [Auth / Peer Mgmt] │    [Encrypted Tunnel / AllowedIPs]
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────┐             ┌───────────────────────┐
│     Control Plane     │             │      Data Plane       │
│  BharatTunnel Web/API │             │  India VPN Gateway    │
│  (Next.js + Fastify)  │             │   (Linux Kernel)      │
└───────────┬───────────┘             └───────────┬───────────┘
            │                                     │
            ▼                                     ▼
┌───────────────────────┐             ┌───────────────────────┐
│      PostgreSQL       │             │    Network Stack      │
│  Users, Devices, IPs, │             │  wg0 (10.50.0.1/24)   │
│  Peers, Audit Logs    │             │  NAT / nftables       │
└───────────────────────┘             └───────────┬───────────┘
                                                  │
                                                  ▼
                                      ┌───────────────────────┐
                                      │   Indian Internet     │
                                      │ (Exits with Indian IP)│
                                      └───────────────────────┘
```

---

## 3. Monorepo Organization

```text
bharattunnel/
├── apps/
│   ├── web/                    # Next.js 14+ / React UI (Tailwind CSS, Dashboard, Admin, QR Code viewer)
│   └── api/                    # Fastify REST API backend (TypeScript, Zod, Argon2id, JWT)
├── packages/
│   ├── shared/                 # Shared types, Zod schemas, constants, error models
│   ├── config/                 # Centralized configuration & environment loader
│   └── wireguard/              # WireGuard manager, IP allocator, safe process executor, keygen
├── infrastructure/
│   ├── docker/                 # Container definitions for local dev and gateway deployment
│   ├── gateway/                # Production Ubuntu/Debian gateway automation scripts
│   └── scripts/                # Database migration, backup, and health check scripts
├── docs/                       # Architecture, Deployment, Security, Operations, Development
├── tests/                      # Unit, Integration, and Security test suites
├── docker-compose.yml          # Local container orchestration
├── .env.example                # Sample environment configurations
└── README.md
```

---

## 4. Subsystem Specifications

### 4.1. Identity & Access Management (IAM)
- **Password Security**: Argon2id with memory cost = 65536, time cost = 3, parallelism = 4.
- **Session Tokens**: Cryptographically signed stateless JWTs with short expiry (15m access tokens) and revocable refresh tokens / database-backed sessions.
- **Roles**:
  - `USER`: Can manage own devices up to `MAX_DEVICES_PER_USER` (default 2), view bandwidth, download own configs.
  - `ADMIN`: Access to `/admin`, can inspect gateway health, view aggregate metrics, suspend users, revoke devices/peers, view audit logs.

### 4.2. Device & WireGuard Peer Lifecycle
```text
User initiates "Add Device"
            │
            ▼
[API Server validates request & checks device count <= MAX_DEVICES_PER_USER]
            │
            ▼
[IP Allocator claims next available IP in CIDR (e.g. 10.50.0.2)]
            │
            ▼
[Key Generation: Curve25519 PrivateKey + PublicKey generated]
            │
            ▼
[WireGuard Manager executes safe command: wg set wg0 peer <PubKey> allowed-ips <TunnelIP>/32]
            │
            ▼
[Record persisted in PostgreSQL: Device, VpnPeer, IpAllocation within transaction]
            │
            ▼
[Client Configuration (.conf & QR Code payload) generated and returned to user]
            │
            ▼
[User imports into WireGuard app -> Initiates handshake -> Tunnel Active]
```

### 4.3. IP Address Management (IPAM)
- Network: Configurable via `VPN_NETWORK` (default: `10.50.0.0/24`).
- Gateway Tunnel IP: `10.50.0.1/32` (reserved).
- Usable Client Range: `10.50.0.2` to `10.50.0.254` (for `/24`).
- Thread-safe IP allocation with database row locks (`SELECT FOR UPDATE`) to prevent race conditions during concurrent device creation.
- Reclaimed IPs are marked `RELEASED` upon peer revocation and returned to the free pool.

### 4.4. WireGuard Manager Driver Architecture
The WireGuard module implements an adapter pattern (`IWireGuardDriver`):
1. **`SystemWireGuardDriver`**: Used in production on Linux. Calls `/usr/bin/wg` safely via `execFile` with argument arrays.
2. **`MockWireGuardDriver`**: Used in local development and automated CI testing where the Linux kernel WireGuard module or root permissions are absent. Tracks state in-memory and mirrors production behavior faithfully.

### 4.5. Telemetry & Bandwidth Accounting
- Periodic sync task polls WireGuard gateway metrics (`wg show wg0 transfer`, `wg show wg0 latest-handshakes`).
- Maps peer public keys back to `VpnPeer` and `User` records.
- Updates cumulative `bytesRx` and `bytesTx`.
- Flags accounts exceeding `MONTHLY_BANDWIDTH_GB` (default: 50GB) and notifies the control plane to suspend or throttle the peer.

---

## 5. Security & Threat Modeling

| Threat | Impact | Mitigation Strategy |
|---|---|---|
| **Command Injection** | Remote code execution on gateway | Strict regex validation (`/^[A-Za-z0-9+/=]{44}$/` for keys, strict IPv4 regex for IPs). No `sh -c` or `exec()`. Safe `execFile()` with fixed executable paths. |
| **Privilege Escalation** | Attacker compromises API and gains root | API runs under unprivileged `bharattunnel` user. WireGuard modifications utilize either `sudo` with restricted `/etc/sudoers` command whitelist or a dedicated local IPC daemon. |
| **Private Key Exposure** | VPN traffic decryption | Client private keys are delivered to the user during creation and are never logged. Server logs redact all Authorization headers, tokens, and keys. |
| **Cross-User IDOR** | User modifies or revokes another user's device | Scoped database queries enforcing `WHERE userId = :authUserId` across all device endpoints. |
| **Abuse & Denial of Service** | Network flooding, resource exhaustion | Device caps per user (max 2), IP rate limiting on auth endpoints (5 req/min), monthly transfer quotas (50GB), and immediate admin suspension controls. |
| **DNS Leaking** | ISP sees DNS queries | Config enforces `DNS = 10.50.0.1` (local gateway Unbound/CoreDNS) or verified non-logging Indian DNS resolvers. |
| **IPv6 Leaking** | Traffic bypasses IPv4 tunnel | Explicitly routed or disabled in firewall if native IPv6 egress is not configured on the Indian VPS. |

---

## 6. Future Multi-Region Topology

While the MVP targets a single Indian Gateway (Mumbai-1), the database and driver models cleanly decouple the gateway entity from peers:
```text
┌─────────────────┐
│  Control Plane  │
└────────┬────────┘
         ├── (Heartbeat / Sync) ──> Gateway 1: Mumbai (10.50.0.0/24)
         ├── (Heartbeat / Sync) ──> Gateway 2: Bengaluru (10.51.0.0/24)
         └── (Heartbeat / Sync) ──> Gateway 3: Hyderabad (10.52.0.0/24)
```
Each gateway registers its public endpoint, capacity, and active peer counts. The control plane can dynamically assign users to the nearest or least-loaded Indian region.
