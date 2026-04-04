/**
 * Shapes aligned with `GET /api/public/bots` and `GET /api/public/bots/:slug` (showcase bots only).
 */
export type PublicBotListItem = {
  id: string;
  name: string;
  slug: string;
  visibility: "public";
  accessKey: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  exampleQuestions: string[];
  chatUI?: {
    primaryColor?: string;
    backgroundStyle?: string;
    bubbleBorderRadius?: number;
    launcherPosition?: string;
    showBranding?: boolean;
    timePosition?: "top" | "bottom";
  };
  createdAt: string;
};

export type PublicBotDetail = {
  id: string;
  slug: string;
  name: string;
  visibility: "public";
  accessKey: string;
  shortDescription: string;
  description?: string;
  category?: string;
  avatarEmoji: string;
  imageUrl: string;
  welcomeMessage?: string;
  chatUI?: unknown;
  faqs: Array<{ question: string; answer: string }>;
  exampleQuestions: string[];
};
