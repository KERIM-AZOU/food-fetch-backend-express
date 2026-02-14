import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import config from '../config/index.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import PasswordReset from '../models/PasswordReset.js';
import Marketer from '../models/Marketer.js';
import VoucherRedemption from '../models/VoucherRedemption.js';
import { validateVoucher } from '../utils/voucherValidator.js';
import { AppError } from '../middleware/errorHandler.js';

const SALT_ROUNDS = 12;

// ── Token helper ──────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role, jti: crypto.randomUUID() },
    config.jwt.secret,
    { expiresIn: config.jwt.expiry },
  );
}

function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, num, unit] = match;
  const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return parseInt(num) * ms[unit];
}

// ── Register ─────────────────────────────────────────────────────────

export async function register({ email, password, name, voucherCode }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already registered', 409);

  let marketer = null;
  if (voucherCode) {
    const result = await validateVoucher(voucherCode);
    if (!result.valid) throw new AppError(result.error, 400);
    marketer = result.marketer;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    email,
    password: hashedPassword,
    name: name || null,
    voucherCode: voucherCode || null,
  });

  if (marketer) {
    await Marketer.updateOne({ _id: marketer._id }, { $inc: { usedCount: 1 } });
    await VoucherRedemption.create({ marketerId: marketer._id, userId: user._id });
  }

  const token = signToken(user);
  const payload = jwt.decode(token);

  await Session.create({
    userId: user._id,
    tokenId: payload.jti,
    expiresAt: new Date(Date.now() + parseExpiry(config.jwt.expiry)),
  });

  return {
    user: { id: user._id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    token,
  };
}

// ── Login ────────────────────────────────────────────────────────────

export async function login({ email, password, userAgent, ipAddress }) {
  const user = await User.findOne({ email });
  if (!user) throw new AppError('Invalid email or password', 401);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError('Invalid email or password', 401);

  const token = signToken(user);
  const payload = jwt.decode(token);

  await Session.create({
    userId: user._id,
    tokenId: payload.jti,
    userAgent: userAgent || null,
    ipAddress: ipAddress || null,
    expiresAt: new Date(Date.now() + parseExpiry(config.jwt.expiry)),
  });

  return {
    user: { id: user._id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

// ── Logout ───────────────────────────────────────────────────────────

export async function logout(tokenId) {
  await Session.deleteOne({ tokenId });
}

// ── Logout all sessions ─────────────────────────────────────────────

export async function logoutAll(userId) {
  await Session.deleteMany({ userId });
}

// ── Verify session (for auth middleware) ─────────────────────────────

export async function verifySession(tokenId) {
  const session = await Session.findOne({ tokenId });
  return session && session.expiresAt > new Date();
}

// ── Forgot Password ──────────────────────────────────────────────────

export async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');

  await PasswordReset.create({
    userId: user._id,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
  }

  return token;
}

// ── Reset Password ───────────────────────────────────────────────────

export async function resetPassword({ token, newPassword }) {
  const reset = await PasswordReset.findOne({ token });

  if (!reset || reset.used || reset.expiresAt < new Date()) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await User.updateOne({ _id: reset.userId }, { password: hashedPassword });
  await PasswordReset.updateOne({ _id: reset._id }, { used: true });
  await Session.deleteMany({ userId: reset.userId });
}
