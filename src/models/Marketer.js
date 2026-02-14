import mongoose from 'mongoose';

const marketerSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  code:      { type: String, required: true, unique: true },
  isActive:  { type: Boolean, default: true },
  maxUses:   { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('Marketer', marketerSchema);
