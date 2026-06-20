// =============================================================================
// TailsUp media upload flow (Phase 2, Unit C — FR-M4 / AC-6/AC-7 / R-2 / R-6)
//
// The direct-to-R2 upload: the device PUTs the video bytes straight to the
// presigned R2 URL (bytes NEVER transit the API — NFR-2), then records the row
// via POST /events/:id/media. Sequence (P2.5):
//
//   1. presign({ eventId, contentType })            -> { uploadUrl, headers, key }
//   2. PUT uploadUrl  (Content-Type === presign's)  -> R2 stores the object
//        native: createUploadTask(uploadUrl, fileUri, BINARY_CONTENT, PUT) + progress
//        web:    fetch(uploadUrl, { method:'PUT', body:<Blob/File>, headers })
//   3. createMedia(eventId, { key, contentType })   -> 201 MediaDTO
//
// CRITICAL INVARIANTS:
//  - R-6: the Content-Type on the PUT MUST equal the presigned headers'
//    Content-Type, or R2 returns 403 SignatureDoesNotMatch. We send EXACTLY the
//    presign's contentType on the PUT (the API set it to the signed contentType).
//  - R-2: native streams `file://` bytes via the BINARY_CONTENT upload task,
//    which avoids the classic 0-byte `fetch`-of-a-file-uri bug and gives progress.
//
// IMPLEMENTATION NOTE (verified against the installed expo-file-system@19.x /
// SDK 54): the binary PUT upload API (`createUploadTask` + BINARY_CONTENT +
// progress) is exposed by the `expo-file-system/legacy` entry point. In this SDK
// the NEW File API (`new File(uri)`) has no upload-task method, so the legacy
// entry — the investigation's documented escape hatch (R-2) — is the supported
// path. Importing from `expo-file-system/legacy` (not the main import) does NOT
// trigger the runtime deprecation throw. Native only; web uses `fetch`.
// =============================================================================

import { Platform } from 'react-native';
import {
  createUploadTask,
  FileSystemUploadType,
  type UploadProgressData,
} from 'expo-file-system/legacy';
import type { CreateMediaInput, MediaDTO } from '@tailsup/shared';
import { ApiError, createMedia, presign } from './api';

// The G-6 allow-set, shared by the picker validation and the upload guard.
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'] as const;
export type AllowedVideoType = (typeof ALLOWED_VIDEO_TYPES)[number];

// Client soft-warn threshold (G-6 — no hard server cap in Phase 2).
export const SOFT_SIZE_WARN_BYTES = 200 * 1024 * 1024; // 200 MB

export function isAllowedVideoType(
  mimeType: string | null | undefined,
): mimeType is AllowedVideoType {
  return mimeType != null && (ALLOWED_VIDEO_TYPES as readonly string[]).includes(mimeType);
}

// The picked asset, narrowed to what the upload needs. On web, expo-image-picker
// also exposes a real File/Blob via `asset.file`; on native only the `file://`
// `uri` is available.
export interface PickedVideo {
  uri: string;
  contentType: AllowedVideoType;
  // Web-only: the picker's underlying File/Blob (preferred body for the PUT).
  file?: Blob | null;
}

export interface UploadResult {
  media: MediaDTO;
  key: string;
}

type ProgressCb = (fraction: number) => void;

/**
 * Run the full presign -> direct PUT -> persist sequence for one picked video.
 * Throws ApiError (with a readable message) on any step's failure so the caller
 * can surface presign (404/503), PUT (403/CORS), and persist failures distinctly.
 */
export async function uploadVideo(
  eventId: string,
  asset: PickedVideo,
  onProgress?: ProgressCb,
): Promise<UploadResult> {
  // 1. Presign — one value threaded end-to-end (R-6): picker mimeType.
  const signed = await presign({ eventId, contentType: asset.contentType });

  // The exact Content-Type the API signed — echo it on the PUT (R-6). Start from
  // the presign's headers so anything else the API signed is also echoed.
  const putHeaders: Record<string, string> = {
    'Content-Type': asset.contentType,
    ...signed.headers,
  };

  // 2. Direct PUT to R2 — branch on platform (R-2).
  if (Platform.OS === 'web') {
    await putWeb(signed.uploadUrl, putHeaders, asset, onProgress);
  } else {
    await putNative(signed.uploadUrl, putHeaders, asset.uri, onProgress);
  }

  // 3. Record the row AFTER the device confirms the upload (G-3).
  const body: CreateMediaInput = { key: signed.key, contentType: asset.contentType };
  const media = await createMedia(eventId, body);
  return { media, key: signed.key };
}

// ── native: binary-content PUT upload task with progress (R-2) ─────────────────
async function putNative(
  uploadUrl: string,
  headers: Record<string, string>,
  localUri: string,
  onProgress?: ProgressCb,
): Promise<void> {
  const task = createUploadTask(
    uploadUrl,
    localUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers,
    },
    onProgress
      ? (data: UploadProgressData) => {
          const total = data.totalBytesExpectedToSend;
          onProgress(total > 0 ? data.totalBytesSent / total : 0);
        }
      : undefined,
  );

  let result;
  try {
    result = await task.uploadAsync();
  } catch {
    throw new ApiError('Upload to storage failed (network error).', undefined);
  }
  const status = result?.status ?? 0;
  if (status < 200 || status >= 300) {
    throw new ApiError(`Upload to storage failed (HTTP ${status}).`, status);
  }
  onProgress?.(1);
}

// ── web: plain fetch PUT of the picked Blob/File ───────────────────────────────
async function putWeb(
  uploadUrl: string,
  headers: Record<string, string>,
  asset: PickedVideo,
  onProgress?: ProgressCb,
): Promise<void> {
  // Prefer the picker's File/Blob; fall back to fetching the (blob:) uri.
  const body: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());

  let res: Response;
  try {
    res = await fetch(uploadUrl, { method: 'PUT', headers, body });
  } catch {
    // Cross-origin PUT blocked (R2 bucket CORS not set for the web origin — G-8/R-3).
    throw new ApiError(
      'Upload to storage failed (network/CORS). On web, the R2 bucket needs a CORS rule allowing PUT from this origin.',
      undefined,
    );
  }
  if (!res.ok) {
    throw new ApiError(`Upload to storage failed (HTTP ${res.status}).`, res.status);
  }
  onProgress?.(1);
}
