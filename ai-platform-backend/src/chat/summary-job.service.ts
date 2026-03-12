/**
 * Background summary job: enqueue from chat engine, process in cron.
 * Reuses existing job pattern (queued -> processing -> done/failed).
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, Conversation, Message, SummaryJob } from '../models';
import type { SummaryJobStatus } from '../models';
import { chatLog } from './chat-logger';
import { generateConversationSummary } from './conversation-summary.helper';
import { AI_CALL_TIMEOUTS } from '../lib/ai-call.helper';
import { withTimeout } from '../lib/ai-call.helper';

const SUMMARY_JOB_RECENT_MS = 60_000; // do not enqueue if a job was queued/processing in last 60s

@Injectable()
export class SummaryJobService {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(SummaryJob.name) private readonly summaryJobModel: Model<SummaryJob>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
  ) {}

  /**
   * Enqueue a summary job if eligible and no recent job for this conversation.
   * Returns true if enqueued.
   */
  async enqueue(conversationId: Types.ObjectId, botId: Types.ObjectId): Promise<boolean> {
    const recent = new Date(Date.now() - SUMMARY_JOB_RECENT_MS);
    const existing = await this.summaryJobModel.findOne({
      conversationId,
      status: { $in: ['queued', 'processing'] as SummaryJobStatus[] },
      createdAt: { $gte: recent },
    });
    if (existing) return false;
    await this.summaryJobModel.create({
      conversationId,
      botId,
      status: 'queued',
    });
    chatLog({
      event: 'chat.summary_job_enqueued',
      level: 'info',
      conversationId: conversationId.toString(),
      botId: botId.toString(),
    });
    return true;
  }

  /** Claim one queued job (oldest first). Returns job or null. */
  async claimOne(): Promise<(InstanceType<typeof SummaryJob> & { _id: Types.ObjectId; conversationId: Types.ObjectId; botId: Types.ObjectId }) | null> {
    const startedAt = new Date();
    const job = await this.summaryJobModel.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'processing', startedAt, error: undefined } },
      { sort: { createdAt: 1 }, new: true },
    );
    return job ?? null;
  }

  /** Process one claimed job: load conversation/messages, generate summary, update conversation. */
  async processJob(
    job: { _id: Types.ObjectId; conversationId: Types.ObjectId; botId: Types.ObjectId },
  ): Promise<void> {
    chatLog({
      event: 'chat.summary_job_started',
      level: 'info',
      conversationId: job.conversationId.toString(),
      botId: job.botId.toString(),
    });
    const conversation = await this.conversationModel.findById(job.conversationId).lean();
    if (!conversation) {
      await this.markFailed(job, 'conversation_not_found');
      return;
    }
    const bot = await this.botModel.findById(job.botId).select('openaiApiKeyOverride').lean();
    const apiKey =
      (bot as { openaiApiKeyOverride?: string })?.openaiApiKeyOverride?.trim() ||
      this.config.get<string>('openaiApiKey')?.trim() ||
      '';
    if (!apiKey) {
      await this.markFailed(job, 'missing_openai_key');
      return;
    }
    const messages = await this.messageModel
      .find({ conversationId: job.conversationId })
      .sort({ createdAt: 1 })
      .select({ role: 1, content: 1 })
      .lean();
    const messagesForSummary = messages.map((m) => ({
      role: String((m as { role?: string }).role || 'user'),
      content: String((m as { content?: string }).content || ''),
    }));
    const conv = conversation as { summary?: string; capturedLeadData?: Record<string, string> };
    const previousSummary = conv.summary;
    const capturedLeadData = conv.capturedLeadData ?? {};
    try {
      const summary = await withTimeout(
        generateConversationSummary(
          { messages: messagesForSummary, previousSummary, capturedLeadData },
          apiKey,
        ),
        AI_CALL_TIMEOUTS.summary,
        'summary',
      );
      if (summary) {
        await this.conversationModel.updateOne(
          { _id: job.conversationId },
          { $set: { summary } },
        );
      }
      await this.summaryJobModel.updateOne(
        { _id: job._id },
        { $set: { status: 'done', finishedAt: new Date(), error: undefined } },
      );
      chatLog({
        event: 'chat.summary_job_completed',
        level: 'info',
        conversationId: job.conversationId.toString(),
        botId: job.botId.toString(),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const safe = reason.slice(0, 80).replace(/[^\w\s-]/g, '');
      await this.markFailed(job, safe || 'unknown');
      chatLog({
        event: 'chat.summary_job_failed',
        level: 'warn',
        conversationId: job.conversationId.toString(),
        botId: job.botId.toString(),
        reason: safe,
      });
    }
  }

  async markFailed(
    job: { _id: Types.ObjectId },
    error: string,
  ): Promise<void> {
    await this.summaryJobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', error: error.slice(0, 200), finishedAt: new Date() } },
    );
  }
}
