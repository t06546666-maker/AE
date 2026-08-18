# Sharon Settlement Engine REST API Documentation

## Endpoints Summary

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/networks` | Create a new Sharon Network |
| `GET` | `/api/networks/:id` | Get network details |
| `POST` | `/api/merchants` | Register a merchant |
| `PATCH` | `/api/merchants/:id/status` | Approve or suspend merchant |
| `POST` | `/api/customers` | Register customer profile |
| `POST` | `/api/transactions` | Submit customer purchase transaction (Idempotent) |
| `GET` | `/api/customers/:id/rewards` | Query customer aggregate reward balance |
| `GET` | `/api/customers/:id/reward-lots` | Query source-level reward lots |
| `POST` | `/api/redemptions` | Request UPI payout or Network Voucher redemption |
| `POST` | `/api/vouchers` | Issue Network Voucher |
| `POST` | `/api/vouchers/:id/redeem` | Redeem voucher at merchant |
| `POST` | `/api/settlements/run` | Run weekly settlement cycle for network |
| `GET` | `/api/networks/:id/reconciliation` | Query network reconciliation status |
| `POST` | `/api/payment-callbacks` | Payment provider callback handler |
| `GET` | `/api/audit/:entity/:id` | Query audit trail for entity |
