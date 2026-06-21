// Tests for src/lib/email.ts sendLeadNotification (Phase 3a / investigation 6c).
//
// Covers:
//
//   STUB path (RESEND_API_KEY unset):
//     - Returns (resolves to void) without throwing.
//     - Logs exactly one '[email:stub]' line via console.log.
//     - Does NOT call resend.emails.send (no network attempt).
//     - With a null recipient also stubs and never rejects.
//
//   KEYED path (RESEND_API_KEY set, resend module mocked):
//     - Calls emails.send with the correct { to, subject, from, html } shape.
//     - Returns void and does not throw when Resend resolves { data, error: null }.
//     - Returns void and does not throw when Resend resolves { data: null, error: {...} }
//       (non-fatal API error — the function logs and swallows).
//
// Strategy:
//   - `vi.mock('resend', ...)` replaces the Resend class globally in this file;
//     the mock factory (created via vi.hoisted) controls `emails.send`.
//   - STUB-path tests: delete RESEND_API_KEY before calling; Resend constructor is
//     never invoked so the mock is irrelevant but must be in place to satisfy the
//     static import in email.ts.
//   - KEYED-path tests: set RESEND_API_KEY; use vi.resetModules() + dynamic import
//     so the module-level `let client` starts as null on each keyed test (otherwise
//     the client cached from a previous test leaks across assertions).
//   - console.log and console.error are spied on per-test and restored in afterEach.

import { vi, describe, it, expect, afterEach } from 'vitest';

// ── Hoist Resend mock ─────────────────────────────────────────────────────────
const resendMocks = vi.hoisted(() => {
  const mockEmailsSend = vi.fn();
  // `new Resend(key)` returns an object with `emails.send`.
  const MockResend = vi.fn(() => ({
    emails: { send: mockEmailsSend },
  }));
  return { MockResend, mockEmailsSend };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

// Replace the resend module so no real network is ever touched.
vi.mock('resend', () => ({
  Resend: resendMocks.MockResend,
}));

// Satisfy config.ts required() (transitively imported via db/client chain).
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// ── Fixture LeadDTO ───────────────────────────────────────────────────────────
import type { LeadDTO } from '@tailsup/shared';

const LEAD_DTO: LeadDTO = {
  id: 'bb000000-0000-0000-0000-000000000001',
  trainerId: 'aa000000-0000-0000-0000-000000000001',
  name: 'Maria P.',
  contact: 'maria@example.com',
  source: 'website-contact',
  message: 'My dog reacts to bikes.',
  status: 'new',
  clientId: null,
  createdAt: '2026-06-21T09:00:00.000Z',
};

// ── Restore env and modules after each test ───────────────────────────────────
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  vi.clearAllMocks();
  vi.resetModules();
});

// ── STUB path (no key) ────────────────────────────────────────────────────────
describe('sendLeadNotification — STUB path (RESEND_API_KEY unset)', () => {
  it('resolves without throwing when key is absent', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendLeadNotification } = await import('../lib/email.js');

    await expect(sendLeadNotification('trainer@example.com', LEAD_DTO)).resolves.toBeUndefined();
  });

  it('logs one [email:stub] line via console.log', async () => {
    delete process.env.RESEND_API_KEY;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendLeadNotification } = await import('../lib/email.js');

    await sendLeadNotification('trainer@example.com', LEAD_DTO);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const firstArg = logSpy.mock.calls[0][0] as string;
    expect(firstArg).toContain('[email:stub]');
    logSpy.mockRestore();
  });

  it('does NOT call resend emails.send on the stub path', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendLeadNotification } = await import('../lib/email.js');

    await sendLeadNotification('trainer@example.com', LEAD_DTO);

    expect(resendMocks.mockEmailsSend).not.toHaveBeenCalled();
    expect(resendMocks.MockResend).not.toHaveBeenCalled();
  });

  it('resolves without throwing when recipient is null', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendLeadNotification } = await import('../lib/email.js');

    await expect(sendLeadNotification(null, LEAD_DTO)).resolves.toBeUndefined();
  });

  it('logs [email:stub] with a null recipient', async () => {
    delete process.env.RESEND_API_KEY;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendLeadNotification } = await import('../lib/email.js');

    await sendLeadNotification(null, LEAD_DTO);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const firstArg = logSpy.mock.calls[0][0] as string;
    expect(firstArg).toContain('[email:stub]');
    logSpy.mockRestore();
  });

  it('stubs (does not throw) when key is blank/whitespace', async () => {
    process.env.RESEND_API_KEY = '   ';
    const { sendLeadNotification } = await import('../lib/email.js');

    await expect(sendLeadNotification('trainer@example.com', LEAD_DTO)).resolves.toBeUndefined();
    expect(resendMocks.mockEmailsSend).not.toHaveBeenCalled();
  });
});

// ── KEYED path (key set, Resend mocked) ──────────────────────────────────────
describe('sendLeadNotification — KEYED path (RESEND_API_KEY set, resend mocked)', () => {
  it('calls emails.send with the correct to, subject, from, and html when key is set', async () => {
    process.env.RESEND_API_KEY = 'test-api-key-123';
    resendMocks.mockEmailsSend.mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null });

    const { sendLeadNotification } = await import('../lib/email.js');
    await sendLeadNotification('trainer@example.com', LEAD_DTO);

    expect(resendMocks.mockEmailsSend).toHaveBeenCalledTimes(1);
    const callArg = resendMocks.mockEmailsSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.to).toBe('trainer@example.com');
    expect(callArg.subject).toBe(`New lead: ${LEAD_DTO.name}`);
    // from defaults to TailsUp onboarding address when RESEND_FROM is unset
    expect(typeof callArg.from).toBe('string');
    expect(typeof callArg.html).toBe('string');
  });

  it('resolves to void and does not throw when send succeeds', async () => {
    process.env.RESEND_API_KEY = 'test-api-key-123';
    resendMocks.mockEmailsSend.mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null });

    const { sendLeadNotification } = await import('../lib/email.js');

    await expect(sendLeadNotification('trainer@example.com', LEAD_DTO)).resolves.toBeUndefined();
  });

  it('resolves to void and does not throw when Resend returns an API error (non-fatal)', async () => {
    process.env.RESEND_API_KEY = 'test-api-key-123';
    resendMocks.mockEmailsSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', message: 'invalid address', statusCode: 422 },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendLeadNotification } = await import('../lib/email.js');

    await expect(sendLeadNotification('trainer@example.com', LEAD_DTO)).resolves.toBeUndefined();
    // Non-fatal: the error is logged but does not propagate.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('HTML-escapes user-supplied lead fields in the email body', async () => {
    process.env.RESEND_API_KEY = 'test-api-key-123';
    resendMocks.mockEmailsSend.mockResolvedValueOnce({ data: { id: 'msg-2' }, error: null });

    const xssLead: LeadDTO = {
      ...LEAD_DTO,
      name: '<script>alert(1)</script>',
      contact: '"attacker@evil.com"',
      source: "O'Malley & Sons",
      message: '<b>bold</b>',
    };

    const { sendLeadNotification } = await import('../lib/email.js');
    await sendLeadNotification('trainer@example.com', xssLead);

    const html = resendMocks.mockEmailsSend.mock.calls[0][0].html as string;
    // Raw angle brackets / script tags must not appear in the html output.
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
    expect(html).toContain('&amp;');
  });

  it('uses RESEND_FROM env var as the from address when set', async () => {
    process.env.RESEND_API_KEY = 'test-api-key-123';
    process.env.RESEND_FROM = 'Custom Sender <custom@example.com>';
    resendMocks.mockEmailsSend.mockResolvedValueOnce({ data: { id: 'msg-3' }, error: null });

    const { sendLeadNotification } = await import('../lib/email.js');
    await sendLeadNotification('trainer@example.com', LEAD_DTO);

    const callArg = resendMocks.mockEmailsSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.from).toBe('Custom Sender <custom@example.com>');
  });
});
