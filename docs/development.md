# BharatTunnel Development Guide 🇮🇳

This guide details how to set up, run, and develop **BharatTunnel** locally.

---

## 1. Prerequisites

- **Node.js**: `v20.0.0` or later (tested on `v22.x`)
- **npm**: `v10.0.0` or later
- **Docker & Docker Compose** (Optional for containerized PostgreSQL, or use a local PostgreSQL instance)
- **Git**

> **Note on Windows / macOS Development**:
> You do **not** need a Linux kernel or root privileges to develop BharatTunnel locally. The project includes a high-fidelity `MockWireGuardDriver` that simulates peer additions, handshakes, transfer metrics, and IP allocation entirely in-memory.

---

## 2. Quickstart

### Step 1: Clone and Install
```bash
git clone https://github.com/bharattunnel/bharattunnel.git
cd bharattunnel
npm install
```

### Step 2: Configure Environment
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Key development settings in `.env`:
- `WIREGUARD_DRIVER=mock` (enables mock driver for local testing)
- `DATABASE_URL=postgresql://bharat:tunnel_secret@localhost:5432/bharattunnel?schema=public`

### Step 3: Start Database (via Docker or local PostgreSQL)
If using Docker:
```bash
docker compose up -d postgres
```

### Step 4: Run Prisma Migrations and Seed
```bash
cd apps/api
npx prisma migrate dev --name init
npm run db:seed
```
This provisions:
- Admin account: `admin@bharattunnel.in` (password configured in `.env`)
- Default Gateway record: `BharatTunnel India Gateway (Mumbai-1)`

### Step 5: Start the Development Servers
In two separate terminals:
```bash
# Terminal 1: Fastify Backend API (runs on http://localhost:4000)
npm run dev:api

# Terminal 2: Next.js Frontend Dashboard (runs on http://localhost:3000)
npm run dev:web
```

---

## 3. Monorepo Structure

```text
bharattunnel/
├── apps/
│   ├── api/             # Fastify REST API, Prisma schema, auth, device endpoints
│   └── web/             # Next.js 14 App Router, Tailwind CSS, Lucide UI
├── packages/
│   ├── shared/          # Domain types, Zod schemas, constants, error models
│   ├── config/          # Centralized configuration & environment loader
│   └── wireguard/       # WireGuard manager, IP allocator, safe-exec, keygen
├── infrastructure/      # Gateway shell scripts, Dockerfiles, compose
├── docs/                # Architecture, security, deployment, operations
└── tests/               # Unit, integration, and security test suites
```

---

## 4. Running Tests

Run all test suites:
```bash
npm run test
```

Or run targeted suites:
```bash
# Unit tests (IP allocator, Curve25519 keygen, config generation, validation)
npm run test:unit

# Integration tests (User registration, device provisioning, IP allocation lifecycle)
npm run test:integration

# Security tests (Command injection fuzzing, IDOR prevention, rate limiting)
npm run test:security
```

---

## 5. Development Invariants

1. **Never use `exec()` with shell strings**: All system commands must use `safeExec` in `packages/wireguard/src/safe-exec.ts` with explicit argument arrays.
2. **Never log sensitive secrets**: Passwords, private keys, session tokens, and full client WireGuard configs must be redacted from all logger streams.
3. **Database Transactions**: Device creation and IP allocation must execute within a Prisma transaction with row locks to prevent IP race conditions.
