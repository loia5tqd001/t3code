# Relay observability

This fork does not export relay, client, or mobile traces to Axiom. The relay Worker records no
remote invocation traces, and the mobile app has no crash or startup telemetry upload path.

Use the local server and desktop trace files under the T3 Code data directory when diagnosing the
relay. The relay still exposes health and metadata endpoints for normal operation; those are not
analytics.
