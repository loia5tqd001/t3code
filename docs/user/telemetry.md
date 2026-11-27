# Product usage data

T3 Code keeps usage data on the machine that runs the server. This fork does not send product
analytics, account or device identifiers, or relay connection traces to T3 Code or PostHog.

Local diagnostics remain available under **Settings > Maintenance > Diagnostics**. Server and
desktop trace files, logs, and resource samples stay in the T3 Code data directory.

## Local feedback

Agent feedback reports remain on this machine. The optional feedback tools and Settings > Labs
mode are still available, but approving a report no longer sends it to T3 Code. `t3 feedback list`
shows the locally saved reports.

## No outbound diagnostics

This fork has no relay trace export, crash-report upload, OTLP export, or user-configured telemetry
receiver. Compatible environment names and policy flags do not create an outbound path.

## Agent activity for mobile notifications

When **Publish agent activity** is enabled on a host, it sends project and thread titles, model
names, activity status, and environment and thread identifiers to the T3 Connect relay for mobile
notifications and live activities. This is product functionality selected by the host owner, not
analytics. To stop publishing, turn it off under **Settings > Sharing & access** on the host.
