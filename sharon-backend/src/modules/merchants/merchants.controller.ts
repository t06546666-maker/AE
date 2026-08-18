import { Request, Response } from 'express';
import { MerchantsService } from './merchants.service';

export class MerchantsController {
  static create(req: Request, res: Response): void {
    try {
      const merchant = MerchantsService.createMerchant(req.body);
      res.status(201).json({ success: true, data: merchant });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static get(req: Request, res: Response): void {
    try {
      const merchant = MerchantsService.getMerchant(req.params.id);
      res.json({ success: true, data: merchant });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static updateStatus(req: Request, res: Response): void {
    try {
      const { status } = req.body;
      const merchant = MerchantsService.updateStatus(req.params.id, status);
      res.json({ success: true, data: merchant });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static list(req: Request, res: Response): void {
    try {
      const { network_id } = req.query;
      const merchants = MerchantsService.listMerchants(network_id as string);
      res.json({ success: true, data: merchants });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
