import Razorpay from 'razorpay';
import crypto from 'crypto';

// Replace with your actual Razorpay keys or use process.env
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE';
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'YOUR_SECRET_HERE';

export const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

export function verifyRazorpaySignature(subscriptionId: string, paymentId: string, signature: string): boolean {
  const text = `${paymentId}|${subscriptionId}`;
  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');
  return generatedSignature === signature;
}
