import * as chatService from '../services/chat.service.js';
import { AppError } from '../middleware/errorHandler.js';

export async function textChat(req, res) {
  const { message, sessionId = 'default', generateAudio = true, language = 'en' } = req.body;
  if (!message) throw new AppError('Message is required', 400);

  const result = await chatService.handleTextChat({ message, sessionId, generateAudio, language });
  res.json(result);
}

export async function startChat(req, res) {
  const {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    generateAudio = true,
    language = 'en',
  } = req.body;

  const result = await chatService.handleStartChat({ sessionId, generateAudio, language });
  res.json(result);
}

export async function audioChat(req, res) {
  const { audio, mimeType = 'audio/webm', sessionId = 'default' } = req.body;
  if (!audio) throw new AppError('Audio data is required', 400);

  const result = await chatService.handleAudioChat({ audio, mimeType, sessionId });
  res.json(result);
}

export function getHistory(req, res) {
  const { sessionId } = req.params;
  const data = chatService.getHistory(sessionId);
  if (!data) throw new AppError('Conversation not found', 404);
  res.json(data);
}

export function clearChat(req, res) {
  const { sessionId } = req.params;
  chatService.clearConversation(sessionId);
  res.json({ success: true, message: 'Conversation cleared' });
}
