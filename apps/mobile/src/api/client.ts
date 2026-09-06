// Thin client for the two PUBLIC endpoints the site depends on.
//
// Both are unauthenticated by design (a visitor has no account) and both refuse
// a client-supplied `trainerId` / `status` — see apps/api/src/routes/leads.ts.
// So the request bodies here are exactly CreateLeadInput / CreateBookingInput
// from @tailsup/shared, and nothing more.

import type {
  BookingDTO,
  CreateBookingInput,
  CreateLeadInput,
  LeadDTO,
} from '@tailsup/shared';

// STATIC dot-access only — Expo inlines EXPO_PUBLIC_* at build time and ONLY
// when read this way (no destructuring, no dynamic keys).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * A failure we can show a visitor. `kind` drives the message: a validation
 * problem is the visitor's to fix, everything else is ours.
 */
export class ApiError extends Error {
  readonly kind: 'validation' | 'server' | 'network';

  constructor(kind: ApiError['kind'], message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

async function post<TResponse>(path: string, body: unknown): Promise<TResponse> {
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Server down, wrong host, DNS, or a CORS preflight that never landed.
    throw new ApiError(
      'network',
      "We couldn't reach us just then. Check your connection and try again — or email us directly.",
    );
  }

  if (res.ok) {
    return (await res.json()) as TResponse;
  }

  // zValidator answers 400 on a body that fails the schema. That is almost
  // always a field the visitor can fix, so say so rather than blaming the server.
  if (res.status === 400) {
    throw new ApiError(
      'validation',
      'Something in the form looked off to us. Have a quick check and try again.',
    );
  }

  // Log the detail for us; never surface internals to the visitor.
  console.error(`POST ${path} failed with HTTP ${res.status}`);
  throw new ApiError(
    'server',
    "Something broke on our side — sorry. Try again in a moment, or email us and we'll pick it up.",
  );
}

/** POST /leads — the Contact page form. */
export function createLead(input: CreateLeadInput): Promise<LeadDTO> {
  return post<LeadDTO>('/leads', input);
}

/** POST /bookings — the Booking page form. Also creates the linked lead. */
export function createBooking(input: CreateBookingInput): Promise<BookingDTO> {
  return post<BookingDTO>('/bookings', input);
}
