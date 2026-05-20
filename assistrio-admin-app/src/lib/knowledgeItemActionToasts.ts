import { appToast } from '@/lib/app-toast';

/** Success after PATCH `useInReplies` — title + body for Sonner. */
export function knowledgeUseInRepliesSuccessCopy(included: boolean): { title: string; description: string } {
  return included
    ? {
        title: 'Included in assistant replies',
        description:
          'This knowledge can be retrieved when your assistant generates answers, once it is trained and eligible.',
      }
    : {
        title: 'Excluded from assistant replies',
        description:
          'The item stays in your library but will not be used when generating replies until you include it again.',
      };
}

export function knowledgeUseInRepliesErrorCopy(apiDetail?: string): { title: string; description: string } {
  const detail = apiDetail?.trim();
  return {
    title: 'Reply settings could not be saved',
    description:
      detail ||
      'Check your connection and try again. If the problem continues, contact support.',
  };
}

export function toastKnowledgeUseInRepliesSaved(included: boolean): void {
  const c = knowledgeUseInRepliesSuccessCopy(included);
  appToast.success(c.title, { description: c.description });
}

export function toastKnowledgeUseInRepliesSaveFailed(apiDetail?: string): void {
  const c = knowledgeUseInRepliesErrorCopy(apiDetail);
  appToast.error(c.title, { description: c.description });
}

/** Success after PATCH suggestion hide-chip-text — widget-only visibility. */
export function knowledgeHideLabelInChatSuccessCopy(hidden: boolean): { title: string; description: string } {
  return hidden
    ? {
        title: 'Chip is hidden',
        description:
          'Visitors will not see this starter chip in the chat widget. Training and use in replies are unchanged.',
      }
    : {
        title: 'Chip is visible',
        description:
          'The chip can appear in the chat widget again when suggestion chips are enabled.',
      };
}

export function knowledgeHideLabelInChatErrorCopy(apiDetail?: string): { title: string; description: string } {
  const detail = apiDetail?.trim();
  return {
    title: 'Chip in chat could not be updated',
    description: detail || 'Please try again in a moment.',
  };
}

export function toastKnowledgeHideLabelInChatSaved(hidden: boolean): void {
  const c = knowledgeHideLabelInChatSuccessCopy(hidden);
  appToast.success(c.title, { description: c.description });
}

export function toastKnowledgeHideLabelInChatSaveFailed(apiDetail?: string): void {
  const c = knowledgeHideLabelInChatErrorCopy(apiDetail);
  appToast.error(c.title, { description: c.description });
}
