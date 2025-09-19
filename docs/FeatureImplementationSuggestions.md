# Implementation Plan Review Suggestions

## Summary
- The existing feature summary lacks actionable detail for engineering and product teams.
- Backend schema updates need explicit enum definitions, validation paths, and rollback plans.
- Discord data ingestion introduces compliance, privacy, and observability obligations that are currently undocumented.
- The eight-week roadmap reads as a linear backlog and does not identify milestones, staffing, or risk mitigation.

## Recommended Actions

### 1. Expand the Baseline Product Plan
- Rewrite `docs/Plan.md` as a small product brief with user personas, primary goals, and success metrics for alerts, Discord insights, and the focus screen.
- For each feature, add acceptance criteria, edge cases (e.g., alert duplication, Discord downtime, market holidays), and dependencies on existing systems like Supabase or push providers.
- Document non-functional requirements: target latency, peak volumes, offline tolerances, and data retention horizons.

### 2. Harden Schema and Migration Steps
- Before running the Phase 1 SQL, define custom enums (`alert_priority`, `alert_category`, `alert_status`, `queue_status`) or confirm their presence in Supabase migrations.
- Note rollback procedures and data backfill strategy when introducing new columns (especially `priority`, `category`, and `cooldown_period`).
- Call out indexing, partitioning, and retention approaches for high-volume tables such as `notifications_queue`, `discord_messages`, and `processed_signals`.

### 3. Add Compliance and Security Guidance for Discord Data
- Document lawful basis, consent, and retention policies for storing Discord user IDs, message content, and group reputations.
- Outline access controls, anonymisation/pseudonymisation options, and incident-response expectations for the crawler service.
- Include observability requirements: logging levels, alerting thresholds, and dashboards for ingestion throughput and failure rates.

### 4. Rework the Delivery Roadmap
- Break the eight-week plan into gated milestones (prototype, beta, production) with clear exit criteria.
- Identify staffing assumptions and cross-team dependencies (e.g., backend, mobile, data science, DevOps) per milestone.
- Highlight high-risk tasks (NLP accuracy, sequential pump detection, offline sync) and pair them with mitigation plans such as proof-of-concepts or staged rollouts.

### 5. Capture Open Questions
- Clarify how user notification preferences interact across devices and platforms.
- Decide whether Discord-derived alerts feed directly into the general alert queue or remain isolated behind feature flags.
- Determine how sequential pump probability should be validated against historical market data before it drives trading alerts.
