# Trading App Sub-Agents

This directory contains specialized Claude sub-agents for the trading application. Each agent focuses on specific aspects of the codebase and provides targeted expertise.

## Available Agents

### 1. Architecture Advisor
**Built-in agent** - Available by default
- **Purpose:** High-level design review, refactor plans, structural changes
- **When to use:** Before significant architectural changes
- **Alias:** `architecture-advisor`

### 2. Mobile Cross-Platform Specialist
**File:** `mobile-cross-platform.md`
- **Purpose:** Expo/React Native cross-platform compatibility
- **When to use:** Platform-specific features, releases, native integrations
- **Aliases:** `mobile`, `platform`

### 3. Performance & UX Specialist
**File:** `performance-ux.md`
- **Purpose:** Mobile performance optimization and user experience
- **When to use:** After major refactors, performance-critical features
- **Aliases:** `perf`, `ux`

### 4. Trading Domain Specialist
**File:** `trading-domain.md`
- **Purpose:** Financial data accuracy, compliance, trading workflows
- **When to use:** Financial features, market data, compliance reviews
- **Aliases:** `trading`, `finance`

## Usage Guidelines

### Agent Hierarchy
1. **Start with Architecture Advisor** for major initiatives
2. **Use specialized agents** after incorporating architectural guidance
3. **Resolve conflicts manually** and keep changelog of adopted recommendations

### When to Trigger Each Agent

#### Current StockDetailScreen Refactor
- **Architecture Advisor**: ✅ Already used for overall plan
- **Performance & UX**: Use after component breakup to validate performance
- **Mobile Cross-Platform**: Use before release to ensure iOS/Android compatibility
- **Trading Domain**: Use to validate financial data handling remains accurate

#### Future Feature Development
- **Research phase**: Architecture Advisor
- **Implementation**: Relevant specialist (Mobile/Performance/Trading)
- **Pre-release**: All applicable specialists for comprehensive review

### Example Usage Patterns

```bash
# For architectural planning
/agents architecture-advisor "Review the planned StockDetailScreen refactor"

# For performance validation
/agents perf "Analyze the refactored StockDetailScreen components for performance issues"

# For platform compatibility
/agents mobile "Check iOS/Android compatibility of the new chart components"

# For financial accuracy
/agents trading "Validate that real-time quote updates maintain accuracy after refactor"
```

## Agent Maintenance

### When to Update Agents
- **Project standards change**: Update agent definitions
- **New tools/frameworks**: Modify agent expertise areas
- **Compliance requirements**: Update trading domain specialist
- **Performance targets**: Adjust performance specialist metrics

### Tracking Agent Recommendations
- Keep changelog of adopted vs rejected recommendations
- Document recurring issues for agent improvement
- Review agent effectiveness quarterly

## Quick Reference

| Need | Agent | Alias | Trigger When |
|------|-------|--------|--------------|
| Architecture | architecture-advisor | `architecture-advisor` | Major structural changes |
| Cross-platform | mobile-cross-platform | `mobile`, `platform` | Platform-specific code, releases |
| Performance | performance-ux | `perf`, `ux` | After major changes, before releases |
| Financial | trading-domain | `trading`, `finance` | Market data, compliance, trading features |

## Integration with Development Workflow

### Pre-commit
- Run relevant agents based on changed files
- Required: Architecture review for major changes

### Pre-release
- All agents should pass their assessments
- Address critical issues before deployment

### Feature Development
1. **Planning**: Architecture Advisor
2. **Implementation**: Specialist agents as needed
3. **Review**: Comprehensive multi-agent review
4. **Release**: Final validation with all applicable agents