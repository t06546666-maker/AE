import { Request, Response } from 'express';
import { SettlementsService } from './settlements.service';

export class SettlementsController {
  static async run(req: Request, res: Response): Promise<void> {
    try {
      const result = await SettlementsService.runSettlementCycle(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static get(req: Request, res: Response): void {
    try {
      const cycle = SettlementsService.getSettlementCycle(req.params.id);
      res.json({ success: true, data: cycle });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static getMerchantPosition(req: Request, res: Response): void {
    try {
      const positions = SettlementsService.getMerchantPosition(req.params.id);
      res.json({ success: true, data: positions });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
