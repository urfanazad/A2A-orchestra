
import { Type } from "@google/genai";

export interface MCPTool {
  name: string;
  description: string;
  provider: string; // Required for auth mapping
  parameters: {
    type: Type.OBJECT;
    properties: Record<string, {
      type: Type;
      description: string;
      items?: {
        type: Type;
        description?: string;
      };
    }>;
    required: string[];
  };
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  category: string;
  icon: string;
  description: string;
  mcpTools: MCPTool[];
  systemPrompt: string;
  samplePrompts?: string[];
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'test';
  content: string;
  agentId?: string;
  timestamp: number;
  cached?: boolean;
  error?: boolean;
  providerId?: string; // ID of the provider that failed auth
}

export interface SystemMetrics {
  tokensSaved: number;
  cacheHits: number;
  totalRequests: number;
  avgLatency: number;
}

export type ProviderStatus = 'disconnected' | 'connecting' | 'connected';

export interface ConnectorProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: ProviderStatus;
  accessToken?: string; // Live production token
}
