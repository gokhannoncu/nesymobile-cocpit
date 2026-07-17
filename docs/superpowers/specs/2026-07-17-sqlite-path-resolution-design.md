# SQLite PATH Resolution Design

## Problem

The debug database reader only checks configured environment variables and a
small list of fixed SQLite locations. It therefore reports `sqlite3 binary not
found` even when `sqlite3` is available through the host operating system's
`PATH`.

## Design

Keep the existing resolution priority:

1. `SQLITE3_PATH`
2. Platform-specific environment variable
3. Known platform-specific installation locations
4. Host `PATH`

The final lookup is platform-aware:

- Windows invokes `where.exe sqlite3`.
- macOS and Linux invoke `which sqlite3`.

Only an existing path returned by the command is accepted. Resolution remains
cached after the first lookup.

## Scope

The change stays in the web server's SQLite path resolver. ADB resolution and
database-copy behavior are unchanged. No SQLite installation or user-level
environment mutation is performed.

## Error Handling

PATH lookup failures, empty output, and non-existing results are treated as
"not found"; callers retain the current actionable error message.

## Testing

Unit tests cover Windows and Unix PATH lookup, fixed-path precedence, and the
not-found case. The existing web test suite, lint checks, and TypeScript build
must remain green.
