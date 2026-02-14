import * as authService from '../services/auth.service.js';

export async function register(req, res) {
  const { email, password, name, voucherCode } = req.body;
  const result = await authService.register({ email, password, name, voucherCode });
  res.status(201).json(result);
}

export async function login(req, res) {
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip;
  const result = await authService.login({ email, password, userAgent, ipAddress });
  res.json(result);
}

export async function logout(req, res) {
  await authService.logout(req.user.jti);
  res.json({ message: 'Logged out' });
}

export async function logoutAll(req, res) {
  await authService.logoutAll(req.user.id);
  res.json({ message: 'All sessions logged out' });
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  await authService.forgotPassword(email);
  res.json({ message: 'If that email exists, a reset link has been sent' });
}

export async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  await authService.resetPassword({ token, newPassword });
  res.json({ message: 'Password reset successful' });
}
