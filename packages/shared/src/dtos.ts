// DTOs for the Phase 1 endpoints (single source of truth — FR-9).
// PURE TypeScript types only — no runtime/server imports (Metro-safe).

import type { TriggerType, Outcome, MediaType, BookingType, LeadStatus, BookingStatus, Role } from './enums';

// Request body for POST /sessions/:id/events
// (intervention optional -> defaulted from the dog's Protocol.defaultIntervention)
export interface CreateBehaviorEventInput {
  triggerType: TriggerType;
  thresholdMeters: number; // int, >= 0
  intensity: number; // int, 1..10
  outcome: Outcome;
  intervention?: string; // omitted -> resolved from dog's Protocol.defaultIntervention
  note?: string;
  tags?: string[];
}

// Response shape returned by the endpoint (the created event).
export interface BehaviorEventDTO {
  id: string;
  sessionId: string;
  occurredAt: string; // ISO timestamp
  triggerType: TriggerType;
  thresholdMeters: number;
  intensity: number;
  outcome: Outcome;
  intervention: string; // never null (the moat)
  note: string | null;
  tags: string[] | null;
}

// GET /health response shape (imported by mobile for typing the fetch result).
export interface HealthDTO {
  status: 'ok' | 'degraded';
  db?: 'up' | 'down';
}

// ── Phase 2 DTOs (Trainer View) — appended below the Phase 1 DTOs ───────────────

// A media row — stores the R2 object REFERENCE only, never the file (FR-A2).
export interface MediaDTO {
  id: string;
  eventId: string;
  blobUrl: string;          // R2 object reference (G-7: key-only/private — see P2.4)
  type: MediaType;          // 'video' | 'image' — Phase 2 ships 'video'
  uploadedAt: string;       // ISO timestamp
}

// A behavior event plus its media — returned by GET /events/:id (FR-A8).
export interface BehaviorEventWithMediaDTO extends BehaviorEventDTO {
  media: MediaDTO[];
}

// A list-endpoint row: the Phase 1 event shape plus a media COUNT (FR-A5, OQ-3).
// Distinct named type so the base BehaviorEventDTO (Phase 1) is NOT mutated.
export interface BehaviorEventListItemDTO extends BehaviorEventDTO {
  mediaCount: number;
}

// A dog in a trainer's list (FR-A3). protocolId null => no default intervention.
export interface DogSummaryDTO {
  id: string;
  name: string;
  breed: string;
  ageMonths: number;
  clientId: string;
  protocolId: string | null;
}

// One session under a dog (FR-A4), with its event count (no events embedded).
export interface SessionSummaryDTO {
  id: string;
  startedAt: string;        // ISO timestamp
  location: string | null;
  eventCount: number;
}

// A dog with its sessions, no events (FR-A4).
export interface DogDetailDTO extends DogSummaryDTO {
  sessions: SessionSummaryDTO[];
}

// One session with its events, for the timeline (FR-A6).
export interface TimelineSessionDTO {
  id: string;
  startedAt: string;        // ISO timestamp
  location: string | null;
  events: BehaviorEventDTO[]; // reverse-chronological within the session
}

// The dog timeline (FR-A6): sessions reverse-chronological by startedAt,
// events reverse-chronological within each session.
export interface DogTimelineDTO {
  dog: DogSummaryDTO;
  sessions: TimelineSessionDTO[];
}

// POST /media/presign request (FR-A1).
export interface PresignRequest {
  eventId: string;
  contentType: string;      // must be in the allowed set (G-6: video/mp4 | video/quicktime)
}

// POST /media/presign response (FR-A1). The client MUST echo `headers` on the PUT.
export interface PresignResponse {
  uploadUrl: string;        // the presigned R2 PUT URL
  method: 'PUT';
  headers: Record<string, string>; // e.g. { 'Content-Type': 'video/mp4' } — echo on PUT
  key: string;              // events/<eventId>/<uuid>.<ext>
  expiresInSeconds: number; // 600 (G-5) — client may re-request on expiry
}

// POST /events/:id/media request (FR-A2). Records the row AFTER the device
// confirms the direct upload succeeded. eventId comes from the path.
export interface CreateMediaInput {
  key: string;              // the exact key returned by presign
  contentType: string;      // must be in the allowed set (G-6); derives type='video'
}

// PATCH /events/:id request (FR-A7). Partial — only note/tags are mutable;
// the four tap fields + intervention are IMMUTABLE (not in this shape — AC-4).
export interface UpdateBehaviorEventInput {
  note?: string | null;
  tags?: string[] | null;
}

// GET /media/:id/url response (G-7 USER OVERRIDE — video playback via presigned-GET).
// The design's default is key-only/no-playback (P2.4.4); the user flipped G-7 to
// enable trainer-UI playback, so the API issues a short-lived presigned GET URL
// (the bucket stays private). The client uses `url` in a <Video> player until expiry.
export interface MediaPlaybackUrlDTO {
  url: string;              // short-lived presigned R2 GET URL
  expiresInSeconds: number; // re-request on expiry
}

// ── Phase 3a DTOs (Public Site — lead/booking capture) — appended below Phase 2 ──

// POST /leads request body (PUBLIC). `source` is set by the page (e.g. 'website-contact').
export interface CreateLeadInput {
  name: string;
  contact: string;        // free-text email or phone
  source: string;
  message?: string;
}

// POST /leads response — mirrors the `lead` row (createdAt as ISO string).
export interface LeadDTO {
  id: string;
  trainerId: string;
  name: string;
  contact: string;
  source: string;
  message: string | null;
  status: LeadStatus;     // always 'new' on create
  clientId: string | null;// always null on create
  createdAt: string;      // ISO
}

// POST /bookings request body (PUBLIC). type ∈ BOOKING_TYPES; requestedAt ISO.
// name/contact captured for follow-up; folded into `notes` on insert (no columns exist); leadId stays null in 3a (D-7).
export interface CreateBookingInput {
  type: BookingType;
  requestedAt: string;    // ISO datetime
  name: string;
  contact: string;
  notes?: string;
}

// POST /bookings response — mirrors the `booking` row (requestedAt/createdAt as ISO).
export interface BookingDTO {
  id: string;
  trainerId: string;
  leadId: string | null;
  clientId: string | null;
  type: BookingType;
  requestedAt: string;    // ISO
  status: BookingStatus;  // always 'requested' on create
  notes: string | null;
  createdAt: string;      // ISO
}

// ── Phase 3b DTOs (Auth) — appended below Phase 3a ──────────────────────────────

// The authenticated user as the app consumes it (projected from BetterAuth's
// session.user). `role` drives the post-login landing + the route guard; the
// domain links (trainerId/clientId) are the input:false fields carried on the
// BetterAuth user row. Phase 3b replaces the EXPO_PUBLIC_TRAINER_ID stop-gap with
// session.trainerId — so a logged-in trainer's screens resolve their own id here.
export interface SessionUserDTO {
  id: string;                 // BetterAuth user id (NOT the domain trainer/client id)
  email: string;
  name: string;
  role: Role;                 // 'trainer' | 'client'
  trainerId: string | null;   // set when role === 'trainer'; null otherwise
  clientId: string | null;    // set when role === 'client'; null otherwise
}

// Alias — the refined spec references both names for the session shape (FR-A11).
export type AuthUserDTO = SessionUserDTO;

// ── Phase 3b-2 DTOs (Role dashboards + lead/booking management) ──────────────────
// (Outcome + BookingStatus are already imported at the top of this file.)

// ---- Trainer management ----

// PATCH /bookings/:id/status body (TRAINER). `requested` is NOT a valid target (DG-4):
// a booking is created 'requested' by the public 3a endpoint; the trainer moves it forward.
export interface UpdateBookingStatusInput {
  status: Exclude<BookingStatus, 'requested'>; // 'confirmed' | 'declined' | 'completed' | 'cancelled'
}

// A domain `client` row (created by lead conversion). NOT the BetterAuth user.
export interface ClientDTO {
  id: string;
  trainerId: string;
  name: string;
  contact: string;        // free-text email/phone (carried over from the lead)
}

// POST /leads/:id/convert response — the new client + the updated lead (DG-5).
export interface ConvertLeadResponse {
  client: ClientDTO;
  lead: LeadDTO;          // status:'converted', clientId set
}

// POST /clients/:id/login body (TRAINER) — the trainer sets the client's initial
// password (DG-1). Provisioning is a SEPARATE action from conversion.
export interface CreateClientLoginInput {
  email: string;
  password: string;       // >= 8 (BetterAuth minPasswordLength)
}

// POST /clients/:id/login response — the provisioned login, linked to the client.
export interface ClientLoginDTO {
  userId: string;         // BetterAuth user id
  clientId: string;       // the linked domain client id
  email: string;
}

// ---- Client dashboard ----

// One homework row joined to its exercise (GET /me/homework).
export interface HomeworkDTO {
  id: string;
  dogId: string;
  exerciseId: string;
  title: string;          // exercise.title
  instructions: string;   // exercise.instructions
  completed: boolean;
  completedAt: string | null; // ISO
}

// PATCH /me/homework/:id body — mark (in)complete (the only client write in 3b-2).
export interface UpdateHomeworkInput {
  completed: boolean;
}

// One point on the threshold-over-time series.
export interface ProgressPointDTO {
  occurredAt: string;     // ISO
  thresholdMeters: number;
  intensity: number;
  outcome: Outcome;
}

// GET /me/progress returns one of these per client dog (DG-6). `points` are
// chronological (oldest → newest) so ProgressCurve plots them left-to-right.
export interface ClientProgressDTO {
  dog: DogSummaryDTO;
  points: ProgressPointDTO[];
}
