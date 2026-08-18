import { Request, Response } from 'express';
import { NetworksService } from './networks.service';

export class NetworksController {
  static create(req: Request, res: Response): void {
    try {
      const network = NetworksService.createNetwork(req.body);
      res.status(201).json({ success: true, data: network });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static get(req: Request, res: Response): void {
    try {
      const network = NetworksService.getNetwork(req.params.id);
      res.json({ success: true, data: network });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }

  static list(req: Request, res: Response): void {
    try {
      const networks = NetworksService.listNetworks();
      res.json({ success: true, data: networks });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
  }
}
