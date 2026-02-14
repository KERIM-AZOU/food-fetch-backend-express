import mongoose from 'mongoose';

const voucherRedemptionSchema = new mongoose.Schema({
  marketerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Marketer', required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
}, { timestamps: true });

export default mongoose.model('VoucherRedemption', voucherRedemptionSchema);
