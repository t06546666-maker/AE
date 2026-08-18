import { Request, Response } from 'express';
import { RefundsService } from './refunds.service';

export class RefundsController {
  static create(req: Request, res: Response): void {
    try {
      const result = RefundsService.processRefund(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
