import { Request, Response } from 'express';
import { ReconciliationService } from './reconciliation.service';

export class ReconciliationController {
  static getStatus(req: Request, res: Response): void {
    try {
      const status = ReconciliationService.getReconciliationStatus(req.params.id);
      res.json({ success: true, data: status });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
