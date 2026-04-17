/** Attached to request after session guards run. No role restriction in the type — guards enforce access. */
export interface RequestUser {
  _id: unknown;
  email: string;
  role: string;
  /** Google profile — present when stored on the user document. */
  firstName?: string;
  lastName?: string;
  picture?: string;
}
