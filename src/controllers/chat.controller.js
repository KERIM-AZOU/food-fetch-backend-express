import * as chatService from '../services/chat.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function textChat(req, res) {
  const { message, generateAudio = false } = req.body;
  if (!message) throw new AppError('Message is required', 400);
  const sessionId = req.user.id;

  const result = await chatService.handleTextChat({ message, sessionId, generateAudio });
  res.json(result);
}

export async function startChat(req, res) {
  const { generateAudio = true, language = 'en' } = req.body;
  const sessionId = req.user.id;

  const result = await chatService.handleStartChat({ sessionId, generateAudio, language });
  res.json(result);
}

export async function audioChat(req, res) {
  const { audio, mimeType = 'audio/webm' } = req.body;
  if (!audio) throw new AppError('Audio data is required', 400);
  const sessionId = req.user.id;

  const result = await chatService.handleAudioChat({ audio, mimeType, sessionId });
  res.json(result);
}

export function getHistory(req, res) {
    console.log('Received message:', req.user);
  const sessionId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const data = chatService.getHistory(sessionId, { page, limit });
  if (!data) throw new AppError('Conversation not found', 404);
  res.json(data);
}

export function clearChat(req, res) {
  const sessionId = req.user.id;
  chatService.clearConversation(sessionId);
  res.json({ success: true, message: 'Conversation cleared' });
}
