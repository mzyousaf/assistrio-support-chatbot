/** Attached to request after session guards run. No role restriction in the type — guards enforce access. */
export type CustomerProfileLinks = {
  linkedinUrl?: string | null;
  calendlyUrl?: string | null;
  websiteUrl?: string | null;
  otherUrl?: string | null;
};

export interface RequestUser {
  _id: unknown;
  email: string;
  role: string;
  /** Google profile — present when stored on the user document. */
  firstName?: string;
  lastName?: string;
  picture?: string;
  displayNameOverride?: string | null;
  pictureOverride?: string | null;
  profileLinks?: CustomerProfileLinks;
}
