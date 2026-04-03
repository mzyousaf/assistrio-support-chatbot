/**
 * Workspace rail widths (must stay in sync with `AdminShell` aside classes).
 * Expanded labeled nav uses the same fluid width as the “In this agent” column.
 */
export const WORKSPACE_SIDEBAR_EXPANDED_PX = 288;
export const WORKSPACE_SIDEBAR_COMPACT_PX = 72;

/**
 * Shared by the expanded workspace aside and the agent sidebar column — scales between ~216px
 * and 288px with viewport so main content keeps room on smaller desktop widths.
 */
export const SIDEBAR_EXPANDED_WIDTH_CLAMP = "clamp(216px, 28vw, 288px)";
