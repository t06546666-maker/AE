const { supabase } = require('../common/db');
const { logAudit } = require('../audit');
const crypto = require('crypto');

/**
 * PaymentProvider Interface
 * Affiliate AE must NOT hold money. Actual money movement must eventually happen
 * through an appropriate regulated payment provider/bank/UPI infrastructure.
 */
class PaymentProvider {
  async createCustomerPayout(instruction) { throw new Error('Not implemented'); }
  async createMerchantSettlement(instruction) { throw new Error('Not implemented'); }
  async getPaymentStatus(providerRef) { throw new Error('Not implemented'); }
  async handleCallback(payload) { throw new Error('Not implemented'); }
  verifyCallback(payload, signature) { throw new Error('Not implemented'); }
}

/**
 * MockPaymentProvider for Development
 * Simulates UPI and Bank payouts.
 */
class MockPaymentProvider extends PaymentProvider {
  
  async _simulateProviderCall(instruction, type) {
    // Generate a fake provider reference
    const providerRef = `MOCK_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    
    console.log(`[MockPaymentProvider] -> ${type} requested for Instruction ${instruction.id}. Amount: ${instruction.amount_paise} paise. Reference: ${providerRef}`);

    // Update instruction with PENDING state and ref
    const { error } = await supabase.from('payment_instructions')
      .update({ status: 'PENDING', provider_ref: providerRef })
      .eq('id', instruction.id);
      
    if (error) console.error('[MockPaymentProvider] DB Update failed', error);

    // Simulate async webhook via setTimeout
    setTimeout(async () => {
      // 90% success rate simulation
      const finalStatus = Math.random() > 0.1 ? 'SUCCESS' : 'FAILED';
      
      const payload = {
        provider_ref: providerRef,
        status: finalStatus,
        instruction_id: instruction.id,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[MockPaymentProvider Webhook] <- ${providerRef} transitioned to ${finalStatus}`);
      await this.handleCallback(payload);
      
    }, 2000); // 2 second delay

    return { success: true, providerRef, status: 'PENDING' };
  }

  async createCustomerPayout(instruction) {
    return this._simulateProviderCall(instruction, 'Customer Payout');
  }

  async createMerchantSettlement(instruction) {
    return this._simulateProviderCall(instruction, 'Merchant Settlement');
  }

  async getPaymentStatus(providerRef) {
    // In a real provider, this queries their API. For mock, we check DB.
    const { data } = await supabase.from('payment_instructions')
      .select('status')
      .eq('provider_ref', providerRef)
      .single();
    
    return data ? data.status : 'UNKNOWN';
  }

  verifyCallback(payload, signature) {
    // Mock always valid
    return true;
  }

  async handleCallback(payload) {
    const { provider_ref, status, instruction_id } = payload;
    
    // Write raw result
    await supabase.from('payment_results').insert({
      payment_instruction_id: instruction_id,
      provider_status: status,
      raw_payload: payload
    });

    // Update instruction
    await supabase.from('payment_instructions')
      .update({ status })
      .eq('id', instruction_id);

    await logAudit(null, 'PAYMENT', instruction_id, status, 'PAYMENT_PROVIDER', { provider_ref });

    // Note: In a full system, this would trigger further business logic:
    // If SUCCESS -> Mark Redemptions/Settlement Lines as PAID.
    // If FAILED -> Revert Reservation back to AVAILABLE.
  }
}

module.exports = {
  PaymentProvider,
  MockPaymentProvider
};
