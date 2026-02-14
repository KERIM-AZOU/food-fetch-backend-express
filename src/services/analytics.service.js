import User from '../models/User.js';
import SearchLog from '../models/SearchLog.js';
import Session from '../models/Session.js';

// ── Helper: build date filter ────────────────────────────────────────

function dateFilter(from, to) {
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return Object.keys(filter).length ? { createdAt: filter } : {};
}

// ── Dashboard overview ───────────────────────────────────────────────

export async function overview() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalUsers, totalSearches, searchesToday, activeSessions] = await Promise.all([
    User.countDocuments(),
    SearchLog.countDocuments(),
    SearchLog.countDocuments({ createdAt: { $gte: todayStart } }),
    Session.countDocuments({ expiresAt: { $gt: now } }),
  ]);

  // Top platform
  const topPlatform = await SearchLog.aggregate([
    { $unwind: '$platforms' },
    { $group: { _id: '$platforms', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);

  return {
    totalUsers,
    totalSearches,
    searchesToday,
    activeSessions,
    topPlatform: topPlatform[0]?._id || null,
  };
}

// ── Search analytics ─────────────────────────────────────────────────

export async function searchAnalytics({ from, to, limit = 20 }) {
  const match = dateFilter(from, to);

  const [topQueries, totalSearches, avgResultCount] = await Promise.all([
    SearchLog.aggregate([
      { $match: match },
      { $group: { _id: '$query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    SearchLog.countDocuments(match),
    SearchLog.aggregate([
      { $match: match },
      { $group: { _id: null, avg: { $avg: '$resultCount' } } },
    ]),
  ]);

  return {
    totalSearches,
    avgResultCount: avgResultCount[0]?.avg || 0,
    topQueries,
  };
}

// ── Platform analytics ───────────────────────────────────────────────

export async function platformAnalytics({ from, to }) {
  const match = dateFilter(from, to);

  const platforms = await SearchLog.aggregate([
    { $match: match },
    { $unwind: '$platforms' },
    { $group: { _id: '$platforms', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return platforms;
}

// ── Popular items ────────────────────────────────────────────────────

export async function popularItems({ from, to, limit = 20 }) {
  const match = dateFilter(from, to);

  const items = await SearchLog.aggregate([
    { $match: { ...match, query: { $ne: '' } } },
    { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return items;
}

// ── User activity ────────────────────────────────────────────────────

export async function userActivity({ from, to }) {
  const match = dateFilter(from, to);
  const now = new Date();

  const [activeUsers, totalSessions, searchingUsers] = await Promise.all([
    Session.distinct('userId', { expiresAt: { $gt: now } }).then(ids => ids.length),
    Session.countDocuments(match),
    SearchLog.distinct('userId', match).then(ids => ids.filter(Boolean).length),
  ]);

  return { activeUsers, totalSessions, searchingUsers };
}

// ── Geo analytics ────────────────────────────────────────────────────

export async function geoAnalytics({ from, to }) {
  const match = dateFilter(from, to);

  const countrySplit = await SearchLog.aggregate([
    { $match: match },
    { $group: { _id: '$country', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return { countrySplit };
}

// ── Time analytics ───────────────────────────────────────────────────

export async function timeAnalytics({ from, to, granularity = 'daily' }) {
  const match = dateFilter(from, to);

  let dateFormat;
  if (granularity === 'hourly') {
    dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } };
  } else if (granularity === 'weekly') {
    dateFormat = { $dateToString: { format: '%G-W%V', date: '$createdAt' } };
  } else if (granularity === 'monthly') {
    dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  } else {
    dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const timeline = await SearchLog.aggregate([
    { $match: match },
    { $group: { _id: dateFormat, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Peak hours
  const peakHours = await SearchLog.aggregate([
    { $match: match },
    { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  return { timeline, peakHours };
}
