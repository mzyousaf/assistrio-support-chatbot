/** Bot card row from landing list APIs. */
export type PublicBot = {
  id: string;
  name: string;
  slug: string;
  accessKey: string;
  visibility: "public";
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  createdAt: string;
};
