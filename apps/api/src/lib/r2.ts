// R2 client + presign module (design P2.4) — owned by Unit B.
//
// Encapsulates the Cloudflare R2 S3 client, the LAZY config accessor, and the
// presign helpers. Imported only by routes/media.ts (presign + playback) and
// routes/events.ts (to derive blobUrl). The AWS SDK lives ONLY here in apps/api
// (NFR-5) — never in @tailsup/shared, never in mobile.
//
// CRITICAL (R-1): the two checksum flags on the S3Client are MANDATORY. AWS SDK
// >= v3.729 auto-adds an x-amz-checksum-crc32 the SDK signs into the request;
// R2 REJECTS it (NotImplemented / SignatureDoesNotMatch). Setting both to
// 'WHEN_REQUIRED' suppresses the auto-checksum so the presigned PUT is
// R2-compatible.
//
// LAZY config (R-4): R2 vars are read only inside getR2Config(), invoked at
// handler call time — NOT at module top-level / config.ts. This keeps the API
// bootable and the whole vitest suite runnable WITHOUT R2 creds (read-endpoint
// tests need none), while still throwing clearly on a missing var (NFR-4 — no
// silent fallback, no fabricated URL). The presign handler maps the throw → 503.

import { randomUUID } from 'node:crypto';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PresignResponse } from '@tailsup/shared';

// Allowed upload content types (G-6). Shared with the route-level Zod schemas.
export const ALLOWED_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const;
export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

// Presigned URL lifetime in seconds (G-5 — 10 minutes).
export const PRESIGN_EXPIRES_IN_SECONDS = 600;

// contentType -> file extension for the object key.
const EXT_BY_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

// ── Lazy config — read R2 vars at call time, never at module top-level ─────────
// Mirrors config.ts' throw-on-missing discipline (NFR-4) WITHOUT putting R2 vars
// in config.ts (which would break boot + the read-endpoint vitest suite — R-4).
function requiredR2(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function getR2Config(): R2Config {
  return {
    accountId: requiredR2('R2_ACCOUNT_ID'),
    accessKeyId: requiredR2('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredR2('R2_SECRET_ACCESS_KEY'),
    bucket: requiredR2('R2_BUCKET'),
  };
}

// Build an S3Client pointed at the R2 S3 endpoint for the given account.
function r2Client(cfg: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // ── MANDATORY for R2 (R-1) ────────────────────────────────────────────────
    // Suppress the AWS SDK >= v3.729 auto CRC32 checksum, which R2 rejects.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    // forcePathStyle is NOT needed for the
    // https://<account>.r2.cloudflarestorage.com endpoint.
  });
}

// Build the object key: events/<eventId>/<uuid>.<ext> (ext from contentType).
export function buildKey(eventId: string, contentType: string): string {
  const ext = EXT_BY_TYPE[contentType] ?? 'mp4';
  return `events/${eventId}/${randomUUID()}.${ext}`;
}

// The stored blobUrl (G-7: canonical key-only / private S3-style reference).
export function blobUrlForKey(cfg: R2Config, key: string): string {
  return `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`;
}

// Presign a PUT for a fresh key → full PresignResponse (FR-A1).
// ContentType is baked into the signature AND echoed in `headers` so the client
// MUST send the identical Content-Type on the PUT (mismatch → R2 403 — R-6).
export async function presignPutUrl(args: {
  eventId: string;
  contentType: string;
}): Promise<PresignResponse> {
  const cfg = getR2Config();
  const key = buildKey(args.eventId, args.contentType);
  const uploadUrl = await getSignedUrl(
    r2Client(cfg),
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: args.contentType,
    }),
    { expiresIn: PRESIGN_EXPIRES_IN_SECONDS },
  );
  return {
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': args.contentType },
    key,
    expiresInSeconds: PRESIGN_EXPIRES_IN_SECONDS,
  };
}

// Presign a GET for an existing object key (G-7 USER OVERRIDE — playback).
// The bucket stays private; this issues a short-lived signed GET URL the trainer
// UI plays back until expiry.
export async function presignGetUrl(key: string): Promise<string> {
  const cfg = getR2Config();
  return getSignedUrl(
    r2Client(cfg),
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: PRESIGN_EXPIRES_IN_SECONDS },
  );
}
