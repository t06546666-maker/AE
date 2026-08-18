import { Request, Response } from 'express';
import { RewardsService } from './rewards.service';

export class RewardsController {
  static getCustomerRewards(req: Request, res: Response): void {
    try {
      const summary = RewardsService.getCustomerRewardSummary(req.params.id);
      res.json({ success: true, data: summary });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static getCustomerLots(req: Request, res: Response): void {
    try {
      const lots = RewardsService.getCustomerRewardLots(req.params.id);
      res.json({ success: true, data: lots });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
