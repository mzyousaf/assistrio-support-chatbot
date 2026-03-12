/**
 * Background FAQ and note embedding jobs: enqueue on content change, process in cron.
 * Re-embed only when embeddingInputHash changed; on success set ready, on failure set failed.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, FaqNoteEmbeddingJob } from '../models';
import type { FaqNoteEmbeddingJobStatus } from '../models';
import { RagService } from '../rag/rag.service';
import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  computeEmbeddingInputHash,
} from './faq-note-embedding.helper';

const EMBED_LOG_PREFIX = '[faq-note-embed]';
const STUCK_JOB_MS = 10 * 60 * 1000; // 10 minutes

export interface EmbeddingStatusFaq {
  index: number;
  embeddingStatus: 'ready' | 'pending' | 'failed';
  embeddingUpdatedAt: string | null;
  embeddingError: string | null;
  hasActiveJob?: boolean;
}

export interface EmbeddingStatusNote {
  embeddingStatus: 'ready' | 'pending' | 'failed';
  embeddingUpdatedAt: string | null;
  embeddingError: string | null;
  hasActiveJob?: boolean;
}

export interface EmbeddingStatusResponse {
  faqs: EmbeddingStatusFaq[];
  note: EmbeddingStatusNote | null;
  hasPending: boolean;
  hasFailed: boolean;
}

@Injectable()
export class FaqNoteEmbeddingJobService {
  constructor(
    @InjectModel(FaqNoteEmbeddingJob.name) private readonly jobModel: Model<FaqNoteEmbeddingJob>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly ragService: RagService,
  ) {}

  /** Check if an active (queued or processing) job exists for this item. */
  private async hasActiveJob(botId: Types.ObjectId, type: 'faq' | 'note', faqIndex?: number): Promise<boolean> {
    const q: { botId: Types.ObjectId; type: string; status: { $in: FaqNoteEmbeddingJobStatus[] }; faqIndex?: number } = {
      botId,
      type,
      status: { $in: ['queued', 'processing'] },
    };
    if (type === 'faq' && faqIndex !== undefined) q.faqIndex = faqIndex;
    const exists = await this.jobModel.findOne(q).select('_id').lean();
    return !!exists;
  }

  /** Enqueue a single job (e.g. retry one FAQ or note). Skips if an active job already exists. */
  async enqueue(botId: string, type: 'faq' | 'note', faqIndex?: number): Promise<void> {
    const botOid = new Types.ObjectId(botId);
    if (await this.hasActiveJob(botOid, type, faqIndex)) {
      console.log(`${EMBED_LOG_PREFIX} enqueue skipped (active job exists) type=${type} botId=${botId} faqIndex=${faqIndex ?? 'n/a'}`);
      return;
    }
    await this.jobModel.create({
      botId: botOid,
      type,
      faqIndex: type === 'faq' ? faqIndex : undefined,
      status: 'queued',
    });
    console.log(`${EMBED_LOG_PREFIX} queued type=${type} botId=${botId} faqIndex=${faqIndex ?? 'n/a'}`);
  }

  /**
   * Enqueue jobs for all FAQs and note that have embeddingStatus === 'pending'.
   * Skips creating a job if one is already queued or processing for that item.
   */
  async enqueueForBot(botId: string): Promise<{ faqCount: number; noteCount: number }> {
    const bot = await this.botModel
      .findById(botId)
      .select('faqs knowledgeDescription noteEmbeddingStatus')
      .lean();
    if (!bot) return { faqCount: 0, noteCount: 0 };
    const botOid = new Types.ObjectId(botId);
    const faqs = (bot as { faqs?: Array<{ embeddingStatus?: string }> }).faqs ?? [];
    let faqCount = 0;
    for (let i = 0; i < faqs.length; i++) {
      if (faqs[i]?.embeddingStatus === 'pending') {
        if (await this.hasActiveJob(botOid, 'faq', i)) continue;
        await this.jobModel.create({
          botId: botOid,
          type: 'faq',
          faqIndex: i,
          status: 'queued',
        });
        faqCount++;
      }
    }
    const noteStatus = (bot as { noteEmbeddingStatus?: string }).noteEmbeddingStatus;
    if (noteStatus === 'pending') {
      if (!(await this.hasActiveJob(botOid, 'note'))) {
        await this.jobModel.create({
          botId: botOid,
          type: 'note',
          status: 'queued',
        });
      }
    }
    const noteCount = noteStatus === 'pending' ? 1 : 0;
    if (faqCount > 0 || noteCount > 0) {
      console.log(`${EMBED_LOG_PREFIX} queued botId=${botId} faqs=${faqCount} note=${noteCount}`);
    }
    return { faqCount, noteCount };
  }

  /**
   * Re-queue jobs stuck in processing longer than STUCK_JOB_MS so they can be retried.
   */
  async resetStuckEmbeddingJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - STUCK_JOB_MS);
    const result = await this.jobModel.updateMany(
      { status: 'processing', startedAt: { $lt: cutoff } },
      { $set: { status: 'queued' as FaqNoteEmbeddingJobStatus, startedAt: undefined, error: undefined } },
    );
    if (result.modifiedCount > 0) {
      console.log(`${EMBED_LOG_PREFIX} re-queued ${result.modifiedCount} stuck job(s)`);
    }
    return result.modifiedCount;
  }

  /**
   * Lightweight embedding status for a bot (for polling). Includes whether each item has an active job.
   */
  async getEmbeddingStatusForBot(botId: string): Promise<EmbeddingStatusResponse> {
    const botOid = new Types.ObjectId(botId);
    const bot = await this.botModel
      .findById(botOid)
      .select('faqs.embeddingStatus faqs.embeddingUpdatedAt faqs.embeddingError noteEmbeddingStatus noteEmbeddingUpdatedAt noteEmbeddingError')
      .lean();
    if (!bot) {
      return { faqs: [], note: null, hasPending: false, hasFailed: false };
    }
    const b = bot as {
      faqs?: Array<{ embeddingStatus?: string; embeddingUpdatedAt?: Date; embeddingError?: string | null }>;
      noteEmbeddingStatus?: string;
      noteEmbeddingUpdatedAt?: Date;
      noteEmbeddingError?: string | null;
    };
    const activeJobs = await this.jobModel
      .find({ botId: botOid, status: { $in: ['queued', 'processing'] } })
      .select('type faqIndex')
      .lean();
    const faqActiveSet = new Set(
      (activeJobs as Array<{ type: string; faqIndex?: number }>)
        .filter((j) => j.type === 'faq' && j.faqIndex !== undefined)
        .map((j) => j.faqIndex as number),
    );
    const noteHasActive = (activeJobs as Array<{ type: string }>).some((j) => j.type === 'note');

    const faqs = (b.faqs ?? []).map((faq, index) => {
      const status = (faq.embeddingStatus === 'ready' || faq.embeddingStatus === 'pending' || faq.embeddingStatus === 'failed'
        ? faq.embeddingStatus
        : 'pending') as 'ready' | 'pending' | 'failed';
      return {
        index,
        embeddingStatus: status,
        embeddingUpdatedAt: faq.embeddingUpdatedAt ? faq.embeddingUpdatedAt.toISOString() : null,
        embeddingError: faq.embeddingError ?? null,
        hasActiveJob: faqActiveSet.has(index),
      };
    });
    const noteStatus = (b.noteEmbeddingStatus === 'ready' || b.noteEmbeddingStatus === 'pending' || b.noteEmbeddingStatus === 'failed'
      ? b.noteEmbeddingStatus
      : 'pending') as 'ready' | 'pending' | 'failed';
    const note = {
      embeddingStatus: noteStatus,
      embeddingUpdatedAt: b.noteEmbeddingUpdatedAt ? b.noteEmbeddingUpdatedAt.toISOString() : null,
      embeddingError: b.noteEmbeddingError ?? null,
      hasActiveJob: noteHasActive,
    };
    const hasPending = faqs.some((f) => f.embeddingStatus === 'pending') || note.embeddingStatus === 'pending';
    const hasFailed = faqs.some((f) => f.embeddingStatus === 'failed') || note.embeddingStatus === 'failed';
    return { faqs, note, hasPending, hasFailed };
  }

  /** Claim one queued job (oldest first). */
  async claimOne(): Promise<(InstanceType<typeof FaqNoteEmbeddingJob> & { _id: Types.ObjectId; botId: Types.ObjectId }) | null> {
    const job = await this.jobModel.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'processing' as FaqNoteEmbeddingJobStatus, startedAt: new Date(), error: undefined } },
      { sort: { createdAt: 1 }, new: true },
    );
    return job ?? null;
  }

  /** Process one claimed job: load content, embed, update bot. */
  async processJob(
    job: { _id: Types.ObjectId; botId: Types.ObjectId; type: 'faq' | 'note'; faqIndex?: number },
  ): Promise<void> {
    const botId = job.botId.toString();
    console.log(`${EMBED_LOG_PREFIX} started type=${job.type} botId=${botId} faqIndex=${job.faqIndex ?? 'n/a'}`);

    const bot = await this.botModel.findById(job.botId).lean();
    if (!bot) {
      await this.markFailed(job, 'bot_not_found');
      return;
    }

    const b = bot as {
      faqs?: Array<{ question?: string; answer?: string; embeddingInputHash?: string; embeddingStatus?: string }>;
      knowledgeDescription?: string;
      noteEmbeddingInputHash?: string;
      noteEmbeddingStatus?: string;
      openaiApiKeyOverride?: string;
    };

    if (job.type === 'faq') {
      const idx = job.faqIndex ?? 0;
      const faqs = b.faqs ?? [];
      const faq = faqs[idx];
      if (!faq) {
        await this.markFailed(job, 'faq_index_out_of_range');
        return;
      }
      const input = buildFaqEmbeddingText(faq.question ?? '', faq.answer ?? '');
      const newHash = computeEmbeddingInputHash(input);
      if (faq.embeddingStatus === 'ready' && faq.embeddingInputHash === newHash) {
        console.log(`${EMBED_LOG_PREFIX} skipped faq (hash unchanged) botId=${botId} faqIndex=${idx}`);
        await this.jobModel.updateOne(
          { _id: job._id },
          { $set: { status: 'done' as FaqNoteEmbeddingJobStatus, finishedAt: new Date() } },
        );
        return;
      }
      try {
        const embedding = await this.ragService.embedText(input, b.openaiApiKeyOverride);
        if (!embedding?.length) {
          await this.markFailed(job, 'empty_embedding');
          await this.setFaqEmbeddingFailed(job.botId, idx, 'empty_embedding');
          return;
        }
        const faqUpdate = {
          [`faqs.${idx}.embedding`]: embedding,
          [`faqs.${idx}.embeddingStatus`]: 'ready',
          [`faqs.${idx}.embeddingUpdatedAt`]: new Date(),
          [`faqs.${idx}.embeddingInputHash`]: newHash,
          [`faqs.${idx}.embeddingError`]: null,
        };
        await this.botModel.updateOne({ _id: job.botId }, { $set: faqUpdate });
        await this.jobModel.updateOne(
          { _id: job._id },
          { $set: { status: 'done' as FaqNoteEmbeddingJobStatus, finishedAt: new Date() } },
        );
        console.log(`${EMBED_LOG_PREFIX} ready type=faq botId=${botId} faqIndex=${idx}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.markFailed(job, msg.slice(0, 200));
        await this.setFaqEmbeddingFailed(job.botId, idx, msg.slice(0, 200));
      }
      return;
    }

    if (job.type === 'note') {
      const text = (b.knowledgeDescription ?? '').trim();
      const input = buildNoteEmbeddingText(undefined, text);
      const newHash = computeEmbeddingInputHash(input);
      if (b.noteEmbeddingStatus === 'ready' && b.noteEmbeddingInputHash === newHash) {
        console.log(`${EMBED_LOG_PREFIX} skipped note (hash unchanged) botId=${botId}`);
        await this.jobModel.updateOne(
          { _id: job._id },
          { $set: { status: 'done' as FaqNoteEmbeddingJobStatus, finishedAt: new Date() } },
        );
        return;
      }
      try {
        const embedding = await this.ragService.embedText(input, b.openaiApiKeyOverride);
        if (!embedding?.length) {
          await this.markFailed(job, 'empty_embedding');
          await this.setNoteEmbeddingFailed(job.botId, 'empty_embedding');
          return;
        }
        await this.botModel.updateOne(
          { _id: job.botId },
          {
            $set: {
              noteEmbedding: embedding,
              noteEmbeddingStatus: 'ready',
              noteEmbeddingUpdatedAt: new Date(),
              noteEmbeddingInputHash: newHash,
              noteEmbeddingError: null,
            },
          },
        );
        await this.jobModel.updateOne(
          { _id: job._id },
          { $set: { status: 'done' as FaqNoteEmbeddingJobStatus, finishedAt: new Date() } },
        );
        console.log(`${EMBED_LOG_PREFIX} ready type=note botId=${botId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.markFailed(job, msg.slice(0, 200));
        await this.setNoteEmbeddingFailed(job.botId, msg.slice(0, 200));
      }
    }
  }

  async markFailed(
    job: { _id: Types.ObjectId },
    error: string,
  ): Promise<void> {
    await this.jobModel.updateOne(
      { _id: job._id },
      { $set: { status: 'failed' as FaqNoteEmbeddingJobStatus, error, finishedAt: new Date() } },
    );
    console.log(`${EMBED_LOG_PREFIX} failed jobId=${job._id} type=${(job as { type?: string }).type} reason=${error.slice(0, 80)}`);
  }

  private async setFaqEmbeddingFailed(botId: Types.ObjectId, faqIndex: number, error: string): Promise<void> {
    await this.botModel.updateOne(
      { _id: botId },
      {
        $set: {
          [`faqs.${faqIndex}.embeddingStatus`]: 'failed',
          [`faqs.${faqIndex}.embeddingError`]: error.slice(0, 200),
        },
      },
    );
  }

  private async setNoteEmbeddingFailed(botId: Types.ObjectId, error: string): Promise<void> {
    await this.botModel.updateOne(
      { _id: botId },
      {
        $set: {
          noteEmbeddingStatus: 'failed',
          noteEmbeddingError: error.slice(0, 200),
        },
      },
    );
  }

  /**
   * Backfill: enqueue jobs for all FAQs and note that are not ready (missing or pending or failed).
   * Skips items whose current content hash already matches stored hash when status is ready.
   * Does not create duplicate jobs if an active job already exists for an item.
   */
  async enqueueBackfillForBot(botId: string, batchSize = 20): Promise<{ enqueued: number }> {
    const bot = await this.botModel
      .findById(botId)
      .select('faqs knowledgeDescription noteEmbeddingStatus noteEmbeddingInputHash')
      .lean();
    if (!bot) return { enqueued: 0 };
    const b = bot as {
      faqs?: Array<{ question?: string; answer?: string; embeddingInputHash?: string; embeddingStatus?: string }>;
      knowledgeDescription?: string;
      noteEmbeddingInputHash?: string;
      noteEmbeddingStatus?: string;
    };
    const botOid = new Types.ObjectId(botId);
    let enqueued = 0;
    const faqs = b.faqs ?? [];
    for (let i = 0; i < Math.min(faqs.length, batchSize); i++) {
      const faq = faqs[i];
      if (!faq?.question && !faq?.answer) continue;
      const status = faq.embeddingStatus;
      const input = buildFaqEmbeddingText(faq.question ?? '', faq.answer ?? '');
      const newHash = computeEmbeddingInputHash(input);
      if (status === 'ready' && faq.embeddingInputHash === newHash) continue;
      if (await this.hasActiveJob(botOid, 'faq', i)) continue;
      await this.jobModel.create({
        botId: botOid,
        type: 'faq',
        faqIndex: i,
        status: 'queued',
      });
      enqueued++;
    }
    const noteText = (b.knowledgeDescription ?? '').trim();
    if (noteText && b.noteEmbeddingStatus !== 'ready') {
      if (!(await this.hasActiveJob(botOid, 'note'))) {
        await this.jobModel.create({
          botId: botOid,
          type: 'note',
          status: 'queued',
        });
        enqueued++;
      }
    }
    if (enqueued > 0) {
      console.log(`${EMBED_LOG_PREFIX} backfill queued botId=${botId} count=${enqueued}`);
    }
    return { enqueued };
  }
}
