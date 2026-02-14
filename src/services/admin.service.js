import User from '../models/User.js';
import Session from '../models/Session.js';
import { AppError } from '../middleware/errorHandler.js';

// ── List users (paginated + filters) ─────────────────────────────────

export async function listUsers({ page = 1, limit = 20, role, search }) {
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return { users, total, page, limit, pages: Math.ceil(total / limit) };
}

// ── Get single user ──────────────────────────────────────────────────

export async function getUser(id) {
  const user = await User.findById(id).select('-password');
  if (!user) throw new AppError('User not found', 404);
  return user;
}

// ── Update user (role, verify status, etc.) ──────────────────────────

export async function updateUser(id, updates) {
  const allowed = ['role', 'isVerified', 'name'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  const user = await User.findByIdAndUpdate(id, data, { returnDocument: 'after' }).select('-password');
  if (!user) throw new AppError('User not found', 404);
  return user;
}

// ── Delete user ──────────────────────────────────────────────────────

export async function deleteUser(id) {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);

  // Delete all sessions for this user
  await Session.deleteMany({ userId: id });
  await User.deleteOne({ _id: id });
}
