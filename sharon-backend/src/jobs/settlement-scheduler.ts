import { SettlementsService } from '../modules/settlements/settlements.service';
import { NetworksService } from '../modules/networks/networks.service';
import { Logger } from '../common/logger';

export class SettlementSchedulerJob {
  static async runWeeklySettlementForAllNetworks(): Promise<void> {
    Logger.info('[Job] Starting weekly settlement cycle run for all networks...');
    const networks = NetworksService.listNetworks();
    for (const net of networks) {
      try {
        const result = await SettlementsService.runSettlementCycle({ network_id: net.id });
        Logger.info(`[Job] Network '${net.id}' settlement completed. Batch ID: ${result.batch?.id}`);
      } catch (err: any) {
        Logger.error(`[Job] Settlement failed for network '${net.id}'`, err);
      }
    }
  }
}
