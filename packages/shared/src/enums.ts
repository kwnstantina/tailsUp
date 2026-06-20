// Shared enum literal arrays (single source of truth — FR-9).
// Consumed by apps/api for Drizzle `pgEnum(...)` + Zod `z.enum(...)`,
// and by apps/mobile for typing. PURE TypeScript only — no runtime/server imports.

export const TRIGGER_TYPES = ['dog', 'human', 'noise', 'vehicle', 'other'] as const;
export const OUTCOMES = ['disengaged', 'recovered_slowly', 'over_threshold'] as const;
export const MEDIA_TYPES = ['video', 'image'] as const;
export const LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'] as const;
export const BOOKING_TYPES = ['assessment', 'private', 'group'] as const;
export const BOOKING_STATUSES = ['requested', 'confirmed', 'declined', 'completed', 'cancelled'] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type BookingType = (typeof BOOKING_TYPES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
