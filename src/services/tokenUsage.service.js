import TokenUsage from '../models/TokenUsage.js';

// ── Helper: build date filter ────────────────────────────────────────

function dateFilter(from, to) {
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return Object.keys(filter).length ? { createdAt: filter } : {};
}

// ── Global token overview ────────────────────────────────────────────

export async function tokenOverview({ from, to }) {
  const match = dateFilter(from, to);

  const byService = await TokenUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$service',
        totalInput: { $sum: '$inputTokens' },
        totalOutput: { $sum: '$outputTokens' },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: { $ifNull: ['$cost', 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalTokens: -1 } },
  ]);

  return byService;
}

// ── Token usage timeline ─────────────────────────────────────────────

export async function tokenTimeline({ from, to, granularity = 'daily' }) {
  const match = dateFilter(from, to);

  let dateFormat;
  if (granularity === 'weekly') {
    dateFormat = { $dateToString: { format: '%G-W%V', date: '$createdAt' } };
  } else if (granularity === 'monthly') {
    dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  } else {
    dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const timeline = await TokenUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: dateFormat,
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: { $ifNull: ['$cost', 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return timeline;
}

// ── Token costs breakdown ────────────────────────────────────────────

export async function tokenCosts({ from, to }) {
  const match = dateFilter(from, to);

  const costs = await TokenUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: { service: '$service', model: '$model' },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: { $ifNull: ['$cost', 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalCost: -1 } },
  ]);

  return costs;
}

// ── Monthly billing report ───────────────────────────────────────────

// Pricing per 1M tokens (input/output) or per unit
const PRICING = {
  'llama-3.3-70b-versatile':  { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant':     { input: 0.05, output: 0.08 },
  'whisper-large-v3':         { perMinute: 0.006 },
  'tts-1-mel':                { perChar: 0.000015 },
  'tts-1-alloy':              { perChar: 0.000015 },
};

function estimateCost(model, inputTokens, outputTokens, metadata) {
  const p = PRICING[model];
  if (!p) return 0;
  if (p.perMinute && metadata?.durationMs) return (metadata.durationMs / 60_000) * p.perMinute;
  if (p.perChar && metadata?.textLength) return metadata.textLength * p.perChar;
  return ((inputTokens / 1_000_000) * (p.input || 0)) + ((outputTokens / 1_000_000) * (p.output || 0));
}

export async function billingReport({ months = 1 } = {}) {
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const records = await TokenUsage.aggregate([
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          service: '$service',
          model: '$model',
        },
        totalInput: { $sum: '$inputTokens' },
        totalOutput: { $sum: '$outputTokens' },
        totalTokens: { $sum: '$totalTokens' },
        storedCost: { $sum: { $ifNull: ['$cost', 0] } },
        requests: { $sum: 1 },
        metadataList: { $push: '$metadata' },
      },
    },
    { $sort: { '_id.month': -1, '_id.service': 1 } },
  ]);

  const monthMap = {};
  for (const r of records) {
    const { month, service, model } = r._id;

    let estimatedCost = r.storedCost;
    if (!estimatedCost) {
      let metaSum = 0;
      for (const m of r.metadataList || []) {
        if (m) metaSum += estimateCost(model, 0, 0, m);
      }
      estimatedCost = metaSum || estimateCost(model, r.totalInput, r.totalOutput, null);
    }

    if (!monthMap[month]) monthMap[month] = { month, services: [], totalCost: 0, totalTokens: 0, totalRequests: 0 };
    monthMap[month].services.push({
      service,
      model,
      requests: r.requests,
      inputTokens: r.totalInput,
      outputTokens: r.totalOutput,
      totalTokens: r.totalTokens,
      estimatedCost: Math.round(estimatedCost * 1_000_000) / 1_000_000,
    });
    monthMap[month].totalCost += estimatedCost;
    monthMap[month].totalTokens += r.totalTokens;
    monthMap[month].totalRequests += r.requests;
  }

  return Object.values(monthMap).map((m) => ({
    ...m,
    totalCost: Math.round(m.totalCost * 100) / 100,
  }));
}

// ── Single user token usage (paginated) ──────────────────────────────

export async function userTokenUsage(userId, { page = 1, limit = 50, from, to }) {
  const filter = { userId };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    TokenUsage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TokenUsage.countDocuments(filter),
  ]);

  return { records, total, page, limit, pages: Math.ceil(total / limit) };
}

// ── Single user token summary ────────────────────────────────────────

export async function userTokenSummary(userId, { from, to }) {
  const match = { userId };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const summary = await TokenUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$service',
        totalInput: { $sum: '$inputTokens' },
        totalOutput: { $sum: '$outputTokens' },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: { $ifNull: ['$cost', 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalTokens: -1 } },
  ]);

  return summary;
}

// ── Single user token timeline ───────────────────────────────────────

export async function userTokenTimeline(userId, { from, to, granularity = 'daily' }) {
  const match = { userId };
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

  const timeline = await TokenUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: dateFormat,
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: { $ifNull: ['$cost', 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return timeline;
}
