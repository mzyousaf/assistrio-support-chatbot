/** Marketing / funnel visitor kind (mirrors backend `VisitorKind` reads). */
export type AdminVisitorKind = 'marketing' | 'chat' | 'owner_preview' | 'platform';

export type AdminVisitorEventType =
  | 'page_view'
  | 'demo_chat_started'
  | 'cta_clicked'
  | 'demo_opened'
  | 'snippet_copied'
  | 'stable_id_copied'
  | 'reconnect_submitted'
  | 'reconnect_succeeded'
  | 'website_register_started'
  | 'website_register_succeeded'
  | 'widget_runtime_opened'
  | 'quota_viewed'
  | 'assistant_message_feedback'
  | 'widget_speech_completed'
  | string;

/** Reserved for when backend adds query support; currently ignored by API. */
export type AdminVisitorsListParams = {
  q?: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  source?: string;
  event?: string;
};

export type AdminVisitorListItem = {
  _id?: string;
  visitorId: string;
  visitorType: AdminVisitorKind | string;
  name?: string;
  email?: string;
  phone?: string;
  showcaseMessageCount?: number;
  ownBotMessageCount?: number;
  trialPreviewUserMessageCount?: number;
  previewUserMessageCount?: number;
  createdAt?: string | Date;
  lastSeenAt?: string | Date;
};

export type AdminVisitorEventRow = {
  _id: string;
  createdAt: string | null;
  type: AdminVisitorEventType;
  path?: string | null;
  botSlug?: string | null;
};

export type AdminVisitorDetailBot = {
  _id: string;
  name?: string;
  slug?: string;
  createdAt?: string | null;
};

export type AdminVisitorDetailResponse = {
  visitor: AdminVisitorListItem & {
    _id: string;
    createdAt: string | null;
    lastSeenAt: string | null;
  };
  events: AdminVisitorEventRow[];
  bots: AdminVisitorDetailBot[];
  conversationsCount: number;
};
