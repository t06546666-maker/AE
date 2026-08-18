import { ReconciliationError } from '../../common/errors';
import { Logger } from '../../common/logger';
import { MerchantLedgerPosition, SettlementCycle } from '../../common/types';
import { db } from '../../database/db';

export class ReconciliationService {
  static verifySettlementBalance(cycle: SettlementCycle, positions: MerchantLedgerPosition[]): boolean {
    let totalPayables = 0;
    let totalReceivables = 0;

    for (const pos of positions) {
      totalPayables += pos.payable_paise;
      totalReceivables += pos.receivable_paise;
    }

    cycle.total_payables_paise = totalPayables;
    cycle.total_receivables_paise = totalReceivables;

    if (totalPayables !== totalReceivables) {
      cycle.status = 'RECONCILIATION_FAILED';
      db.settlementCycles.set(cycle.id, cycle);

      const errorMsg = `Critical Reconciliation Failure: Network '${cycle.network_id}' total payables (${totalPayables} paise) does not equal total receivables (${totalReceivables} paise).`;
      Logger.error(errorMsg, null, { cycle_id: cycle.id, totalPayables, totalReceivables });
      throw new ReconciliationError(errorMsg);
    }

    cycle.status = 'RECONCILED';
    cycle.reconciled_at = new Date().toISOString();
    db.settlementCycles.set(cycle.id, cycle);
    Logger.info(`Network '${cycle.network_id}' settlement cycle '${cycle.id}' successfully reconciled. Total: ${totalPayables} paise.`);
    return true;
  }

  static getReconciliationStatus(networkId: string): {
    network_id: string;
    total_reconciled_cycles: number;
    failed_reconciliations: number;
    last_cycle?: SettlementCycle;
  } {
    const cycles = Array.from(db.settlementCycles.values()).filter(c => c.network_id === networkId);
    const reconciled = cycles.filter(c => c.status === 'RECONCILED' || c.status === 'SETTLED' || c.status === 'BATCH_GENERATED').length;
    const failed = cycles.filter(c => c.status === 'RECONCILIATION_FAILED').length;
    const lastCycle = cycles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      network_id: networkId,
      total_reconciled_cycles: reconciled,
      failed_reconciliations: failed,
      last_cycle: lastCycle
    };
  }
}
