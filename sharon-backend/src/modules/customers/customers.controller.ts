import { Request, Response } from 'express';
import { CustomersService } from './customers.service';

export class CustomersController {
  static create(req: Request, res: Response): void {
    try {
      const customer = CustomersService.createCustomer(req.body);
      res.status(201).json({ success: true, data: customer });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static get(req: Request, res: Response): void {
    try {
      const customer = CustomersService.getCustomer(req.params.id);
      res.json({ success: true, data: customer });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static list(req: Request, res: Response): void {
    try {
      const { network_id } = req.query;
      const customers = CustomersService.listCustomers(network_id as string);
      res.json({ success: true, data: customers });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
