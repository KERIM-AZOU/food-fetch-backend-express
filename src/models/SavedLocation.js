import mongoose from 'mongoose';

const savedLocationSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  label:     { type: String, required: true },
  lat:       { type: Number, required: true },
  lon:       { type: Number, required: true },
  address:   { type: String, default: null },
  country:   { type: String, required: true },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('SavedLocation', savedLocationSchema);
