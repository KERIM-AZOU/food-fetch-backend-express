import bcrypt from 'bcrypt';
import User from '../models/User.js';
import SavedLocation from '../models/SavedLocation.js';
import Session from '../models/Session.js';
import { AppError } from '../middleware/errorHandler.js';

const SALT_ROUNDS = 12;

// ── Profile ──────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function updateProfile(userId, updates) {
  const allowed = ['name', 'preferences'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  const user = await User.findByIdAndUpdate(userId, data, { returnDocument: 'after' }).select('-password');
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new AppError('Current password is incorrect', 401);

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  // Invalidate all other sessions (force re-login on other devices)
  await Session.deleteMany({ userId });
}

// ── Saved Locations ──────────────────────────────────────────────────

export async function getLocations(userId) {
  return SavedLocation.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
}

export async function addLocation(userId, data) {
  const { label, lat, lon, address, country, isDefault } = data;

  // If setting as default, unset any existing default
  if (isDefault) {
    await SavedLocation.updateMany({ userId, isDefault: true }, { isDefault: false });
  }

  return SavedLocation.create({ userId, label, lat, lon, address, country, isDefault: isDefault || false });
}

export async function updateLocation(userId, locationId, data) {
  const location = await SavedLocation.findOne({ _id: locationId, userId });
  if (!location) throw new AppError('Location not found', 404);

  const allowed = ['label', 'lat', 'lon', 'address', 'country'];
  for (const key of allowed) {
    if (data[key] !== undefined) location[key] = data[key];
  }

  await location.save();
  return location;
}

export async function deleteLocation(userId, locationId) {
  const result = await SavedLocation.deleteOne({ _id: locationId, userId });
  if (result.deletedCount === 0) throw new AppError('Location not found', 404);
}

export async function setDefaultLocation(userId, locationId) {
  const location = await SavedLocation.findOne({ _id: locationId, userId });
  if (!location) throw new AppError('Location not found', 404);

  await SavedLocation.updateMany({ userId, isDefault: true }, { isDefault: false });
  location.isDefault = true;
  await location.save();
  return location;
}
