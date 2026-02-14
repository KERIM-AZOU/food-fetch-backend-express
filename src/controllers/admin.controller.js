import * as adminService from '../services/admin.service.js';
import * as analyticsService from '../services/analytics.service.js';
import * as tokenUsageService from '../services/tokenUsage.service.js';
import * as marketerService from '../services/marketer.service.js';
import * as exportService from '../services/export.service.js';
import mongoose from 'mongoose';

// ── Helper: parse pagination + date params ───────────────────────────

function pag(query) {
  return {
    page: parseInt(query.page) || 1,
    limit: parseInt(query.limit) || 20,
    from: query.from,
    to: query.to,
    granularity: query.granularity,
    search: query.search,
  };
}

function toObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

// ── User management ──────────────────────────────────────────────────

export async function listUsers(req, res) {
  const { page, limit, search } = pag(req.query);
  const result = await adminService.listUsers({ page, limit, role: req.query.role, search });
  res.json(result);
}

export async function getUser(req, res) {
  const user = await adminService.getUser(req.params.id);
  res.json(user);
}

export async function updateUser(req, res) {
  const user = await adminService.updateUser(req.params.id, req.body);
  res.json(user);
}

export async function deleteUser(req, res) {
  await adminService.deleteUser(req.params.id);
  res.json({ message: 'User deleted' });
}

// ── Analytics ────────────────────────────────────────────────────────

export async function overviewHandler(req, res) {
  const data = await analyticsService.overview();
  res.json(data);
}

export async function searchAnalytics(req, res) {
  const { from, to, limit } = pag(req.query);
  const data = await analyticsService.searchAnalytics({ from, to, limit });
  res.json(data);
}

export async function platformAnalytics(req, res) {
  const { from, to } = pag(req.query);
  const data = await analyticsService.platformAnalytics({ from, to });
  res.json(data);
}

export async function popularItems(req, res) {
  const { from, to, limit } = pag(req.query);
  const data = await analyticsService.popularItems({ from, to, limit });
  res.json(data);
}

export async function userActivity(req, res) {
  const { from, to } = pag(req.query);
  const data = await analyticsService.userActivity({ from, to });
  res.json(data);
}

export async function geoAnalytics(req, res) {
  const { from, to } = pag(req.query);
  const data = await analyticsService.geoAnalytics({ from, to });
  res.json(data);
}

export async function timeAnalytics(req, res) {
  const { from, to, granularity } = pag(req.query);
  const data = await analyticsService.timeAnalytics({ from, to, granularity });
  res.json(data);
}

// ── Token analytics ──────────────────────────────────────────────────

export async function tokenOverview(req, res) {
  const { from, to } = pag(req.query);
  const data = await tokenUsageService.tokenOverview({ from, to });
  res.json(data);
}

export async function tokenTimeline(req, res) {
  const { from, to, granularity } = pag(req.query);
  const data = await tokenUsageService.tokenTimeline({ from, to, granularity });
  res.json(data);
}

export async function tokenCosts(req, res) {
  const { from, to } = pag(req.query);
  const data = await tokenUsageService.tokenCosts({ from, to });
  res.json(data);
}

export async function billingReport(req, res) {
  const months = parseInt(req.query.months) || 1;
  const data = await tokenUsageService.billingReport({ months });
  res.json(data);
}

export async function userTokenUsage(req, res) {
  const userId = toObjectId(req.params.id);
  const { page, limit, from, to } = pag(req.query);
  const data = await tokenUsageService.userTokenUsage(userId, { page, limit, from, to });
  res.json(data);
}

export async function userTokenSummary(req, res) {
  const userId = toObjectId(req.params.id);
  const { from, to } = pag(req.query);
  const data = await tokenUsageService.userTokenSummary(userId, { from, to });
  res.json(data);
}

export async function userTokenTimeline(req, res) {
  const userId = toObjectId(req.params.id);
  const { from, to, granularity } = pag(req.query);
  const data = await tokenUsageService.userTokenTimeline(userId, { from, to, granularity });
  res.json(data);
}

// ── Marketer management ──────────────────────────────────────────────

export async function createMarketer(req, res) {
  const marketer = await marketerService.createMarketer(req.body);
  res.status(201).json(marketer);
}

export async function listMarketers(req, res) {
  const { page, limit, search } = pag(req.query);
  const data = await marketerService.listMarketers({ page, limit, search });
  res.json(data);
}

export async function getMarketer(req, res) {
  const marketer = await marketerService.getMarketer(req.params.id);
  res.json(marketer);
}

export async function updateMarketer(req, res) {
  const marketer = await marketerService.updateMarketer(req.params.id, req.body);
  res.json(marketer);
}

export async function deleteMarketer(req, res) {
  const marketer = await marketerService.deleteMarketer(req.params.id);
  res.json(marketer);
}

export async function marketerRedemptions(req, res) {
  const { page, limit } = pag(req.query);
  const data = await marketerService.getRedemptions(req.params.id, { page, limit });
  res.json(data);
}

export async function marketerAnalyticsHandler(req, res) {
  const { from, to } = pag(req.query);
  const data = await marketerService.marketerAnalytics({ from, to });
  res.json(data);
}

export async function singleMarketerAnalytics(req, res) {
  const { from, to, granularity } = pag(req.query);
  const data = await marketerService.singleMarketerAnalytics(req.params.id, { from, to, granularity });
  res.json(data);
}

// ── Exports ──────────────────────────────────────────────────────────

function sendCSV(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function exportSearches(req, res) {
  const { from, to } = pag(req.query);
  const csv = await exportService.exportSearches({ from, to });
  sendCSV(res, 'searches.csv', csv);
}

export async function exportUsers(req, res) {
  const csv = await exportService.exportUsers();
  sendCSV(res, 'users.csv', csv);
}

export async function exportTokenUsage(req, res) {
  const { from, to } = pag(req.query);
  const csv = await exportService.exportTokenUsage({ from, to });
  sendCSV(res, 'token-usage.csv', csv);
}

export async function exportMarketers(req, res) {
  const csv = await exportService.exportMarketers();
  sendCSV(res, 'marketers.csv', csv);
}
