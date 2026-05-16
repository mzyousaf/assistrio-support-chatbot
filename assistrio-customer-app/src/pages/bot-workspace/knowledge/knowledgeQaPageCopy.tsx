import {
  KnowledgeFieldInfoIcon,
  KnowledgeHeadingInfoIcon,
} from './knowledgeFieldInfoIcon';

export const QA_FIELD_TITLE_HINT =
  'Shown in your library. With an answer, either a title or at least one question is required.';

export const QA_FIELD_QUESTIONS_HINT =
  'Each question is a separate phrasing, but all of them share one UTF-8 size budget for this entry. With an answer, either questions or a title is required.';

export const QA_FIELD_ANSWER_HINT = 'Aim for one short paragraph.';

export const QA_EDIT_TITLE_INFO =
  'Changes save to this assistant’s knowledge base. Training may run again after you save.';

/** Lead line under the Q&A editor page title (matches snippet editor pattern). */
export const QA_EDIT_PAGE_LEAD =
  'Questions and answers the model can use. Update the fields below, then save your changes.';

export const QA_LIST_AND_DETAIL_TITLE_INFO =
  'Preset answers for important topics. Your Agent checks Q&A before the rest of your knowledge.';

export const QaFieldInfoIcon = KnowledgeFieldInfoIcon;
export const QaHeadingInfoIcon = KnowledgeHeadingInfoIcon;
