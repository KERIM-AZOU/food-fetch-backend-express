import User from '../models/User.js';
import SearchLog from '../models/SearchLog.js';
import TokenUsage from '../models/TokenUsage.js';
import Marketer from '../models/Marketer.js';

// ── CSV helper ───────────────────────────────────────────────────────

function toCSV(headers, rows) {
  const headerLine = headers.join(',');
  const dataLines = rows.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape commas and quotes
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

// ── Export searches ──────────────────────────────────────────────────

export async function exportSearches({ from, to }) {
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const logs = await SearchLog.find(filter).sort({ createdAt: -1 }).lean();

  const headers = ['id', 'userId', 'query', 'platforms', 'resultCount', 'country', 'lat', 'lon', 'createdAt'];
  const rows = logs.map(l => ({
    id: l._id.toString(),
    userId: l.userId?.toString() || '',
    query: l.query,
    platforms: (l.platforms || []).join(';'),
    resultCount: l.resultCount,
    country: l.country,
    lat: l.lat,
    lon: l.lon,
    createdAt: l.createdAt?.toISOString() || '',
  }));

  return toCSV(headers, rows);
}

// ── Export users ─────────────────────────────────────────────────────

export async function exportUsers() {
  const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();

  const headers = ['id', 'email', 'name', 'role', 'voucherCode', 'isVerified', 'createdAt'];
  const rows = users.map(u => ({
    id: u._id.toString(),
    email: u.email,
    name: u.name || '',
    role: u.role,
    voucherCode: u.voucherCode || '',
    isVerified: u.isVerified,
    createdAt: u.createdAt?.toISOString() || '',
  }));

  return toCSV(headers, rows);
}

// ── Export token usage ───────────────────────────────────────────────

export async function exportTokenUsage({ from, to }) {
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const records = await TokenUsage.find(filter).sort({ createdAt: -1 }).lean();

  const headers = ['id', 'userId', 'service', 'model', 'inputTokens', 'outputTokens', 'totalTokens', 'cost', 'createdAt'];
  const rows = records.map(r => ({
    id: r._id.toString(),
    userId: r.userId?.toString() || '',
    service: r.service,
    model: r.model || '',
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    totalTokens: r.totalTokens,
    cost: r.cost ?? '',
    createdAt: r.createdAt?.toISOString() || '',
  }));

  return toCSV(headers, rows);
}

// ── Export marketers ─────────────────────────────────────────────────

export async function exportMarketers() {
  const marketers = await Marketer.find().sort({ createdAt: -1 }).lean();

  const headers = ['id', 'name', 'code', 'isActive', 'maxUses', 'usedCount', 'expiresAt', 'createdAt'];
  const rows = marketers.map(m => ({
    id: m._id.toString(),
    name: m.name,
    code: m.code,
    isActive: m.isActive,
    maxUses: m.maxUses ?? '',
    usedCount: m.usedCount,
    expiresAt: m.expiresAt?.toISOString() || '',
    createdAt: m.createdAt?.toISOString() || '',
  }));

  return toCSV(headers, rows);
}
