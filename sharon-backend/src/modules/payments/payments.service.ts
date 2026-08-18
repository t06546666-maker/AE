import { randomUUID } from 'crypto';
import { PaymentInstruction, PaymentResult } from '../../common/types';
import { db } from '../../database/db';
import { mockPaymentProvider } from './mock-payment-provider';
import { NotFoundError } from '../../common/errors';
import { Logger } from '../../common/logger';

export class PaymentsService {
  static async handleCallback(payload: any): Promise<PaymentInstruction> {
    const callbackData = await mockPaymentProvider.handleCallback(payload);
    const instruction = db.paymentInstructions.get(callbackData.instruction_id);
    if (!instruction) {
      throw new NotFoundError(`Payment instruction '${callbackData.instruction_id}' not found.`);
    }

    instruction.status = callbackData.status;
    db.paymentInstructions.set(instruction.id, instruction);

    const result: PaymentResult = {
      id: randomUUID(),
      payment_instruction_id: instruction.id,
      provider_status: callbackData.status,
      raw_payload: payload,
      created_at: new Date().toISOString()
    };

    db.paymentResults.set(result.id, result);
    Logger.info(`Payment callback recorded for instruction ${instruction.id}`, { status: callbackData.status });
    return instruction;
  }

  static getInstruction(id: string): PaymentInstruction {
    const inst = db.paymentInstructions.get(id);
    if (!inst) {
      throw new NotFoundError(`Payment instruction '${id}' not found.`);
    }
    return inst;
  }
}
