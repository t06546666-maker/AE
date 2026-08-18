import { Request, Response } from 'express';
import { TransactionsService } from './transactions.service';

export class TransactionsController {
  static create(req: Request, res: Response): void {
    try {
      const result = TransactionsService.processTransaction(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static get(req: Request, res: Response): void {
    try {
      const tx = TransactionsService.getTransaction(req.params.id);
      res.json({ success: true, data: tx });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
