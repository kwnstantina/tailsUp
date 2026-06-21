// Resend lead-notification helper (design P3a / investigation 6c) — Unit B.
//
// Mirrors lib/r2.ts' LAZY-config shape (RESEND_API_KEY read at call time, never
// at module top-level / config.ts) but INVERTS the missing-key behaviour:
//   - r2.ts THROWS on missing creds (→ mapped to 503).
//   - email.ts logs a structured STUB and returns success on missing
//     RESEND_API_KEY (kickoff: "stub if no key"; NFR-9: the DB insert is the
//     source of truth — a missing/failed email must NEVER fail or block the 201).
//
// This helper is designed to be called FIRE-AND-FORGET from the route:
//   void sendLeadNotification(email, dto).catch((e) => console.error(...))
// It therefore never throws on a Resend API error (Resend's send() resolves with
// { data, error }); only a transport-level rejection could surface, which the
// caller's .catch() absorbs.
//
// RESEND_API_KEY / RESEND_FROM stay OUT of config.ts (intentionally optional —
// scan §3); both are read lazily here.

import { Resend } from 'resend';
import type { LeadDTO } from '@tailsup/shared';

// Cached client — built on first use once a key is present.
let client: Resend | null = null;

// Lazy accessor: read RESEND_API_KEY at CALL time. Returns null (STUB path) when
// the key is absent/blank — NEVER throws (the inversion of requiredR2()).
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim() === '') return null; // STUB path — no throw
  client ??= new Resend(key);
  return client;
}

// Notify the practice (the resolved trainer's email) of a new lead.
// Safe to call fire-and-forget: resolves to void on every path, including the
// stub path, a null recipient, and a Resend API error.
export async function sendLeadNotification(
  to: string | null,
  lead: LeadDTO,
): Promise<void> {
  const c = getClient();

  // STUB path: no key configured, or no recipient resolvable. Log + no-op.
  if (!c || !to) {
    console.log('[email:stub] new lead', {
      to,
      id: lead.id,
      name: lead.name,
      contact: lead.contact,
      source: lead.source,
    });
    return;
  }

  // Resend resolves with { data, error }; it does NOT throw on API errors.
  const { error } = await c.emails.send({
    from: process.env.RESEND_FROM ?? 'TailsUp <onboarding@resend.dev>',
    to,
    subject: `New lead: ${lead.name}`,
    html: `<p>New lead from ${lead.source}</p><p>${lead.name} — ${lead.contact}</p><p>${lead.message ?? ''}</p>`,
  });

  if (error) {
    // Non-fatal: log and swallow so the (un-awaited) caller is never affected.
    console.error('[email] resend error (non-fatal)', error);
  }
}
