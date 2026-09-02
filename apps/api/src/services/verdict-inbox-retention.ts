/**
 * Retention for `verdict_inbox`, which until now had none.
 *
 * Two windows, because the rows do two different jobs. HTTP metadata is trend
 * data — p95 drifting over months is the question it answers — while a captured
 * body is debugging material whose usefulness is measured in days. Giving them
 * one window would either throw away the trend or keep real customer payloads
 * far longer than anyone needs them.
 *
 * ## Why a body is redacted in place, not deleted
 *
 * Deleting the row would take the body's own metadata with it — its size, media
 * type, whether it was truncated — and the run would then look like it never
 * captured anything. Worse, the read model reassembles chunks and reports
 * `complete`, so a partially deleted body would read as *lost in transit*.
 * "We measured this and no longer keep it" and "we never measured it" and "we
 * lost it" are three different claims about a run, and a retention job that
 * collapses them is a retention job that corrupts the evidence record.
 *
 * So the body text is replaced with a marker the read model understands, and
 * everything else about the capture survives to the metadata window.
 *
 * ## Why `raw` is cleared too
 *
 * Each row stores the parsed payload AND a verbatim `raw` copy of the logcat
 * line it came from. The body text is therefore present twice, and a purge that
 * cleared only the parsed copy would leave the payload sitting in the column
 * next to it.
 */
import { prisma } from "@nesy/db";

/** Captured HTTP bodies: 14 days. */
export const DEFAULT_BODY_RETENTION_MS = 14 * 24 * 60 * 60_000;

/** Everything else in the inbox: 90 days. */
export const DEFAULT_EVENT_RETENTION_MS = 90 * 24 * 60 * 60_000;

/** Marker written in place of purged body text; read back as `purged: true`. */
export const BODY_PURGED_MARKER = "true";

export interface RetentionRow {
  seq: number | string;
  event: string | null;
  receivedAt: Date | string | number;
  hasBody: boolean;
}

export interface RetentionPlan {
  /** Rows whose body text is to be replaced by the marker. */
  purgeBodyText: readonly string[];
  /** Rows to delete outright. */
  deleteRows: readonly string[];
}

/**
 * The pure selection contract, separated from the SQL so it can be tested
 * without a database — the same split `sensitive-capture-purge.ts` uses.
 *
 * A row can only be in one list. A body row past the *event* window is deleted
 * rather than redacted: there is no metadata left worth keeping at that point,
 * and redacting it would leave a tombstone that outlives everything it referred
 * to.
 */
export function planInboxRetention(
  rows: readonly RetentionRow[],
  options: {
    bodyRetentionMs?: number;
    eventRetentionMs?: number;
    nowMs?: number;
  } = {},
): RetentionPlan {
  const bodyRetentionMs = options.bodyRetentionMs ?? DEFAULT_BODY_RETENTION_MS;
  const eventRetentionMs = options.eventRetentionMs ?? DEFAULT_EVENT_RETENTION_MS;
  const nowMs = options.nowMs ?? Date.now();

  if (!Number.isFinite(bodyRetentionMs) || bodyRetentionMs < 0) {
    throw new Error("bodyRetentionMs must be a non-negative finite number");
  }
  if (!Number.isFinite(eventRetentionMs) || eventRetentionMs < 0) {
    throw new Error("eventRetentionMs must be a non-negative finite number");
  }
  if (bodyRetentionMs > eventRetentionMs) {
    // Not a matter of taste: a body window longer than the event window would
    // mean redacting a row this same run is about to delete, and the two rules
    // would silently fight every night.
    throw new Error("bodyRetentionMs must not exceed eventRetentionMs");
  }

  const purgeBodyText: string[] = [];
  const deleteRows: string[] = [];

  for (const row of rows) {
    const receivedMs = new Date(row.receivedAt).getTime();
    if (!Number.isFinite(receivedMs)) continue;
    const age = nowMs - receivedMs;
    const seq = String(row.seq);

    if (age >= eventRetentionMs) {
      deleteRows.push(seq);
      continue;
    }
    if (
      row.event === "HTTP_BODY_CAPTURED" &&
      row.hasBody &&
      age >= bodyRetentionMs
    ) {
      purgeBodyText.push(seq);
    }
  }

  return { purgeBodyText, deleteRows };
}

export interface RetentionResult {
  bodiesPurged: number;
  rowsDeleted: number;
}

/**
 * Applies both windows.
 *
 * Written as two set-based statements rather than a select-then-act loop: the
 * inbox is the hot ingest table, and holding a row list across a round trip
 * means acting on rows that a concurrent run has already changed.
 */
export async function applyInboxRetention(
  options: {
    bodyRetentionMs?: number;
    eventRetentionMs?: number;
  } = {},
): Promise<RetentionResult> {
  const bodyRetentionMs = options.bodyRetentionMs ?? DEFAULT_BODY_RETENTION_MS;
  const eventRetentionMs = options.eventRetentionMs ?? DEFAULT_EVENT_RETENTION_MS;
  if (bodyRetentionMs > eventRetentionMs) {
    throw new Error("bodyRetentionMs must not exceed eventRetentionMs");
  }

  const bodyCutoff = new Date(Date.now() - bodyRetentionMs);
  const eventCutoff = new Date(Date.now() - eventRetentionMs);

  const bodiesPurged = await prisma.$executeRaw`
    UPDATE verdict_inbox
    SET payload = jsonb_set(
      (payload - 'raw') #- '{data,body}',
      '{data,body_purged}',
      to_jsonb(${BODY_PURGED_MARKER}::text)
    )
    WHERE payload->>'event' = 'HTTP_BODY_CAPTURED'
      AND payload->'data' ? 'body'
      AND received_at < ${bodyCutoff}
  `;

  const rowsDeleted = await prisma.$executeRaw`
    DELETE FROM verdict_inbox WHERE received_at < ${eventCutoff}
  `;

  return { bodiesPurged, rowsDeleted };
}

const DAY_MS = 24 * 60 * 60_000;

/** Long enough that boot is never blocked, short enough to survive a dev restart. */
const FIRST_SWEEP_DELAY_MS = 60_000;

/** Once a day; the windows are measured in weeks, so nothing needs finer. */
const SWEEP_INTERVAL_MS = DAY_MS;

export interface RetentionScheduleOptions {
  enabled?: boolean;
  bodyRetentionDays?: number;
  eventRetentionDays?: number;
  /** Injected in tests; defaults to the real database sweep. */
  run?: (options: {
    bodyRetentionMs: number;
    eventRetentionMs: number;
  }) => Promise<RetentionResult>;
  log?: (message: string) => void;
}

/**
 * Runs the retention sweep on a timer for as long as the process lives.
 *
 * ## Why the first sweep is a minute in, not a day in
 *
 * A plain 24-hour interval never fires in development, where the API restarts
 * many times an hour, and never fires after any deploy that lands more often
 * than daily. The window would look configured and would never once have run.
 * Sweeping shortly after boot means a restart *is* a sweep; the work is
 * idempotent, so doing it more often than needed costs a pair of indexed
 * statements that match nothing.
 *
 * ## Why several instances are allowed to race
 *
 * Both statements are set-based and idempotent: the delete matches on age, and
 * the body purge matches only rows that still have body text. Two instances
 * sweeping at once do the same work twice and reach the same state — cheaper
 * than a lock that then has to be reasoned about when it is held by a process
 * that died.
 *
 * @returns a stop function; call it on shutdown so the timer cannot outlive the
 *   server (and so tests do not hang on an open handle).
 */
export function startInboxRetentionSchedule(
  options: RetentionScheduleOptions = {},
): () => void {
  const log = options.log ?? ((message: string) => console.log(message));
  if (options.enabled === false) {
    log("[verdict-retention] disabled by configuration");
    return () => {};
  }

  const bodyRetentionMs = (options.bodyRetentionDays ?? 14) * DAY_MS;
  const eventRetentionMs = (options.eventRetentionDays ?? 90) * DAY_MS;
  if (bodyRetentionMs > eventRetentionMs) {
    // Refuse rather than silently reordering: an operator who set these
    // backwards meant something, and guessing which half they meant is worse
    // than telling them the pair is impossible.
    throw new Error(
      "VERDICT_RETENTION_BODY_DAYS must not exceed VERDICT_RETENTION_EVENT_DAYS",
    );
  }

  const run = options.run ?? applyInboxRetention;
  let stopped = false;

  const sweep = async () => {
    if (stopped) return;
    try {
      const result = await run({ bodyRetentionMs, eventRetentionMs });
      // Always logged, including the zero case. A retention job that only
      // speaks up when it deletes something is indistinguishable from one that
      // is not running.
      log(
        `[verdict-retention] swept: ${result.bodiesPurged} body text purged, ` +
          `${result.rowsDeleted} rows deleted ` +
          `(bodies > ${options.bodyRetentionDays ?? 14}d, rows > ${options.eventRetentionDays ?? 90}d)`,
      );
    } catch (error) {
      // Never throws out of the timer: an unhandled rejection here would take
      // the API process down over housekeeping.
      log(
        `[verdict-retention] sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const firstTimer = setTimeout(() => {
    void sweep();
  }, FIRST_SWEEP_DELAY_MS);
  const intervalTimer = setInterval(() => {
    void sweep();
  }, SWEEP_INTERVAL_MS);

  // Housekeeping must not be the reason the process stays alive.
  firstTimer.unref?.();
  intervalTimer.unref?.();

  return () => {
    stopped = true;
    clearTimeout(firstTimer);
    clearInterval(intervalTimer);
  };
}
