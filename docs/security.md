# BharatTunnel Security & Threat Model 🇮🇳

## 1. Security Philosophy

BharatTunnel adheres to a strict set of security axioms:
1. **Never roll your own cryptography**: All tunnel encryption, key exchange, and encapsulation are delegated directly to the kernel-level **WireGuard** implementation (`Curve25519`, `ChaCha20-Poly1305`, `BLAKE2s`).
2. **Control Plane vs Data Plane Isolation**: The web API never touches or inspects raw IP packets or client payload traffic. It only modifies WireGuard peer membership and reads operational counters.
3. **Command Injection Immunity**: All interactions with the host operating system utilize parameterized system calls (`execFile`) with strict argument arrays and alphanumeric/base64 whitelisting.

---

## 2. Threat Analysis & Mitigations

### 2.1. Command Injection (High Risk in VPN Control Planes)
- **Vulnerability**: Many VPN management panels execute shell commands like `exec("wg set wg0 peer " + userProvidedKey)`. An attacker crafting a malicious device name or public key could execute arbitrary shell commands with root privileges.
- **BharatTunnel Mitigation**:
  - `child_process.execFile` is strictly invoked with `shell: false`. Shell metacharacters (`|`, `;`, `&`, `$`, `` ` ``, `\n`) are treated as literal characters and cannot trigger subshells.
  - Public keys are validated with the strict regex: `^[A-Za-z0-9+/]{43}=$`.
  - Device names are validated with `^[a-zA-Z0-9_\-. ]{2,50}$`.
  - IP addresses are validated with `IPV4_REGEX` and checked against the subnet bounds before any command is constructed.

### 2.2. Insecure Direct Object References (IDOR)
- **Vulnerability**: A malicious user attempts to view, download, or revoke another user's device configuration by guessing sequential IDs or UUIDs.
- **BharatTunnel Mitigation**:
  - All database lookups for devices and peer configurations enforce a composite query:
    ```typescript
    prisma.device.findFirst({
      where: {
        id: requestedDeviceId,
        userId: authenticatedSession.userId, // Mandatory tenant constraint
      }
    });
    ```
  - Admin endpoints require explicit `role === 'ADMIN'` claims verified by JWT signature and active database check.

### 2.3. Private Key Exposure
- **Vulnerability**: Storing client private keys server-side creates a high-value target for exfiltration. Logging private keys exposes them to log management tools and observability pipelines.
- **BharatTunnel Mitigation**:
  - Client key generation is supported on both the client (ideal) and server (MVP convenience).
  - When keys are generated server-side for convenience, the client private key is returned **once** in the creation response and is **never** logged to disk, stdout, or application log files.
  - Sensitive HTTP headers (`Authorization`, `Cookie`) and payload keys (`password`, `privateKey`) are automatically redacted by the Fastify logging serializer.

### 2.4. Credential Storage & Authentication
- **Password Hashing**: Uses **Argon2id** (the winner of the Password Hashing Competition) with parameters configured to defeat GPU and ASIC cracking:
  - Memory cost: 65,536 KiB (64 MiB)
  - Time cost: 3 iterations
  - Parallelism: 4 threads
- **Stateless Tokens with Database-Backed Revocation**: Short-lived JWT access tokens (15 minutes) paired with cryptographically secure session records in PostgreSQL that can be instantly revoked upon suspicious activity.

### 2.5. Denial of Service & Abuse Mitigation
- **Device Quotas**: Default limit of 2 active devices per student account (configurable).
- **Bandwidth Quotas**: Monthly quota of 50 GB per account. Traffic is polled from WireGuard byte counters (`transferRx` + `transferTx`) and accounts exceeding the quota are flagged.
- **Rate Limiting**:
  - Authentication endpoints: 5 attempts per minute per IP.
  - Device creation: 10 requests per hour per user.
  - General API: 60 requests per minute per IP.
- **Administrative Suspension**: Admins can immediately suspend an account, which revokes all WireGuard peers from the live kernel interface within milliseconds.

---

## 3. Privacy Policy & Zero-History Architecture

BharatTunnel was built specifically for students who need legitimate access to Indian services while abroad:
- **What We NEVER Collect or Store**:
  - Visited URLs or IP destinations
  - Payload contents or HTTP headers
  - DNS query logs
  - Browsing timelines
- **What Operational Data We Retain**:
  - Account email & name (for authentication)
  - Assigned WireGuard tunnel IP (for collision-free routing)
  - Device name (chosen by student)
  - Cumulative transfer counters (RX/TX bytes) to enforce the 50 GB fair-use quota
  - Timestamp of latest WireGuard cryptographic handshake (to determine active vs stale peers)
