import Marketer from '../models/Marketer.js';
import VoucherRedemption from '../models/VoucherRedemption.js';
import { AppError } from '../middleware/errorHandler.js';

// ── Helper: date filter ──────────────────────────────────────────────

function dateFilter(from, to) {
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return Object.keys(filter).length ? { createdAt: filter } : {};
}

// ── CRUD ─────────────────────────────────────────────────────────────

export async function createMarketer({ name, code, maxUses, expiresAt }) {
  const existing = await Marketer.findOne({ code });
  if (existing) throw new AppError('A marketer with this code already exists', 409);

  return Marketer.create({
    name,
    code: code.toUpperCase(),
    maxUses: maxUses || null,
    expiresAt: expiresAt || null,
  });
}

export async function listMarketers({ page = 1, limit = 20, search }) {
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [marketers, total] = await Promise.all([
    Marketer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Marketer.countDocuments(filter),
  ]);

  return { marketers, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getMarketer(id) {
  const marketer = await Marketer.findById(id);
  if (!marketer) throw new AppError('Marketer not found', 404);
  return marketer;
}

export async function updateMarketer(id, updates) {
  const allowed = ['name', 'code', 'isActive', 'maxUses', 'expiresAt'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      data[key] = key === 'code' ? updates[key].toUpperCase() : updates[key];
    }
  }

  if (data.code) {
    const existing = await Marketer.findOne({ code: data.code, _id: { $ne: id } });
    if (existing) throw new AppError('A marketer with this code already exists', 409);
  }

  const marketer = await Marketer.findByIdAndUpdate(id, data, { returnDocument: 'after' });
  if (!marketer) throw new AppError('Marketer not found', 404);
  return marketer;
}

export async function deleteMarketer(id) {
  const marketer = await Marketer.findByIdAndUpdate(id, { isActive: false }, { returnDocument: 'after' });
  if (!marketer) throw new AppError('Marketer not found', 404);
  return marketer;
}

// ── Redemptions ──────────────────────────────────────────────────────

export async function getRedemptions(marketerId, { page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  const [redemptions, total] = await Promise.all([
    VoucherRedemption.find({ marketerId })
      .populate('userId', 'email name createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    VoucherRedemption.countDocuments({ marketerId }),
  ]);

  return { redemptions, total, page, limit, pages: Math.ceil(total / limit) };
}

// ── Analytics ────────────────────────────────────────────────────────

export async function marketerAnalytics({ from, to }) {
  const match = dateFilter(from, to);

  const [totalSignups, topMarketers] = await Promise.all([
    VoucherRedemption.countDocuments(match),
    VoucherRedemption.aggregate([
      { $match: match },
      { $group: { _id: '$marketerId', signups: { $sum: 1 } } },
      { $sort: { signups: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'marketers',
          localField: '_id',
          foreignField: '_id',
          as: 'marketer',
        },
      },
      { $unwind: '$marketer' },
      {
        $project: {
          _id: 1,
          signups: 1,
          name: '$marketer.name',
          code: '$marketer.code',
        },
      },
    ]),
  ]);

  return { totalSignups, topMarketers };
}

export async function singleMarketerAnalytics(marketerId, { from, to, granularity = 'daily' }) {
  const match = { marketerId };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  let dateFormat;
  if (granularity === 'weekly') {
    dateFormat = { $dateToString: { format: '%G-W%V', date: '$createdAt' } };
  } else if (granularity === 'monthly') {
    dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  } else {
    dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const timeline = await VoucherRedemption.aggregate([
    { $match: match },
    { $group: { _id: dateFormat, signups: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return timeline;
}
