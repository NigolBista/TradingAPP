import { Agent, AgentRegistry, AgentCapability } from './types';

class AgentRegistryImpl implements AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  register(agent: Agent): void {
    this.agents.set(agent.name, agent);
    console.log(`Registered agent: ${agent.name}`);
  }

  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  getAgentsByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent =>
      agent.capabilities.some(cap => cap.name === capability)
    );
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Helper method to find agents that can handle a specific action
  getAgentsForAction(action: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent =>
      agent.canHandle(action)
    );
  }

  // Helper method to get agent capabilities summary
  getCapabilitiesSummary(): Record<string, string[]> {
    const summary: Record<string, string[]> = {};
    this.agents.forEach((agent, name) => {
      summary[name] = agent.capabilities.map(cap => cap.name);
    });
    return summary;
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistryImpl();
