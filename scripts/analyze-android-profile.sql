-- Run: trace_processor query -f scripts/analyze-android-profile.sql android.pftrace
-- CPU seconds are scheduled CPU time across cores, not UI latency.
SELECT round((end_ts - start_ts) / 1e9, 3) AS trace_seconds FROM trace_bounds;

SELECT p.name AS process_name, p.pid,
       round(sum(s.dur) / 1e9, 3) AS scheduled_cpu_seconds
FROM sched s
JOIN thread t USING (utid)
JOIN process p USING (upid)
WHERE s.dur > 0
  AND (p.name LIKE '%nesymobile%' OR p.name LIKE '%verdict%')
GROUP BY p.upid
ORDER BY scheduled_cpu_seconds DESC;

SELECT p.name AS process_name, t.name AS thread_name, t.tid,
       round(sum(s.dur) / 1e9, 3) AS scheduled_cpu_seconds
FROM sched s
JOIN thread t USING (utid)
JOIN process p USING (upid)
WHERE s.dur > 0
  AND (p.name LIKE '%nesymobile%' OR p.name LIKE '%verdict%')
GROUP BY t.utid
ORDER BY scheduled_cpu_seconds DESC
LIMIT 20;

SELECT name, idx, value, severity
FROM stats
WHERE value > 0
  AND (name GLOB '*overrun*' OR name GLOB '*lost*'
       OR name GLOB '*drop*' OR name GLOB '*parse_error*')
ORDER BY name, idx;
