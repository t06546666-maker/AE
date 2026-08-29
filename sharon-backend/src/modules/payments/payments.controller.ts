import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';

export class PaymentsController {
  static async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const instruction = await PaymentsService.handleCallback(req.body);
      res.json({ success: true, data: instruction });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static getInstruction(req: Request, res: Response): void {
    try {
      const inst = PaymentsService.getInstruction(req.params.id);
      res.json({ success: true, data: inst });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static async createSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { merchant_id } = req.body;
      const { MerchantPaymentsService } = require('./merchant-payments.service');
      const subscription = await MerchantPaymentsService.createSubscription(merchant_id);
      res.json({ success: true, data: subscription });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
