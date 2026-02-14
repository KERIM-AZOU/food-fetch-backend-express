import mongoose from 'mongoose';

const tokenUsageSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  service:      { type: String, required: true },
  model:        { type: String, default: null },
  inputTokens:  { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens:  { type: Number, default: 0 },
  cost:         { type: Number, default: null },
  metadata:     { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

export default mongoose.model('TokenUsage', tokenUsageSchema);
