import { randomUUID } from 'crypto';
import { BankDetails, Merchant, MerchantStatus } from '../../common/types';
import { db } from '../../database/db';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { NetworksService } from '../networks/networks.service';

export class MerchantsService {
  static createMerchant(data: {
    id?: string;
    network_id: string;
    code: string;
    name: string;
    bank_details: BankDetails;
    reward_rate_bps?: number;
    status?: MerchantStatus;
  }): Merchant {
    if (!data.network_id || !data.code || !data.name) {
      throw new ValidationError('network_id, code, and name are required.');
    }

    // Verify network exists
    NetworksService.getNetwork(data.network_id);

    // Check unique merchant code within network
    for (const m of db.merchants.values()) {
      if (m.network_id === data.network_id && m.code === data.code) {
        throw new ConflictError(`Merchant with code '${data.code}' already exists in network '${data.network_id}'.`);
      }
    }

    const merchant: Merchant = {
      id: data.id || data.code || randomUUID(),
      network_id: data.network_id,
      code: data.code,
      name: data.name,
      status: data.status || 'APPROVED',
      bank_details: data.bank_details || {
        account_number: '1234567890',
        ifsc: 'SBIN0000001',
        account_holder_name: data.name
      },
      reward_rate_bps: data.reward_rate_bps,
      created_at: new Date().toISOString()
    };

    db.merchants.set(merchant.id, merchant);
    return merchant;
  }

  static getMerchant(id: string): Merchant {
    let merchant = db.merchants.get(id);
    if (!merchant) {
      for (const m of db.merchants.values()) {
        if (m.code === id) {
          merchant = m;
          break;
        }
      }
    }
    if (!merchant) {
      throw new NotFoundError(`Merchant '${id}' not found.`);
    }
    return merchant;
  }

  static updateStatus(id: string, status: MerchantStatus): Merchant {
    const merchant = this.getMerchant(id);
    merchant.status = status;
    db.merchants.set(merchant.id, merchant);
    return merchant;
  }

  static listMerchants(network_id?: string): Merchant[] {
    const list = Array.from(db.merchants.values());
    if (network_id) {
      return list.filter(m => m.network_id === network_id);
    }
    return list;
  }
}
