import { Request, Response } from 'express';
import { RedemptionsService } from './redemptions.service';

export class RedemptionsController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await RedemptionsService.requestRedemption(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static get(req: Request, res: Response): void {
    try {
      const redemption = RedemptionsService.getRedemption(req.params.id);
      const allocations = RedemptionsService.getRedemptionAllocations(redemption.id);
      res.json({ success: true, data: { redemption, allocations } });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
