
import { Agent, MCPTool } from './types';
import { executeTool } from './mcp-server';

/**
 * MCPClient: The bridge between the LLM Reasoning Engine and Production Tools.
 * Handles the Model Context Protocol lifecycle.
 */
export class MCPClient {
  private agent: Agent;
  private onLog: (message: string) => void;

  constructor(agent: Agent, onLog: (msg: string) => void) {
    this.agent = agent;
    this.onLog = onLog;
  }

  /**
   * Processes a function call from the model.
   * Logic: Identify Tool -> Check Auth -> Execute via Server -> Format Response
   */
  // Fix: Update parameter type to handle optional name and id properties from the SDK's FunctionCall type
  async handleToolCall(fc: { name?: string; args?: any; id?: string }, delegateHandler: (targetId: string, task: string) => Promise<string>): Promise<any> {
    const fcName = fc.name || '';
    if (!fcName) {
      this.onLog(`[MCP CLIENT] Error: Function call missing name.`);
      return { error: "MISSING_NAME" };
    }
    
    this.onLog(`[MCP CLIENT] Inbound call: ${fcName}`);

    // 1. Handle Internal Orchestration (Agency-to-Agency Delegation)
    if (fcName === 'delegate_to_agent') {
      const { agent_id, task } = (fc.args || {}) as any;
      this.onLog(`[MCP CLIENT] Routing delegation to server: internal_orchestra -> ${agent_id}`);
      const result = await delegateHandler(agent_id, task);
      return { result };
    }

    // 2. Handle External Provider Tools
    const toolMeta = this.agent.mcpTools.find(t => t.name === fcName);
    if (!toolMeta) {
      this.onLog(`[MCP CLIENT] Error: Tool ${fcName} not found in agent registry.`);
      return { error: "TOOL_NOT_FOUND" };
    }

    this.onLog(`[MCP CLIENT] Dispatching to MCP Server: ${toolMeta.provider}`);
    
    try {
      const result = await executeTool(fcName, fc.args || {}, toolMeta.provider);
      // Fixed: Solely rely on 'latency' property from server's _metadata
      this.onLog(`[MCP CLIENT] Server Response: Success (Latency: ${result._metadata.latency}ms)`);
      return { result };
    } catch (err: any) {
      if (err.message.includes('AUTHENTICATION_REQUIRED')) {
        this.onLog(`[MCP CLIENT] Auth Failure: ${toolMeta.provider} requires valid session.`);
        throw err; // Re-throw to handle UI auth prompt
      }
      this.onLog(`[MCP CLIENT] Server Error: ${err.message}`);
      return { error: err.message };
    }
  }

  /**
   * Serializes agent tools into Gemini-compatible Function Declarations
   */
  getToolDefinitions() {
    return this.agent.mcpTools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
  }
}
