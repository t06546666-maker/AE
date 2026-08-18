import { Request, Response } from 'express';
import { AuditService } from './audit.service';

export class AuditController {
  static getHistory(req: Request, res: Response): void {
    try {
      const logs = AuditService.getAuditHistory(req.params.entity, req.params.id);
      res.json({ success: true, data: logs });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
