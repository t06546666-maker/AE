# Security & Compliance Model - Sharon Settlement Engine

## Security Principles
1. **No Custodial Access**: Engine never handles bank passwords, UPI PINs, or raw customer funds.
2. **Minimal PII Collection**: Stores only phone number, name, and optional UPI ID.
3. **Idempotency Enforcement**: Every financial operation requires a unique `idempotency_key` to prevent double spending and duplicate transactions.
4. **Network Isolation Safeguard**: Transactions, merchants, and redemptions are hard-bound to single networks. Cross-network execution is blocked.
5. **Immutable Financial History**: Destructive updates of ledger entries are forbidden; corrections are recorded via explicit reversal events.
