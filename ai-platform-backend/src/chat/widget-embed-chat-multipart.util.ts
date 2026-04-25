import { HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { uploadPublic } from '../lib/s3';
import type { MessageAttachment, MessageSpeechInput } from '../models/message.schema';
import { normalizeSpeechInputFromBody } from './speech-input.normalize';
import {
  isAllowedWidgetChatAttachmentFilename,
  WIDGET_CHAT_ATTACHMENT_MAX_BYTES,
  WIDGET_CHAT_ATTACHMENT_MAX_FILES,
} from './widget-chat-attachment.constants';

export type ParsedEmbedChatPayload = {
  botId: string;
  message: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId?: string;
  visitorId?: string;
  conversationId?: string;
  startNewConversation?: boolean;
  speechInput?: MessageSpeechInput;
  embedOrigin?: string;
};

export function parseEmbedChatPayloadRecord(o: Record<string, unknown>): ParsedEmbedChatPayload | null {
  const botId = typeof o.botId === 'string' ? o.botId.trim() : '';
  if (!botId) return null;
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  const accessKey = typeof o.accessKey === 'string' ? o.accessKey.trim() : '';
  const secretKey = typeof o.secretKey === 'string' ? o.secretKey.trim() : '';
  const chatVisitorId = typeof o.chatVisitorId === 'string' ? o.chatVisitorId.trim() : '';
  const visitorId = typeof o.visitorId === 'string' ? o.visitorId.trim() : '';
  const conversationId = typeof o.conversationId === 'string' ? o.conversationId.trim() : '';
  const startNewConversation = o.startNewConversation === true;
  const speechInput = normalizeSpeechInputFromBody(o.speechInput);
  const embedOrigin = typeof o.embedOrigin === 'string' ? o.embedOrigin.trim() : '';
  return {
    botId,
    message,
    ...(accessKey ? { accessKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(chatVisitorId ? { chatVisitorId } : {}),
    ...(visitorId ? { visitorId } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(startNewConversation ? { startNewConversation: true } : {}),
    ...(speechInput ? { speechInput } : {}),
    ...(embedOrigin ? { embedOrigin } : {}),
  };
}

export function assertEmbedChatHasUserTurn(
  message: string,
  speech: MessageSpeechInput | undefined,
  attachments: MessageAttachment[],
): void {
  const t = message.trim();
  const hasVoice =
    speech?.mode === 'voice' &&
    Boolean((speech.transcript && speech.transcript.trim()) || speech.audioUrl);
  if (attachments.length > 0 || t.length > 0 || hasVoice) return;
  throw new HttpException(
    { error: 'A message, voice note, or file attachment is required.', errorCode: 'BAD_REQUEST' },
    HttpStatus.BAD_REQUEST,
  );
}

export async function uploadWidgetChatAttachments(
  botId: string,
  buffers: Array<{ buffer: Buffer; filename: string; mime: string }>,
): Promise<MessageAttachment[]> {
  const out: MessageAttachment[] = [];
  for (const item of buffers) {
    if (!isAllowedWidgetChatAttachmentFilename(item.filename)) {
      throw new HttpException(
        {
          error:
            'This file type cannot be sent in chat. Allowed: PDF, Excel (XLS/XLSX), CSV, Word (DOC/DOCX), images, GIF, ZIP, RAR, 7Z.',
          errorCode: 'ATTACHMENT_TYPE_NOT_ALLOWED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const lowerName = item.filename.toLowerCase();
    const ext = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.') + 1) : 'bin';
    const uploaded = await uploadPublic({
      prefix: `uploads/widget-chat/${botId}`,
      originalName: `${randomUUID()}.${ext || 'bin'}`,
      contentType: item.mime || 'application/octet-stream',
      body: item.buffer,
    });
    out.push({
      name: item.filename.trim() || 'file',
      mimeType: item.mime || 'application/octet-stream',
      url: uploaded.url,
      size: item.buffer.length,
    });
  }
  return out;
}

/**
 * Multipart widget chat: field `payload` (JSON string) + zero or more `file` parts.
 * Returns the parsed JSON object for route-specific validation (runtime vs preview).
 */
export async function parseEmbedChatMultipartRequest(req: FastifyRequest): Promise<{
  payloadRecord: Record<string, unknown>;
  rawFiles: Array<{ buffer: Buffer; filename: string; mime: string }>;
}> {
  if (!req.isMultipart()) {
    throw new HttpException(
      { error: 'Expected multipart/form-data with a JSON "payload" field.', errorCode: 'BAD_REQUEST' },
      HttpStatus.BAD_REQUEST,
    );
  }
  let payloadStr = '';
  const rawFiles: Array<{ buffer: Buffer; filename: string; mime: string }> = [];
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (part.fieldname !== 'file') {
        throw new HttpException(
          { error: 'Unexpected file field. Use field name "file".', errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (rawFiles.length >= WIDGET_CHAT_ATTACHMENT_MAX_FILES) {
        throw new HttpException(
          {
            error: `At most ${WIDGET_CHAT_ATTACHMENT_MAX_FILES} files per message.`,
            errorCode: 'ATTACHMENT_LIMIT',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const buf = await part.toBuffer();
      if (buf.length > WIDGET_CHAT_ATTACHMENT_MAX_BYTES) {
        throw new HttpException(
          { error: 'Attachment too large', maxBytes: WIDGET_CHAT_ATTACHMENT_MAX_BYTES, errorCode: 'ATTACHMENT_TOO_LARGE' },
          HttpStatus.BAD_REQUEST,
        );
      }
      rawFiles.push({
        buffer: buf,
        filename: (part.filename || 'file').trim() || 'file',
        mime: (part.mimetype || 'application/octet-stream').toLowerCase(),
      });
    } else if (part.type === 'field' && part.fieldname === 'payload') {
      payloadStr = String((part as { value?: unknown }).value ?? '');
    }
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(payloadStr || '{}');
  } catch {
    throw new HttpException({ error: 'Invalid payload JSON', errorCode: 'BAD_REQUEST' }, HttpStatus.BAD_REQUEST);
  }
  if (parsedJson == null || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    throw new HttpException({ error: 'Invalid payload JSON', errorCode: 'BAD_REQUEST' }, HttpStatus.BAD_REQUEST);
  }
  return { payloadRecord: parsedJson as Record<string, unknown>, rawFiles };
}
