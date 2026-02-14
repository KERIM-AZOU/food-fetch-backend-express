import Marketer from '../models/Marketer.js';

/**
 * Validates a marketer voucher code.
 * Checks: exists, active, not expired, hasn't hit max uses.
 */
export async function validateVoucher(code) {
  const marketer = await Marketer.findOne({ code });

  if (!marketer) {
    return { valid: false, marketer: null, error: 'Invalid voucher code' };
  }
  if (!marketer.isActive) {
    return { valid: false, marketer: null, error: 'This voucher code is no longer active' };
  }
  if (marketer.expiresAt && marketer.expiresAt < new Date()) {
    return { valid: false, marketer: null, error: 'This voucher code has expired' };
  }
  if (marketer.maxUses && marketer.usedCount >= marketer.maxUses) {
    return { valid: false, marketer: null, error: 'This voucher code has reached its usage limit' };
  }

  return { valid: true, marketer, error: null };
}
