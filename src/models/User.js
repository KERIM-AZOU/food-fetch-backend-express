import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  name:        { type: String, default: null },
  role:        { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
  preferences: { type: mongoose.Schema.Types.Mixed, default: null },
  voucherCode: { type: String, default: null },
  isVerified:  { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
