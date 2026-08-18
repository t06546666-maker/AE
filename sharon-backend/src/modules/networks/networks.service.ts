import { randomUUID } from 'crypto';
import { Network } from '../../common/types';
import { db } from '../../database/db';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { Config } from '../../config';

export class NetworksService {
  static createNetwork(data: {
    id?: string;
    code: string;
    name: string;
    currency?: 'INR';
    reward_rate_bps?: number;
    min_redemption_threshold_paise?: number;
  }): Network {
    if (!data.code || !data.name) {
      throw new ValidationError('Network code and name are required.');
    }

    // Check code uniqueness
    for (const net of db.networks.values()) {
      if (net.code === data.code) {
        throw new ConflictError(`Network with code '${data.code}' already exists.`);
      }
    }

    const network: Network = {
      id: data.id || data.code || randomUUID(),
      code: data.code,
      name: data.name,
      currency: data.currency || Config.defaultCurrency,
      reward_rate_bps: data.reward_rate_bps ?? Config.defaultRewardRateBps,
      min_redemption_threshold_paise:
        data.min_redemption_threshold_paise ?? Config.defaultMinRedemptionThresholdPaise,
      created_at: new Date().toISOString()
    };

    db.networks.set(network.id, network);
    return network;
  }

  static getNetwork(idOrCode: string): Network {
    let network = db.networks.get(idOrCode);
    if (!network) {
      for (const net of db.networks.values()) {
        if (net.code === idOrCode) {
          network = net;
          break;
        }
      }
    }

    if (!network) {
      throw new NotFoundError(`Network '${idOrCode}' not found.`);
    }

    return network;
  }

  static listNetworks(): Network[] {
    return Array.from(db.networks.values());
  }
}
