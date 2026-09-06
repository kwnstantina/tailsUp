// DTOs for the Phase 1 endpoints (single source of truth — FR-9).
// PURE TypeScript types only — no runtime/server imports (Metro-safe).

import type {
  TriggerType,
  Outcome,
  LeadStatus,
  BookingType,
  BookingStatus,
} from './enums';

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

// ---------------------------------------------------------------------------
// Phase 3 — public site capture (POST /leads, POST /bookings)
// ---------------------------------------------------------------------------

// Request body for POST /leads (Contact page lead form).
// trainerId is NOT accepted from the client — the API resolves the practice's
// trainer from config (single-trainer practice; multi-tenant is Phase 4).
export interface CreateLeadInput {
  name: string;
  contact: string; // free-text email/phone
  source: string; // e.g. 'contact-form', 'referral'
  message?: string;
}

export interface LeadDTO {
  id: string;
  trainerId: string;
  name: string;
  contact: string;
  source: string;
  message: string | null;
  status: LeadStatus;
  clientId: string | null;
  createdAt: string; // ISO timestamp
}

// Request body for POST /bookings (Booking page request form).
// A public booking request carries the requester's contact details, which the
// booking table itself does not hold — so the API creates a `lead` (source
// 'booking') and links the booking to it, in one transaction.
export interface CreateBookingInput {
  name: string;
  contact: string;
  type: BookingType;
  requestedAt: string; // ISO timestamp
  notes?: string;
}

export interface BookingDTO {
  id: string;
  trainerId: string;
  leadId: string | null;
  clientId: string | null;
  type: BookingType;
  requestedAt: string; // ISO timestamp
  status: BookingStatus;
  notes: string | null;
  createdAt: string; // ISO timestamp
}
