import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenId:   { type: String, required: true, unique: true },
  userAgent: { type: String, default: null },
  ipAddress: { type: String, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema);
