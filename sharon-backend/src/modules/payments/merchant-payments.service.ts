import { randomUUID } from 'crypto';
import { db } from '../../database/db';
import { MerchantsService } from '../merchants/merchants.service';
import { ValidationError } from '../../common/errors';
import { razorpayInstance } from '../../common/razorpay';

export class MerchantPaymentsService {

  /**
   * Creates a Razorpay Subscription (Mandate) for the merchant
   */
  static async createSubscription(merchantId: string): Promise<{ id: string, entity: string, status: string, short_url: string }> {
    const merchant = MerchantsService.getMerchant(merchantId);
    
    // Hardcoded plan_id for ₹200/month. 
    // In production, this should be created on Razorpay dashboard and passed via process.env.
    const PLAN_ID = process.env.RAZORPAY_MONTHLY_PLAN_ID || 'plan_YourPlanIdHere';
    
    try {
      const subscription = await razorpayInstance.subscriptions.create({
        plan_id: PLAN_ID,
        customer_notify: 1,
        total_count: 120, // max 10 years for monthly
        notes: {
          merchant_id: merchant.id
        }
      });
      return subscription;
    } catch (err: any) {
      throw new Error(`Failed to create Razorpay subscription: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Completes the subscription purchase using Razorpay details
   */
  static purchaseSubscription(
    merchantId: string, 
    paymentReference: string, 
    mandateId?: string,
    signature?: string
  ): void {
    const merchant = MerchantsService.getMerchant(merchantId);
    
    // Validate that the payment was successful (simulated via paymentReference)
    if (!paymentReference) {
      throw new ValidationError('A valid payment reference is required.');
    }

    if (mandateId && signature) {
      const { verifyRazorpaySignature } = require('../../common/razorpay');
      if (!verifyRazorpaySignature(mandateId, paymentReference, signature)) {
         throw new ValidationError('Invalid Razorpay signature. Payment verification failed.');
      }
    }

    // Grant 100 points
    merchant.point_balance += 100;
    
    // Extend subscription by 30 days
    const now = new Date();
    const expiryDate = merchant.subscription_expires_at && new Date(merchant.subscription_expires_at) > now
      ? new Date(merchant.subscription_expires_at)
      : now;
    expiryDate.setDate(expiryDate.getDate() + 30);
    merchant.subscription_expires_at = expiryDate.toISOString();
    
    if (mandateId) {
      merchant.subscription_mandate_id = mandateId;
    }
    
    db.merchants.set(merchant.id, merchant);

    // Optionally, log this transaction in a new ledger or audit log
    db.auditLogs.set(randomUUID(), {
      id: randomUUID(),
      network_id: merchant.network_id,
      entity_type: 'MERCHANT',
      entity_id: merchant.id,
      action: 'SUBSCRIPTION_PURCHASED',
      actor: merchant.id,
      details: { added_points: 100, payment_reference: paymentReference },
      created_at: new Date().toISOString()
    });
  }

  /**
   * Tops up a merchant's point balance.
   * Cost is 1rs per point (100 paise per point).
   * Minimum top-up is 50 points.
   */
  static topUpPoints(merchantId: string, points: number, paymentReference: string): void {
    if (points < 50) {
      throw new ValidationError('Minimum top-up is 50 points (50rs).');
    }

    if (!paymentReference) {
      throw new ValidationError('A valid payment reference is required.');
    }

    const merchant = MerchantsService.getMerchant(merchantId);
    
    // In a real scenario, you'd verify the (points * 100 paise) payment with Razorpay here.

    merchant.point_balance += points;
    db.merchants.set(merchant.id, merchant);

    db.auditLogs.set(randomUUID(), {
      id: randomUUID(),
      network_id: merchant.network_id,
      entity_type: 'MERCHANT',
      entity_id: merchant.id,
      action: 'POINTS_TOP_UP',
      actor: merchant.id,
      details: { added_points: points, payment_reference: paymentReference },
      created_at: new Date().toISOString()
    });
  }
}
