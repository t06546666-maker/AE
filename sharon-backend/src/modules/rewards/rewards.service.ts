import { RewardLot } from '../../common/types';
import { db } from '../../database/db';
import { CustomersService } from '../customers/customers.service';
import { NetworksService } from '../networks/networks.service';

export class RewardsService {
  static getCustomerRewardSummary(customerId: string): {
    customer_id: string;
    network_id: string;
    total_available_paise: number;
    total_reserved_paise: number;
    total_lifetime_paise: number;
    is_redemption_eligible: boolean;
    min_redemption_threshold_paise: number;
  } {
    const customer = CustomersService.getCustomer(customerId);
    const network = NetworksService.getNetwork(customer.network_id);

    let totalAvailablePaise = 0;
    let totalReservedPaise = 0;
    let totalLifetimePaise = 0;

    for (const lot of db.rewardLots.values()) {
      if (lot.customer_id === customerId) {
        totalLifetimePaise += lot.initial_amount_paise;
        if (lot.status === 'AVAILABLE') {
          totalAvailablePaise += lot.available_amount_paise;
        } else if (lot.status === 'RESERVED') {
          totalReservedPaise += lot.available_amount_paise;
        }
      }
    }

    const minThreshold = network.min_redemption_threshold_paise;
    const isEligible = totalAvailablePaise >= minThreshold;

    return {
      customer_id: customerId,
      network_id: customer.network_id,
      total_available_paise: totalAvailablePaise,
      total_reserved_paise: totalReservedPaise,
      total_lifetime_paise: totalLifetimePaise,
      is_redemption_eligible: isEligible,
      min_redemption_threshold_paise: minThreshold
    };
  }

  static getCustomerRewardLots(customerId: string): RewardLot[] {
    CustomersService.getCustomer(customerId);
    const lots: RewardLot[] = [];
    for (const lot of db.rewardLots.values()) {
      if (lot.customer_id === customerId) {
        lots.push(lot);
      }
    }
    // Return in chronological order
    return lots.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
}
