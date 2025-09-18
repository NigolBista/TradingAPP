# Suggested Claude Sub-Agents

Reference doc: https://docs.claude.com/en/docs/claude-code/sub-agents

Why sub-agents? Creating named agents keeps prompts role-specific and repeatable, supports parallel workflows (research → review), and helps audit or rerun decisions without context drift compared with ad-hoc prompts.

## Architecture Advisor
- **Purpose:** Review high-level designs, refactor plans, and large feature proposals for alignment with layered architecture, shared state patterns, and error handling expectations.
- **When to trigger:** Before significant structural changes (e.g., the StockDetailScreen refactor) or when introducing new services/stores.
- **Expected output:** Pass/warn/fail summary referencing project standards and actionable follow-ups.

## Frontend Specialist
- **Purpose:** Validate React Native UI implementations with a focus on component decomposition, hook usage, accessibility, theming, and performance.
- **When to trigger:** Any PR touching UI-heavy screens, reusable components, or navigation patterns.
- **Expected output:** Concrete feedback on layout, styling consistency, and render performance risks.

## Backend & Data Specialist
- **Purpose:** Vet data-fetching logic, caching layers, and service integrations (e.g., Supabase, market data providers, Zustand stores).
- **When to trigger:** Changes that modify business logic, background refresh flows, or external API contracts.
- **Expected output:** Findings on data consistency, error fallback coverage, and opportunities for resilience improvements.

## Research Specialist
- **Purpose:** Explore solution spaces for new product capabilities, gathering architectural options, industry practices, and tooling comparisons. Acts as a scout before locking implementation direction.
- **When to trigger:** Early in ideation for features like broadcast notifications based on stock subscriptions, or any initiative lacking clear precedent in the codebase.
- **Expected output:** Curated summary of viable approaches, trade-offs, and recommended path forward with references to external sources when possible.

## Guardrails
- Run the Architecture Advisor first on major initiatives; consult the specialized agents only after incorporating architectural guidance.
- Treat agent responses as input to human review—resolve conflicts manually and keep a changelog of adopted recommendations.
- Reassess agent definitions whenever project standards or tooling change to prevent drift.
