import { Request, Response } from 'express';
import { VouchersService } from './vouchers.service';

export class VouchersController {
  static async issue(req: Request, res: Response): Promise<void> {
    try {
      const voucher = await VouchersService.issueVoucher(req.body);
      res.status(201).json({ success: true, data: voucher });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static get(req: Request, res: Response): void {
    try {
      const voucher = VouchersService.getVoucher(req.params.id);
      res.json({ success: true, data: voucher });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static redeem(req: Request, res: Response): void {
    try {
      const result = VouchersService.redeemVoucher({
        voucher_id: req.params.id,
        ...req.body
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
