import mongoose from 'mongoose';

const searchLogSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  query:       { type: String, default: '' },
  platforms:   [{ type: String }],
  resultCount: { type: Number, default: 0 },
  country:     { type: String, default: 'QA' },
  lat:         { type: Number, default: 0 },
  lon:         { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('SearchLog', searchLogSchema);
