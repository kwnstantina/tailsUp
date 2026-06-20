// DTOs for the Phase 1 endpoints (single source of truth — FR-9).
// PURE TypeScript types only — no runtime/server imports (Metro-safe).

import type { TriggerType, Outcome } from './enums';

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
