# Weekly Settlement & Netting Engine Specification

## Overview
Sharon executes automated weekly settlement cycle runs per network (e.g. `PALAKKAD-001`).

## Workflow Steps
1. **Period Closure & Freeze**: Closes period at Sunday 23:59:59 and sets status `FROZEN`.
2. **Redemption Lot Allocation Aggregation**: Examines all completed redemptions (Voucher & UPI Payout).
3. **Proportional Obligations Calculation**:
   - Every redeemed lot maps back to its `funding_merchant_id`.
   - Obligation is proportional to exact reward contribution, NOT split equally.
4. **Netting Algorithm**:
   $$\text{Net Amount} = \text{Total Receivables} - \text{Total Payables}$$
   - If $\text{Net Amount} > 0$: Merchant is in `RECEIVE` position.
   - If $\text{Net Amount} < 0$: Merchant is in `PAY` position ($\text{Math.abs}(\text{Net})$).
5. **Mandatory Reconciliation Guardrail**:
   $$\sum \text{Payables} == \sum \text{Receivables}$$
   If balanced -> Release Batch & generate Payment Instructions.
   If unbalanced -> Mark `RECONCILIATION_FAILED` and block settlement batch.
