import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { deletePrivateObject } from '../lib/s3';
import { Bot } from '../models/bot.schema';
import { KnowledgeBaseItem } from '../models/knowledge-base-item.schema';
import { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';
import { Conversation } from '../models/conversation.schema';
import { Message } from '../models/message.schema';
import { VisitorEvent } from '../models/visitor-event.schema';
import { ExtractJob } from '../models/extract-job.schema';
import { TrainJob } from '../models/train-job.schema';
import { SummaryJob } from '../models/summary-job.schema';
import { TableImportJob } from '../models/table-import-job.schema';
import { TableImportSession } from '../models/table-import-session.schema';
import {
  KnowledgeItemPurgeService,
  emptyKbItemHardPurgeStats,
  mergeKbItemHardPurgeStats,
  type KbItemHardPurgeStats,
} from './knowledge-item-purge.service';
import { botIsEffectivelyDeleted } from '../bots/bot-not-deleted.util';

function botPurgeAfterMinutes(): number {
  const n = Math.floor(Number(process.env.BOT_PURGE_AFTER_MINUTES) || 1440);
  return Number.isFinite(n) && n >= 1 ? n : 1440;
}

function botPurgeBatchLimit(): number {
  const n = Math.floor(Number(process.env.BOT_PURGE_BATCH_LIMIT) || 25);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 200) : 25;
}

type KbItemLean = {
  _id: Types.ObjectId;
  botId: Types.ObjectId;
  sourceType: string;
  fileMeta?: Record<string, unknown>;
};

/** Flat counts for worker cron logging (items + per-bot transaction cascade). */
export type BotPurgeRunResult = {
  purged: number;
  eligibleCount: number;
  botPurgeErrors: number;
  chunksDeleted: number;
  kbItemsDeleted: number;
  extractJobsDeleted: number;
  trainJobsDeleted: number;
  summaryJobsDeleted: number;
  tableImportJobsDeleted: number;
  tableSessionsDeleted: number;
  conversationsDeleted: number;
  messagesDeleted: number;
  visitorEventsDeleted: number;
  s3DeleteAttempted: number;
  s3DeleteFailed: number;
};

/**
 * Hard-deletes bots that were soft-deleted ({@link Bot.deletedAt}) after a grace period.
 * Idempotent: missing bot or already purged data is ignored.
 */
@Injectable()
export class BotPurgeService {
  private readonly log = new Logger(BotPurgeService.name);

  constructor(
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(KnowledgeBaseItem.name) private readonly itemModel: Model<KnowledgeBaseItem>,
    @InjectModel(KnowledgeBaseChunk.name) private readonly chunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    @InjectModel(SummaryJob.name) private readonly summaryJobModel: Model<SummaryJob>,
    @InjectModel(TableImportJob.name) private readonly tableImportJobModel: Model<TableImportJob>,
    @InjectModel(TableImportSession.name) private readonly tableImportSessionModel: Model<TableImportSession>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    private readonly knowledgeItemPurgeService: KnowledgeItemPurgeService,
  ) {}

  async purgeDueBots(): Promise<BotPurgeRunResult> {
    const graceMs = botPurgeAfterMinutes() * 60_000;
    const cutoff = new Date(Date.now() - graceMs);
    const lim = botPurgeBatchLimit();
    const rows = await this.botModel
      .find({
        active: false,
        deletedAt: { $lte: cutoff },
      })
      .select('_id imageUrl')
      .limit(lim)
      .lean();

    const itemAcc = emptyKbItemHardPurgeStats();
    let txnExtract = 0;
    let txnTrain = 0;
    let txnSummary = 0;
    let txnTableJob = 0;
    let txnTableSession = 0;
    let txnMsg = 0;
    let txnConv = 0;
    let txnVisitor = 0;
    let txnChunks = 0;
    let txnKbItems = 0;
    let kbItemsPurgedInLoopTotal = 0;
    let avatarAttempted = 0;
    let avatarFailed = 0;
    let purged = 0;
    let botPurgeErrors = 0;
    for (const row of rows) {
      try {
        const one = await this.hardPurgeOneBot(String(row._id), row as { imageUrl?: string });
        mergeKbItemHardPurgeStats(itemAcc, one.fromItems);
        txnExtract += one.txn.extractJobsDeleted;
        txnTrain += one.txn.trainJobsDeleted;
        txnSummary += one.txn.summaryJobsDeleted;
        txnTableJob += one.txn.tableImportJobsDeleted;
        txnTableSession += one.txn.tableSessionsDeleted;
        txnMsg += one.txn.messagesDeleted;
        txnConv += one.txn.conversationsDeleted;
        txnVisitor += one.txn.visitorEventsDeleted;
        txnChunks += one.txn.chunksDeleted;
        txnKbItems += one.txn.kbItemsDeleted;
        kbItemsPurgedInLoopTotal += one.kbItemsPurgedInLoop;
        avatarAttempted += one.avatarS3.attempted;
        avatarFailed += one.avatarS3.failed;
        if (one.purgedBot) {
          purged += 1;
        }
      } catch (e) {
        botPurgeErrors += 1;
        const msg = e instanceof Error ? e.message : String(e);
        this.log.warn(`purge bot ${String(row._id)} failed: ${msg}`);
      }
    }
    return {
      purged,
      eligibleCount: rows.length,
      botPurgeErrors,
      chunksDeleted: itemAcc.chunksDeleted + txnChunks,
      kbItemsDeleted: kbItemsPurgedInLoopTotal + txnKbItems,
      extractJobsDeleted: itemAcc.extractJobsDeleted + txnExtract,
      trainJobsDeleted: itemAcc.trainDocumentJobsDeleted + txnTrain,
      summaryJobsDeleted: txnSummary,
      tableImportJobsDeleted: itemAcc.tableImportJobsDeleted + txnTableJob,
      tableSessionsDeleted: itemAcc.tableSessionsDeleted + txnTableSession,
      conversationsDeleted: txnConv,
      messagesDeleted: txnMsg,
      visitorEventsDeleted: txnVisitor,
      s3DeleteAttempted: itemAcc.s3DeleteAttempted + avatarAttempted,
      s3DeleteFailed: itemAcc.s3DeleteFailed + avatarFailed,
    };
  }

  private async bestEffortDeleteAvatar(imageUrl: string | undefined): Promise<{ attempted: number; failed: number }> {
    const url = String(imageUrl ?? '').trim();
    if (!url || !/\/uploads\/bot-avatars\//i.test(url)) return { attempted: 0, failed: 0 };
    try {
      const u = new URL(url, 'http://dummy');
      const key = u.pathname.replace(/^\/+/, '');
      const bucket = process.env.S3_PUBLIC_BUCKET?.trim() ?? '';
      if (!bucket || !key) return { attempted: 0, failed: 0 };
      await deletePrivateObject(bucket, key);
      return { attempted: 1, failed: 0 };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`S3 avatar purge failed: ${msg}`);
      return { attempted: 1, failed: 1 };
    }
  }

  private async hardPurgeOneBot(
    botId: string,
    botMeta?: { imageUrl?: string },
  ): Promise<{
    purgedBot: boolean;
    kbItemsPurgedInLoop: number;
    fromItems: KbItemHardPurgeStats;
    txn: {
      extractJobsDeleted: number;
      trainJobsDeleted: number;
      summaryJobsDeleted: number;
      tableImportJobsDeleted: number;
      tableSessionsDeleted: number;
      messagesDeleted: number;
      conversationsDeleted: number;
      visitorEventsDeleted: number;
      chunksDeleted: number;
      kbItemsDeleted: number;
    };
    avatarS3: { attempted: number; failed: number };
  }> {
    const emptyTxn = () => ({
      extractJobsDeleted: 0,
      trainJobsDeleted: 0,
      summaryJobsDeleted: 0,
      tableImportJobsDeleted: 0,
      tableSessionsDeleted: 0,
      messagesDeleted: 0,
      conversationsDeleted: 0,
      visitorEventsDeleted: 0,
      chunksDeleted: 0,
      kbItemsDeleted: 0,
    });

    if (!Types.ObjectId.isValid(botId)) {
      return {
        purgedBot: false,
        kbItemsPurgedInLoop: 0,
        fromItems: emptyKbItemHardPurgeStats(),
        txn: emptyTxn(),
        avatarS3: { attempted: 0, failed: 0 },
      };
    }
    const botOid = new Types.ObjectId(botId);

    const botRow = await this.botModel.findById(botOid).select('active deletedAt imageUrl').lean();
    if (!botRow) {
      return {
        purgedBot: false,
        kbItemsPurgedInLoop: 0,
        fromItems: emptyKbItemHardPurgeStats(),
        txn: emptyTxn(),
        avatarS3: { attempted: 0, failed: 0 },
      };
    }
    if (!botIsEffectivelyDeleted(botRow as { active?: boolean; deletedAt?: Date | null })) {
      return {
        purgedBot: false,
        kbItemsPurgedInLoop: 0,
        fromItems: emptyKbItemHardPurgeStats(),
        txn: emptyTxn(),
        avatarS3: { attempted: 0, failed: 0 },
      };
    }

    const avatarS3 = await this.bestEffortDeleteAvatar(
      (botMeta?.imageUrl ?? (botRow as { imageUrl?: string }).imageUrl) as string | undefined,
    );

    const items = (await this.itemModel
      .find({ botId: botOid })
      .select('_id botId sourceType fileMeta')
      .lean()) as KbItemLean[];

    const fromItems = emptyKbItemHardPurgeStats();
    let kbItemsPurgedInLoop = 0;
    for (const item of items) {
      try {
        const st = await this.knowledgeItemPurgeService.hardPurgeKnowledgeItemRow(item);
        mergeKbItemHardPurgeStats(fromItems, st);
        kbItemsPurgedInLoop += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.warn(`purge bot ${botId} kb item ${String(item._id)}: ${msg}`);
      }
    }

    const session = await this.botModel.db.startSession();
    session.startTransaction();
    try {
      const [
        exRes,
        trRes,
        suRes,
        tjRes,
        tsRes,
        msgRes,
        convRes,
        visRes,
        chRes,
        kbRes,
      ] = await Promise.all([
        this.extractJobModel.deleteMany({ botId: botOid }).session(session),
        this.trainJobModel.deleteMany({ botId: botOid }).session(session),
        this.summaryJobModel.deleteMany({ botId: botOid }).session(session),
        this.tableImportJobModel.deleteMany({ botId: botOid }).session(session),
        this.tableImportSessionModel.deleteMany({ botId: botOid }).session(session),
        this.messageModel.deleteMany({ botId: botOid }).session(session),
        this.conversationModel.deleteMany({ botId: botOid }).session(session),
        this.visitorEventModel.deleteMany({ botId: botOid }).session(session),
        this.chunkModel.deleteMany({ botId: botOid }).session(session),
        this.itemModel.deleteMany({ botId: botOid }).session(session),
      ]);
      await this.botModel.deleteOne({ _id: botOid }).session(session);
      await session.commitTransaction();
      return {
        purgedBot: true,
        kbItemsPurgedInLoop,
        fromItems,
        txn: {
          extractJobsDeleted: exRes.deletedCount ?? 0,
          trainJobsDeleted: trRes.deletedCount ?? 0,
          summaryJobsDeleted: suRes.deletedCount ?? 0,
          tableImportJobsDeleted: tjRes.deletedCount ?? 0,
          tableSessionsDeleted: tsRes.deletedCount ?? 0,
          messagesDeleted: msgRes.deletedCount ?? 0,
          conversationsDeleted: convRes.deletedCount ?? 0,
          visitorEventsDeleted: visRes.deletedCount ?? 0,
          chunksDeleted: chRes.deletedCount ?? 0,
          kbItemsDeleted: kbRes.deletedCount ?? 0,
        },
        avatarS3,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}
