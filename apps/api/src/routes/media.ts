// Media routes (design P2.3.9 + G-7 USER OVERRIDE playback) — Unit B.
//
//   POST /media/presign   — issue a presigned R2 PUT URL (FR-A1 / AC-5).
//   GET  /media/:id/url    — issue a presigned R2 GET URL for playback (G-7).
//
// The two-step persistence flow (G-3): presign issues the URL ONLY and creates
// NO media row; the row is recorded later by POST /events/:id/media (events.ts)
// after the device confirms the direct upload. Bytes NEVER transit the API
// (NFR-2) — the device PUTs straight to R2.
//
// Lazy R2 config (R-4): getR2Config() is invoked inside the handlers (via the
// presign helpers). If any R2 var is missing it THROWS; the handler catches and
// returns 503 { error: 'media storage not configured' } (NFR-4 — fail fast, no
// fabricated URL). Read endpoints stay testable without R2 creds.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { PresignResponse, MediaPlaybackUrlDTO } from '@tailsup/shared';
import { db } from '../db/client.js';
import { behaviorEvent, media as mediaTable } from '../db/schema.js';
import {
  ALLOWED_CONTENT_TYPES,
  PRESIGN_EXPIRES_IN_SECONDS,
  presignGetUrl,
  presignPutUrl,
} from '../lib/r2.js';

// Request body for POST /media/presign (G-6 allow-set — disallowed type → 400).
const presignBody = z.object({
  eventId: z.string().min(1),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
});

export const media = new Hono();

// ── POST /media/presign (FR-A1 / AC-5) ─────────────────────────────────────────
media.post('/media/presign', zValidator('json', presignBody), async (c) => {
  const { eventId, contentType } = c.req.valid('json');

  // 1. Verify the event exists (404).
  const [eventRow] = await db
    .select()
    .from(behaviorEvent)
    .where(eq(behaviorEvent.id, eventId))
    .limit(1);

  if (!eventRow) {
    return c.json({ error: 'event not found' }, 404);
  }

  // 2. Presign — getR2Config() throws if R2 is unconfigured → 503 (NFR-4).
  let response: PresignResponse;
  try {
    response = await presignPutUrl({ eventId, contentType });
  } catch {
    return c.json({ error: 'media storage not configured' }, 503);
  }

  return c.json(response, 200);
});

// ── GET /media/:id/url (G-7 USER OVERRIDE — playback via presigned GET) ─────────
media.get('/media/:id/url', async (c) => {
  const id = c.req.param('id');

  // 1. Look up the media row (404 if missing).
  const [mediaRow] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, id))
    .limit(1);

  if (!mediaRow) {
    return c.json({ error: 'media not found' }, 404);
  }

  // 2. Recover the object key from the stored blobUrl. blobUrl is the canonical
  //    S3-style reference https://<account>.r2.cloudflarestorage.com/<bucket>/<key>;
  //    the key is everything after the bucket segment.
  const key = keyFromBlobUrl(mediaRow.blobUrl);

  // 3. Presign a GET — getR2Config() throws if R2 is unconfigured → 503 (NFR-4).
  let url: string;
  try {
    url = await presignGetUrl(key);
  } catch {
    return c.json({ error: 'media storage not configured' }, 503);
  }

  const dto: MediaPlaybackUrlDTO = {
    url,
    expiresInSeconds: PRESIGN_EXPIRES_IN_SECONDS,
  };
  return c.json(dto, 200);
});

// Extract the R2 object key from a stored blobUrl. The blobUrl is written as
// `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>` (events.ts), so the
// key is the path with the leading `/<bucket>/` stripped. Falls back to the raw
// pathname if the shape is unexpected (defensive — never throws here).
function keyFromBlobUrl(blobUrl: string): string {
  try {
    const { pathname } = new URL(blobUrl);
    // pathname is `/<bucket>/<key...>` — drop the leading slash + bucket segment.
    const trimmed = pathname.replace(/^\/+/, '');
    const slash = trimmed.indexOf('/');
    return slash === -1 ? trimmed : trimmed.slice(slash + 1);
  } catch {
    // Not a URL (e.g. a bare key was stored) — use it as-is.
    return blobUrl.replace(/^\/+/, '');
  }
}
