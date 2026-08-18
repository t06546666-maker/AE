import { randomUUID } from 'crypto';
import { Customer } from '../../common/types';
import { db } from '../../database/db';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { NetworksService } from '../networks/networks.service';

export class CustomersService {
  static createCustomer(data: {
    id?: string;
    network_id: string;
    phone: string;
    name: string;
    upi_id?: string;
  }): Customer {
    if (!data.network_id || !data.phone || !data.name) {
      throw new ValidationError('network_id, phone, and name are required.');
    }

    // Verify network exists
    NetworksService.getNetwork(data.network_id);

    // Check unique customer phone in network
    for (const cust of db.customers.values()) {
      if (cust.network_id === data.network_id && cust.phone === data.phone) {
        throw new ConflictError(`Customer with phone '${data.phone}' already exists in network '${data.network_id}'.`);
      }
    }

    const customer: Customer = {
      id: data.id || randomUUID(),
      network_id: data.network_id,
      phone: data.phone,
      name: data.name,
      upi_id: data.upi_id,
      created_at: new Date().toISOString()
    };

    db.customers.set(customer.id, customer);
    return customer;
  }

  static getCustomer(id: string): Customer {
    const customer = db.customers.get(id);
    if (!customer) {
      throw new NotFoundError(`Customer '${id}' not found.`);
    }
    return customer;
  }

  static listCustomers(network_id?: string): Customer[] {
    const list = Array.from(db.customers.values());
    if (network_id) {
      return list.filter(c => c.network_id === network_id);
    }
    return list;
  }
}
