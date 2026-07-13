// Local demo seed (Phase 3b — db:seed). Creates the practice graph + the two
// BetterAuth logins (trainer + client) the dashboards/management need, so a
// reviewer can log in as each role immediately. Idempotent: re-running reuses the
// existing trainer (matched by email) and re-patches the auth links.
//
// Run against a live Postgres (docker) AFTER db:migrate:
//   npm run db:migrate   # applies drizzle/ incl. 0001_betterauth_tables
//   npm run db:seed
//
// Accounts printed at the end are DEMO credentials for local review only.

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from './db/client.js';
import {
  behaviorEvent,
  client as clientTable,
  dog as dogTable,
  exercise as exerciseTable,
  homework as homeworkTable,
  protocol as protocolTable,
  session as sessionTable,
  trainer as trainerTable,
} from './db/schema.js';
import { user as userTable } from './db/auth-schema.js';
import { auth } from './lib/auth.js';

// ── Demo credentials (local review only) ───────────────────────────────────────
const TRAINER_EMAIL = 'trainer@tailsup.local';
const TRAINER_PASSWORD = 'Trainer123!';
const CLIENT_EMAIL = 'client@tailsup.local';
const CLIENT_PASSWORD = 'Client123!';

// Create a BetterAuth login (or reuse if the email already exists), then patch the
// role + domain link. Returns the auth user id. signUpEmail hashes the password
// and creates the user + account rows; a duplicate email throws, which we absorb.
async function ensureAuthUser(
  email: string,
  password: string,
  name: string,
  patch: { role: string; trainerId?: string; clientId?: string },
): Promise<string> {
  try {
    await auth.api.signUpEmail({ body: { email, password, name } });
  } catch {
    // Already exists (re-run) — fall through to the lookup + re-patch below.
  }
  const [row] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (!row) throw new Error(`auth user not created/found for ${email}`);
  await db
    .update(userTable)
    .set({
      role: patch.role,
      trainerId: patch.trainerId ?? null,
      clientId: patch.clientId ?? null,
    })
    .where(eq(userTable.id, row.id));
  return row.id;
}

async function main(): Promise<void> {
  // 1. Domain graph — reuse if the practice trainer already exists (idempotent).
  let [trainer] = await db
    .select()
    .from(trainerTable)
    .where(eq(trainerTable.email, TRAINER_EMAIL))
    .limit(1);

  if (!trainer) {
    [trainer] = await db
      .insert(trainerTable)
      .values({ name: 'Demo Trainer', email: TRAINER_EMAIL })
      .returning();

    const [protocol] = await db
      .insert(protocolTable)
      .values({ name: 'Reactivity — threshold work', defaultIntervention: 'u-turn' })
      .returning();

    const [client] = await db
      .insert(clientTable)
      .values({ trainerId: trainer.id, name: 'Demo Client', contact: CLIENT_EMAIL })
      .returning();

    const [dog] = await db
      .insert(dogTable)
      .values({
        clientId: client.id,
        protocolId: protocol.id,
        name: 'Rex',
        breed: 'German Shepherd',
        ageMonths: 36,
        backgroundNotes: 'Leash-reactive to other dogs; improving.',
      })
      .returning();

    const exercises = await db
      .insert(exerciseTable)
      .values([
        { protocolId: protocol.id, title: 'Engage–Disengage', instructions: 'Mark and reward voluntary disengagement from the trigger.' },
        { protocolId: protocol.id, title: 'Pattern games (1-2-3)', instructions: 'Count 1-2-3 and feed on 3 to build a predictable pattern near triggers.' },
      ])
      .returning();

    await db.insert(homeworkTable).values([
      { dogId: dog.id, exerciseId: exercises[0].id, completed: false },
      { dogId: dog.id, exerciseId: exercises[1].id, completed: true, completedAt: new Date('2026-06-20T09:00:00Z') },
    ]);

    const [session] = await db
      .insert(sessionTable)
      .values({ dogId: dog.id, startedAt: new Date('2026-06-15T10:00:00Z'), location: 'Riverside park' })
      .returning();

    // A threshold-over-time series (the client dashboard graph in 3b-2). Rising
    // thresholdMeters = the dog coping at ever-closer distances = progress.
    await db.insert(behaviorEvent).values([
      { sessionId: session.id, occurredAt: new Date('2026-06-15T10:05:00Z'), triggerType: 'dog', thresholdMeters: 20, intensity: 8, outcome: 'over_threshold', intervention: 'u-turn' },
      { sessionId: session.id, occurredAt: new Date('2026-06-15T10:15:00Z'), triggerType: 'dog', thresholdMeters: 15, intensity: 6, outcome: 'recovered_slowly', intervention: 'engage-disengage' },
      { sessionId: session.id, occurredAt: new Date('2026-06-15T10:25:00Z'), triggerType: 'dog', thresholdMeters: 12, intensity: 5, outcome: 'recovered_slowly', intervention: 'pattern game' },
      { sessionId: session.id, occurredAt: new Date('2026-06-15T10:35:00Z'), triggerType: 'dog', thresholdMeters: 8, intensity: 3, outcome: 'disengaged', intervention: 'engage-disengage' },
      { sessionId: session.id, occurredAt: new Date('2026-06-15T10:45:00Z'), triggerType: 'dog', thresholdMeters: 6, intensity: 2, outcome: 'disengaged', intervention: 'pattern game' },
    ]);

    console.log('Seeded domain graph (trainer, client, dog, protocol, exercises, homework, session, events).');
  } else {
    console.log('Practice trainer already present — reusing domain graph.');
  }

  // The client domain row (created above or pre-existing) — link the client login.
  const [client] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.trainerId, trainer.id))
    .limit(1);
  if (!client) throw new Error('expected a client row for the seed trainer');

  // 2. Auth logins — link each to its domain row via the input:false fields.
  await ensureAuthUser(TRAINER_EMAIL, TRAINER_PASSWORD, 'Demo Trainer', {
    role: 'trainer',
    trainerId: trainer.id,
  });
  await ensureAuthUser(CLIENT_EMAIL, CLIENT_PASSWORD, 'Demo Client', {
    role: 'client',
    clientId: client.id,
  });

  console.log('\n✅ Seed complete. Demo logins (local only):');
  console.log(`   trainer → ${TRAINER_EMAIL} / ${TRAINER_PASSWORD}  (trainerId ${trainer.id})`);
  console.log(`   client  → ${CLIENT_EMAIL} / ${CLIENT_PASSWORD}  (clientId ${client.id})`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
