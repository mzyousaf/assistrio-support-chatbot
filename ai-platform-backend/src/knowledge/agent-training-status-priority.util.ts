/**
 * Canonical UX phase for GET `/knowledge/training/status` (`displayPhase`).
 * In-flight import / extraction / training outrank action-needed (`training_required`) and terminal mixes (`failed` / `partially_ready`).
 */

export type AgentTrainingCanonicalDisplayPhase =
  | 'empty'
  | 'ready'
  | 'training_required'
  | 'extracting'
  | 'importing'
  | 'training'
  | 'partially_ready'
  | 'failed';

export type ResolveCanonicalAgentTrainingPhaseInput = {
  totalTrackedItems: number;
  readyItems: number;
  failedItems: number;
  actionableItems: number;
  trainingPipelineItems: number;
  extractingCount: number;
  datasheetImportPipelineCount: number;
  trainingQueuedCount: number;
  trainingProcessingCount: number;
};

/**
 * Priority:
 * 1. importing — datasheet async import queued or running
 * 2. extracting — document text extraction (or supplement count)
 * 3. training — embedding queue/processing
 * 4. failed — no ready items, at least one failed
 * 5. partially_ready — some ready, some failed
 * 6. training_required — actionable work, pipeline idle
 * 7. empty — no tracked items
 * 8. ready — default steady state
 */
export function resolveCanonicalAgentTrainingDisplayPhase(
  input: ResolveCanonicalAgentTrainingPhaseInput,
): AgentTrainingCanonicalDisplayPhase {
  const {
    totalTrackedItems,
    readyItems,
    failedItems,
    actionableItems,
    trainingPipelineItems,
    extractingCount,
    datasheetImportPipelineCount,
    trainingQueuedCount,
    trainingProcessingCount,
  } = input;

  if (totalTrackedItems === 0) {
    return 'empty';
  }

  const importing = datasheetImportPipelineCount > 0;
  const extracting = extractingCount > 0;
  const trainingActive =
    trainingPipelineItems > 0 || trainingQueuedCount > 0 || trainingProcessingCount > 0;

  if (importing) return 'importing';
  if (extracting) return 'extracting';
  if (trainingActive) return 'training';

  if (readyItems === 0 && failedItems > 0) return 'failed';
  if (readyItems > 0 && failedItems > 0) return 'partially_ready';
  if (actionableItems > 0) return 'training_required';

  return 'ready';
}

const DISPLAY_PHASE_LABEL: Record<AgentTrainingCanonicalDisplayPhase, string> = {
  empty: 'No knowledge yet',
  ready: 'Trained',
  training_required: 'Training queued',
  extracting: 'Extracting',
  importing: 'Importing',
  training: 'Training',
  partially_ready: 'Partially trained',
  failed: 'Training failed',
};

export function agentTrainingCanonicalDisplayLabel(phase: AgentTrainingCanonicalDisplayPhase): string {
  return DISPLAY_PHASE_LABEL[phase];
}

/** Legacy `status` on AgentTrainingStatusResponse for older clients. */
export function legacyTrainingStatusFieldFromDisplayPhase(
  phase: AgentTrainingCanonicalDisplayPhase,
): 'trained' | 'training' | 'needs_training' | 'failed' {
  switch (phase) {
    case 'failed':
      return 'failed';
    case 'training_required':
      return 'needs_training';
    case 'empty':
      return 'trained';
    case 'importing':
    case 'extracting':
    case 'training':
      return 'training';
    case 'partially_ready':
    case 'ready':
    default:
      return 'trained';
  }
}

/** @deprecated Prefer {@link resolveCanonicalAgentTrainingDisplayPhase} — kept for unit tests covering old 3-bucket pre-import ordering. */
export function resolveAgentTrainingDisplayPhase(
  actionableItems: number,
  trainingPipelineItems: number,
): 'needs_training' | 'training' | 'trained' {
  if (trainingPipelineItems > 0) return 'training';
  if (actionableItems > 0) return 'needs_training';
  return 'trained';
}
