// =============================================================================
// TailsUp typed fetch client (Phase 2, Unit C — FR-M7 / AC-11)
//
// A tiny typed wrapper over `fetch` against EXPO_PUBLIC_API_URL. Every function
// returns a @tailsup/shared DTO (no `any` on responses) and throws an ApiError
// with a readable message on a non-2xx response, so each screen's discriminated
// `Status` union can surface failures uniformly (mirrors the Phase 1 pattern in
// app/index.tsx).
//
// EXPO_PUBLIC_* is read via STATIC dot-access ONLY — Expo/Metro inlines these
// vars at build time and ONLY when accessed this way (no destructuring / dynamic
// keys). Mirror app/index.tsx:54.
// =============================================================================

import { Platform } from 'react-native';
import type {
  BehaviorEventDTO,
  BehaviorEventListItemDTO,
  BehaviorEventWithMediaDTO,
  BookingDTO,
  CreateBehaviorEventInput,
  CreateBookingInput,
  CreateLeadInput,
  CreateMediaInput,
  DogDetailDTO,
  DogSummaryDTO,
  DogTimelineDTO,
  LeadDTO,
  MediaDTO,
  MediaPlaybackUrlDTO,
  PresignRequest,
  PresignResponse,
  SessionSummaryDTO,
  UpdateBehaviorEventInput,
} from '@tailsup/shared';
import { authClient } from './auth-client';

// Base URL — static dot-access so Expo can inline it. Dev default localhost:3000
// (correct for Expo web & iOS simulator; see apps/mobile/.env.example).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Phase 3b RETIRES the EXPO_PUBLIC_TRAINER_ID stop-gap: the trainer id now comes
// from the authenticated session (authClient.useSession().data.user.trainerId),
// not a build-time env var. Auth transport per LBD-3:
//   - Web: the browser holds the httpOnly session cookie; credentials:'include'
//     sends it (CORS is credentialed + origin-allow-listed on the API).
//   - Native: no cookie jar — attach the SecureStore-persisted cookie explicitly.
function authHeader(): Record<string, string> {
  if (Platform.OS === 'web') return {};
  const cookie = authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
}

/**
 * A thrown API failure carrying the HTTP status (when there was a response) so
 * screens can branch on it (e.g. 404 unknown session, 400 no-protocol-default).
 * `status` is undefined for a network-level failure (server down, CORS, etc.).
 */
export class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// The API's domain-error body convention is `{ error: '...' }` (Phase 1).
interface ErrorBody {
  error?: unknown;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ErrorBody;
    if (body && typeof body.error === 'string' && body.error.trim() !== '') {
      return body.error;
    }
  } catch {
    // Non-JSON / empty body — fall through to a generic message.
  }
  return `API responded with HTTP ${res.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      // Web: send the session cookie cross-origin (CORS is credentialed).
      credentials: 'include',
      // Native: attach the SecureStore cookie; web merges an empty object.
      headers: { ...(init?.headers ?? {}), ...authHeader() },
    });
  } catch {
    // Network-level failure (server down, wrong host, CORS, etc.) — no status.
    throw new ApiError('API unreachable', undefined);
  }
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as T;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// ── Reads ────────────────────────────────────────────────────────────────────

export function getDogs(trainerId: string): Promise<DogSummaryDTO[]> {
  return request<DogSummaryDTO[]>(`/trainers/${encodeURIComponent(trainerId)}/dogs`);
}

export function getDog(id: string): Promise<DogDetailDTO> {
  return request<DogDetailDTO>(`/dogs/${encodeURIComponent(id)}`);
}

export function getDogTimeline(id: string): Promise<DogTimelineDTO> {
  return request<DogTimelineDTO>(`/dogs/${encodeURIComponent(id)}/timeline`);
}

export function getSessionEvents(id: string): Promise<BehaviorEventListItemDTO[]> {
  return request<BehaviorEventListItemDTO[]>(`/sessions/${encodeURIComponent(id)}/events`);
}

export function getEvent(id: string): Promise<BehaviorEventWithMediaDTO> {
  return request<BehaviorEventWithMediaDTO>(`/events/${encodeURIComponent(id)}`);
}

// G-7 USER OVERRIDE — fetch a short-lived presigned GET URL for playback.
export function getMediaPlaybackUrl(mediaId: string): Promise<MediaPlaybackUrlDTO> {
  return request<MediaPlaybackUrlDTO>(`/media/${encodeURIComponent(mediaId)}/url`);
}

// ── Writes ───────────────────────────────────────────────────────────────────

export function startSession(
  dogId: string,
  body: { startedAt?: string; location?: string } = {},
): Promise<SessionSummaryDTO> {
  return request<SessionSummaryDTO>(`/dogs/${encodeURIComponent(dogId)}/sessions`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

// Reuses the Phase 1 endpoint. Omit `intervention` -> server defaults it.
export function postEvent(
  sessionId: string,
  body: CreateBehaviorEventInput,
): Promise<BehaviorEventDTO> {
  return request<BehaviorEventDTO>(`/sessions/${encodeURIComponent(sessionId)}/events`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export function patchEvent(
  id: string,
  body: UpdateBehaviorEventInput,
): Promise<BehaviorEventDTO> {
  return request<BehaviorEventDTO>(`/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export function presign(body: PresignRequest): Promise<PresignResponse> {
  return request<PresignResponse>(`/media/presign`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export function createMedia(eventId: string, body: CreateMediaInput): Promise<MediaDTO> {
  return request<MediaDTO>(`/events/${encodeURIComponent(eventId)}/media`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

// ── Phase 3a public capture (PUBLIC, no auth) ─────────────────────────────────

// POST /leads — the Contact page lead form. The page sets `source`
// (e.g. 'website-contact'). Server resolves the practice trainer and replies 201.
export function createLead(body: CreateLeadInput): Promise<LeadDTO> {
  return request<LeadDTO>('/leads', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

// POST /bookings — the Booking page form. `requestedAt` is an ISO datetime;
// name/contact are captured into the booking notes server-side (no columns).
export function createBooking(body: CreateBookingInput): Promise<BookingDTO> {
  return request<BookingDTO>('/bookings', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}
