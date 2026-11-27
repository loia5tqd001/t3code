# Product analytics

This fork does not collect product analytics. The server, web, desktop, and mobile apps do not
open an analytics, crash-report, or relay-trace connection to T3 Code, PostHog, Axiom, or a
user-configured OTLP endpoint.

Local diagnostics are separate and remain available: the server and desktop app write rotating
NDJSON trace files under the T3 Code data directory, and Diagnostics can inspect local logs,
resources, and spans. Those files are never forwarded by the app.
