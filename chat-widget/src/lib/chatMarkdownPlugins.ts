import remarkGfm from "remark-gfm";

import { remarkStripInlineCitationNodes } from "./remarkStripInlineCitationNodes";

/** GFM tables/lists + strip numeric citation links before HTML render. */
export const chatRemarkPlugins = [remarkGfm, remarkStripInlineCitationNodes];
