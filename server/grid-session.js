import { createHash } from "node:crypto";

export const gridSubject = process.env.GIFT_GRID_LIVE_SUBJECT?.trim();
export const gridStorageKey = gridSubject ? createHash("sha256").update(gridSubject).digest("hex") : null;
