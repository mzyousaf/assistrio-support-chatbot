/** Shape from `GET /api/public/bots/:slug` */
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
