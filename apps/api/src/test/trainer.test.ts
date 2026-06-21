// Tests for src/lib/trainer.ts resolveTrainerId() (Phase 3a / investigation 6b).
//
// Covers:
//   - PRACTICE_TRAINER_ID env var (when set + non-blank) → returned immediately;
//     NO DB call is made.
//   - Env unset + a trainer row exists → DB is queried and the row's id returned.
//   - Env unset + NO trainer row → throws PracticeNotConfiguredError.
//   - Env set to blank/whitespace → treated as unset; falls back to DB lookup.
//   - PRACTICE_TRAINER_ID with leading/trailing whitespace is trimmed.
//
// Strategy: vi.hoisted() + vi.mock('../db/client.js') (same pattern as
// leads.test.ts / bookings.test.ts). resolveTrainerId() is imported and called
// directly — no HTTP layer involved. process.env.PRACTICE_TRAINER_ID is
// set/restored per test via beforeEach (delete the key).

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Hoist mock helpers ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const selectResultQueue: Array<unknown[]> = [];

  const mockLimit = vi.fn(() => Promise.resolve(selectResultQueue.shift() ?? []));
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere, orderBy: mockOrderBy, limit: mockLimit }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    selectResultQueue,
    mockLimit,
    mockOrderBy,
    mockWhere,
    mockFrom,
    mockSelect,
  };
});
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('dotenv/config', () => ({}));

vi.mock('../db/client.js', () => ({
  db: {
    select: mocks.mockSelect,
  },
}));

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

import { resolveTrainerId, PracticeNotConfiguredError } from '../lib/trainer.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TRAINER_ID = 'aa000000-0000-0000-0000-000000000001';
const TRAINER_ID_2 = 'aa000000-0000-0000-0000-000000000002';

// ── Setup / teardown ──────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectResultQueue.length = 0;

  mocks.mockLimit.mockImplementation(() =>
    Promise.resolve(mocks.selectResultQueue.shift() ?? []),
  );
  mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockFrom.mockReturnValue({
    where: mocks.mockWhere,
    orderBy: mocks.mockOrderBy,
    limit: mocks.mockLimit,
  });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

  // Ensure env key is absent before each test.
  delete process.env.PRACTICE_TRAINER_ID;
});

afterEach(() => {
  delete process.env.PRACTICE_TRAINER_ID;
});

// ── resolveTrainerId() ────────────────────────────────────────────────────────
describe('resolveTrainerId()', () => {
  describe('env-var precedence (PRACTICE_TRAINER_ID set)', () => {
    it('returns the env var value without querying the DB', async () => {
      process.env.PRACTICE_TRAINER_ID = TRAINER_ID;

      const result = await resolveTrainerId();

      expect(result).toBe(TRAINER_ID);
      // No DB call should have been made.
      expect(mocks.mockSelect).not.toHaveBeenCalled();
    });

    it('trims whitespace from the env var value', async () => {
      process.env.PRACTICE_TRAINER_ID = `  ${TRAINER_ID}  `;

      const result = await resolveTrainerId();

      expect(result).toBe(TRAINER_ID);
      expect(mocks.mockSelect).not.toHaveBeenCalled();
    });

    it('takes env-var precedence over any DB trainer row', async () => {
      process.env.PRACTICE_TRAINER_ID = TRAINER_ID;
      // Push a competing trainer row that should NOT be returned.
      mocks.selectResultQueue.push([{ id: TRAINER_ID_2 }]);

      const result = await resolveTrainerId();

      // Should use the env var, NOT the DB row.
      expect(result).toBe(TRAINER_ID);
      expect(mocks.mockSelect).not.toHaveBeenCalled();
    });
  });

  describe('DB fallback (PRACTICE_TRAINER_ID unset)', () => {
    it('returns the trainer row id when env is unset and a trainer exists', async () => {
      mocks.selectResultQueue.push([{ id: TRAINER_ID }]);

      const result = await resolveTrainerId();

      expect(result).toBe(TRAINER_ID);
      expect(mocks.mockSelect).toHaveBeenCalledTimes(1);
    });

    it('queries by asc(trainer.id) + limit(1) (oldest trainer picked)', async () => {
      mocks.selectResultQueue.push([{ id: TRAINER_ID }]);

      await resolveTrainerId();

      // The chain: select().from().orderBy().limit()
      expect(mocks.mockSelect).toHaveBeenCalledTimes(1);
      expect(mocks.mockOrderBy).toHaveBeenCalledTimes(1);
      expect(mocks.mockLimit).toHaveBeenCalledTimes(1);
    });

    it('falls back to DB when env var is empty string', async () => {
      process.env.PRACTICE_TRAINER_ID = '';
      mocks.selectResultQueue.push([{ id: TRAINER_ID }]);

      const result = await resolveTrainerId();

      expect(result).toBe(TRAINER_ID);
      expect(mocks.mockSelect).toHaveBeenCalledTimes(1);
    });

    it('falls back to DB when env var is whitespace-only', async () => {
      process.env.PRACTICE_TRAINER_ID = '   ';
      mocks.selectResultQueue.push([{ id: TRAINER_ID }]);

      const result = await resolveTrainerId();

      expect(result).toBe(TRAINER_ID);
      expect(mocks.mockSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('PracticeNotConfiguredError (no env, no trainer row)', () => {
    it('throws PracticeNotConfiguredError when env is unset and no trainer row exists', async () => {
      mocks.selectResultQueue.push([]); // empty result

      await expect(resolveTrainerId()).rejects.toThrow(PracticeNotConfiguredError);
    });

    it('thrown error has the correct message "practice not configured"', async () => {
      mocks.selectResultQueue.push([]);

      await expect(resolveTrainerId()).rejects.toThrow('practice not configured');
    });

    it('thrown error name is PracticeNotConfiguredError', async () => {
      mocks.selectResultQueue.push([]);

      try {
        await resolveTrainerId();
        // Should not reach here.
        expect.fail('Expected PracticeNotConfiguredError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PracticeNotConfiguredError);
        expect((err as Error).name).toBe('PracticeNotConfiguredError');
      }
    });
  });
});
