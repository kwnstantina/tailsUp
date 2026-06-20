// TailsUp — full 12-entity Drizzle schema (Phase 1, AC-4/AC-5).
//
// Conventions (design §2):
//  - SINGULAR table names (explicit literal first arg of pgTable — never pluralized).
//  - Column keys are camelCase in TS; mapped to snake_case columns by the Drizzle
//    `casing: 'snake_case'` option (set on both the client and drizzle.config.ts).
//  - Every PK is uuid().defaultRandom().primaryKey(); every FK column is uuid().
//  - Timestamps are timestamp({ withTimezone: true }).
//  - The 6 pgEnums are built from the @tailsup/shared arrays — the SINGLE source
//    of truth shared with Zod validation and the mobile app (FR-9).
//  - Circular edge session.bookingId -> booking is declared with the standalone
//    foreignKey() builder so Drizzle types do not collapse to `any` (Risk R2).
//
// Declaration order (design §2.3) lets almost every FK be a simple inline
// .references(); only the session->booking back-edge needs the standalone builder:
//   trainer -> protocol -> client -> dog -> exercise -> lead -> booking
//           -> session -> behavior_event -> media -> homework

import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  LEAD_STATUSES,
  MEDIA_TYPES,
  OUTCOMES,
  TRIGGER_TYPES,
} from '@tailsup/shared';

// ---------------------------------------------------------------------------
// pgEnums — values sourced from @tailsup/shared (FR-9).
// The shared arrays are readonly tuples (`as const`); pgEnum wants a mutable
// [string, ...string[]] tuple, so cast through unknown.
// ---------------------------------------------------------------------------
export const triggerTypeEnum = pgEnum(
  'trigger_type',
  TRIGGER_TYPES as unknown as [string, ...string[]],
);
export const outcomeEnum = pgEnum(
  'outcome',
  OUTCOMES as unknown as [string, ...string[]],
);
export const mediaTypeEnum = pgEnum(
  'media_type',
  MEDIA_TYPES as unknown as [string, ...string[]],
);
export const leadStatusEnum = pgEnum(
  'lead_status',
  LEAD_STATUSES as unknown as [string, ...string[]],
);
export const bookingTypeEnum = pgEnum(
  'booking_type',
  BOOKING_TYPES as unknown as [string, ...string[]],
);
export const bookingStatusEnum = pgEnum(
  'booking_status',
  BOOKING_STATUSES as unknown as [string, ...string[]],
);

// ---------------------------------------------------------------------------
// trainer
// ---------------------------------------------------------------------------
export const trainer = pgTable('trainer', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
});

// ---------------------------------------------------------------------------
// protocol
// ---------------------------------------------------------------------------
export const protocol = pgTable('protocol', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  defaultIntervention: text().notNull(),
});

// ---------------------------------------------------------------------------
// client  (index on trainerId — AC-5)
// ---------------------------------------------------------------------------
export const client = pgTable(
  'client',
  {
    id: uuid().defaultRandom().primaryKey(),
    trainerId: uuid()
      .notNull()
      .references(() => trainer.id),
    name: text().notNull(),
    contact: text().notNull(), // free-text email/phone
  },
  (t) => [index('client_trainer_idx').on(t.trainerId)],
);

// ---------------------------------------------------------------------------
// dog  (index on clientId — AC-5; protocolId nullable)
// ---------------------------------------------------------------------------
export const dog = pgTable(
  'dog',
  {
    id: uuid().defaultRandom().primaryKey(),
    clientId: uuid()
      .notNull()
      .references(() => client.id),
    protocolId: uuid().references(() => protocol.id), // nullable
    name: text().notNull(),
    breed: text().notNull(),
    ageMonths: integer().notNull(),
    backgroundNotes: text(), // nullable
  },
  (t) => [index('dog_client_idx').on(t.clientId)],
);

// ---------------------------------------------------------------------------
// exercise
// ---------------------------------------------------------------------------
export const exercise = pgTable('exercise', {
  id: uuid().defaultRandom().primaryKey(),
  protocolId: uuid()
    .notNull()
    .references(() => protocol.id),
  title: text().notNull(),
  instructions: text().notNull(),
});

// ---------------------------------------------------------------------------
// lead  (clientId nullable — set on conversion in P3)
// ---------------------------------------------------------------------------
export const lead = pgTable('lead', {
  id: uuid().defaultRandom().primaryKey(),
  trainerId: uuid()
    .notNull()
    .references(() => trainer.id),
  name: text().notNull(),
  contact: text().notNull(), // free-text
  source: text().notNull(),
  message: text(), // nullable
  status: leadStatusEnum().notNull().default('new'),
  clientId: uuid().references(() => client.id), // nullable
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// booking  (leadId + clientId nullable). Declared before `session` so the
// session->booking back-edge has its target already in scope.
// ---------------------------------------------------------------------------
export const booking = pgTable('booking', {
  id: uuid().defaultRandom().primaryKey(),
  trainerId: uuid()
    .notNull()
    .references(() => trainer.id),
  leadId: uuid().references(() => lead.id), // nullable
  clientId: uuid().references(() => client.id), // nullable
  type: bookingTypeEnum().notNull(),
  requestedAt: timestamp({ withTimezone: true }).notNull(),
  status: bookingStatusEnum().notNull().default('requested'),
  notes: text(), // nullable
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// session  (composite index on dogId, startedAt — AC-5; bookingId nullable)
//
// CIRCULAR EDGE (Risk R2): session.bookingId -> booking is declared with the
// standalone foreignKey() builder rather than inline .references(), so Drizzle's
// type inference cannot collapse session/booking to `any`. The dogId FK is a
// plain inline reference (dog declared earlier).
// ---------------------------------------------------------------------------
export const session = pgTable(
  'session',
  {
    id: uuid().defaultRandom().primaryKey(),
    dogId: uuid()
      .notNull()
      .references(() => dog.id),
    bookingId: uuid(), // nullable — FK declared via foreignKey() below
    startedAt: timestamp({ withTimezone: true }).notNull(),
    location: text(), // nullable
  },
  (t) => [
    foreignKey({
      columns: [t.bookingId],
      foreignColumns: [booking.id],
      name: 'session_booking_fk',
    }),
    index('session_dog_started_idx').on(t.dogId, t.startedAt),
  ],
);

// ---------------------------------------------------------------------------
// behavior_event  (the moat)
//   - intervention is text().notNull() — NEVER null (D-6).
//   - tags is jsonb $type<string[]>(), nullable, GIN-indexed.
//   - composite index on (sessionId, occurredAt) + GIN on tags (AC-5).
// ---------------------------------------------------------------------------
export const behaviorEvent = pgTable(
  'behavior_event',
  {
    id: uuid().defaultRandom().primaryKey(),
    sessionId: uuid()
      .notNull()
      .references(() => session.id),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    triggerType: triggerTypeEnum().notNull(),
    thresholdMeters: integer().notNull(), // validated >= 0 at the validation layer
    intensity: integer().notNull(), // validated 1..10 at the validation layer
    outcome: outcomeEnum().notNull(),
    intervention: text().notNull(), // moat — never null; defaulted from Protocol
    note: text(), // nullable
    tags: jsonb().$type<string[]>(), // nullable
  },
  (t) => [
    index('behavior_event_session_occurred_idx').on(t.sessionId, t.occurredAt),
    index('behavior_event_tags_gin').using('gin', t.tags),
  ],
);

// ---------------------------------------------------------------------------
// media  (stores only the R2 URL — never the file)
// ---------------------------------------------------------------------------
export const media = pgTable('media', {
  id: uuid().defaultRandom().primaryKey(),
  eventId: uuid()
    .notNull()
    .references(() => behaviorEvent.id),
  blobUrl: text().notNull(), // R2 URL only
  type: mediaTypeEnum().notNull(),
  uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// homework  (completedAt nullable; completed defaults false)
// ---------------------------------------------------------------------------
export const homework = pgTable('homework', {
  id: uuid().defaultRandom().primaryKey(),
  dogId: uuid()
    .notNull()
    .references(() => dog.id),
  exerciseId: uuid()
    .notNull()
    .references(() => exercise.id),
  completed: boolean().notNull().default(false),
  completedAt: timestamp({ withTimezone: true }), // nullable
});
