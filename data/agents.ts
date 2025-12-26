
import { Type } from "@google/genai";
import { Agent } from '../types';

export const ALL_AGENTS: Agent[] = [
  // --- ORCHESTRATION ---
  {
    id: 'supervisor-agent',
    name: 'The Conductor',
    role: 'Chief Orchestra Supervisor',
    category: 'orchestration',
    icon: '🪄',
    description: 'Autonomous coordinator that manages complex requests by delegating to specialized agents.',
    mcpTools: [{
      name: 'delegate_to_agent',
      description: 'Hands off a specific sub-task to a specialized agent and waits for their expert output.',
      provider: 'internal_orchestra',
      parameters: {
        type: Type.OBJECT,
        properties: { 
          agent_id: { type: Type.STRING, description: 'Agent ID' },
          task: { type: Type.STRING, description: 'Instructions for the agent.' }
        },
        required: ['agent_id', 'task']
      }
    }],
    systemPrompt: `You are the master supervisor. Break requests down and delegate to specialized agents.`
  },

  // --- STRATEGY, VALUE & GOVERNANCE ---
  { id: 'strategy-agent', name: 'Strategy Agent', role: 'Strategic Advisor', category: 'strategy', icon: '🎯', description: 'Aligns product initiatives with long-term company goals.', mcpTools: [], systemPrompt: 'Focus on long-term strategy and competitive positioning.' },
  { id: 'value-agent', name: 'Business Value Agent', role: 'Value Architect', category: 'strategy', icon: '💰', description: 'Calculates ROI and builds the business case for new features.', mcpTools: [], systemPrompt: 'Focus on business value, KPIs, and ROI modeling.' },
  { id: 'pricing-agent', name: 'Pricing Agent', role: 'Economics Lead', category: 'strategy', icon: '🏷️', description: 'Handles unit economics and pricing strategy.', mcpTools: [], systemPrompt: 'Analyze unit economics and market pricing tiers.' },
  { id: 'risk-agent', name: 'Risk Agent', role: 'RAID Coordinator', category: 'strategy', icon: '⚠️', description: 'Manages the RAID log and Architectural Decision Records (ADR).', mcpTools: [], systemPrompt: 'Identify risks, assumptions, issues, and dependencies.' },
  { id: 'approval-agent', name: 'Approval Agent', role: 'Governance Gatekeeper', category: 'strategy', icon: '✅', description: 'Provides recommendations for executive sign-off.', mcpTools: [], systemPrompt: 'Review inputs and provide a clear recommendation for approval.' },

  // --- DISCOVERY & PRODUCT ---
  { id: 'discovery-agent', name: 'Discovery Agent', role: 'Discovery Lead', category: 'discovery', icon: '🔭', description: 'Facilitates problem discovery and solution ideation.', mcpTools: [], systemPrompt: 'Lead discovery workshops and problem space mapping.' },
  { id: 'pm-agent', name: 'Product Manager', role: 'Product Lead', category: 'discovery', icon: '📋', description: 'Owns product vision, Jira backlogs, and Miro boards.', mcpTools: [], systemPrompt: 'Translate vision into actionable roadmaps and backlog items.' },
  { id: 'research-agent', name: 'User Research Agent', role: 'Insights Researcher', category: 'discovery', icon: '🔍', description: 'Synthesizes user research and feedback into actionable insights.', mcpTools: [], systemPrompt: 'Analyze user behavior data and research findings.' },
  { id: 'backlog-agent', name: 'Refinement Agent', role: 'Backlog Specialist', category: 'discovery', icon: '🧹', description: 'Keeps the backlog refined, estimated, and ready for development.', mcpTools: [], systemPrompt: 'Focus on story readiness and definition of ready.' },

  // --- DESIGN ---
  { id: 'design-agent', name: 'Design Agent', role: 'UI/UX Architect', category: 'design', icon: '🎨', description: 'Ensures UI/UX consistency and high design standards.', mcpTools: [], systemPrompt: 'Create user-centric designs and wireframes.' },
  { id: 'design-system-agent', name: 'Design System Agent', role: 'Accessibility Lead', category: 'design', icon: '📏', description: 'Maintains the design system and ensures accessibility (A11y).', mcpTools: [], systemPrompt: 'Ensure brand consistency and WCAG compliance.' },

  // --- DELIVERY & EXECUTION ---
  { id: 'delivery-mgr-agent', name: 'Delivery Manager', role: 'Execution Lead', category: 'delivery', icon: '🚀', description: 'Tracks project progress and removes delivery bottlenecks.', mcpTools: [], systemPrompt: 'Monitor delivery timelines and manage stakeholder expectations.' },
  { id: 'scrum-agent', name: 'Scrum Master', role: 'Jira Monitor', category: 'delivery', icon: '🔄', description: 'Monitors Jira boards, cycle time, and team velocity.', mcpTools: [], systemPrompt: 'Facilitate agile ceremonies and monitor team health metrics.' },
  { id: 'release-agent', name: 'Release Manager', role: 'Deployment Coordinator', category: 'delivery', icon: '📦', description: 'Coordinates release windows and environment readiness.', mcpTools: [], systemPrompt: 'Plan and coordinate production deployments.' },
  { id: 'dependency-agent', name: 'Dependency Agent', role: 'Risk Coordinator', category: 'delivery', icon: '🔗', description: 'Tracks cross-team dependencies and delivery risks.', mcpTools: [], systemPrompt: 'Coordinate across teams to resolve blocking dependencies.' },

  // --- ENGINEERING ---
  { id: 'code-agent', name: 'Code Agent', role: 'Lead Developer', category: 'engineering', icon: '💻', description: 'Autonomous code generation and Pull Request management.', mcpTools: [], systemPrompt: 'Write high-quality, documented, and tested code.' },
  { id: 'arch-agent', name: 'Architecture Agent', role: 'Tech Standards Lead', category: 'engineering', icon: '🏗️', description: 'Ensures adherence to tech standards and architectural patterns.', mcpTools: [], systemPrompt: 'Enforce architectural patterns and technical excellence.' },
  { id: 'security-agent', name: 'Security Agent', role: 'SecOps Lead', category: 'engineering', icon: '🔐', description: 'Manages secrets, vulnerability scans, and security posture.', mcpTools: [], systemPrompt: 'Secure the application and manage environment secrets.' },

  // --- QUALITY & RELIABILITY ---
  { id: 'test-agent', name: 'Testing Agent', role: 'QA Automation Lead', category: 'quality', icon: '🧪', description: 'Generates and executes automated test suites.', mcpTools: [], systemPrompt: 'Create comprehensive test plans and automation scripts.' },
  { id: 'dod-agent', name: 'Quality Gate Agent', role: 'DoD Auditor', category: 'quality', icon: '🛡️', description: 'Audits features against the Definition of Done (DoD).', mcpTools: [], systemPrompt: 'Ensure every PR meets the quality and documentation gates.' },
  { id: 'sre-agent', name: 'SRE Agent', role: 'Observability Lead', category: 'quality', icon: '📈', description: 'Monitors system health, SLIs, and SLOs.', mcpTools: [], systemPrompt: 'Maximize system reliability and manage monitoring tools.' },
  { id: 'incident-agent', name: 'Incident Agent', role: 'Post-Mortem Lead', category: 'quality', icon: '🚨', description: 'Manages incident response and post-mortem analysis.', mcpTools: [], systemPrompt: 'Coordinate incident resolution and lead root-cause analysis.' },

  // --- DATA & ANALYTICS ---
  { id: 'analytics-agent', name: 'Analytics Agent', role: 'Event Architect', category: 'analytics', icon: '📊', description: 'Manages event tracking and data instrumentation.', mcpTools: [], systemPrompt: 'Design and audit data tracking and telemetry.' },
  { id: 'experiment-agent', name: 'A/B Testing Agent', role: 'Experimentation Lead', category: 'analytics', icon: '🧪', description: 'Runs experimentation and A/B testing analysis.', mcpTools: [], systemPrompt: 'Analyze experiment results and suggest optimizations.' },
  { id: 'data-quality-agent', name: 'Data Quality Agent', role: 'Anomaly Lead', category: 'analytics', icon: '📉', description: 'Detects data anomalies and ensures pipeline integrity.', mcpTools: [], systemPrompt: 'Monitor data pipelines and flag quality issues.' },

  // --- MARKETING & GROWTH ---
  {
    id: 'marketing-agent',
    name: 'Marketing Agent',
    role: 'Growth Strategist',
    category: 'marketing',
    icon: '📣',
    description: 'Handles broader marketing strategy and campaign planning.',
    mcpTools: [{
      name: 'post_instagram_video',
      description: 'Posts a video to Instagram with a specific caption.',
      provider: 'instagram',
      parameters: {
        type: Type.OBJECT,
        properties: {
          video_url: { type: Type.STRING, description: 'The public URL of the video to post.' },
          caption: { type: Type.STRING, description: 'The caption for the Instagram post.' }
        },
        required: ['video_url', 'caption']
      }
    }],
    systemPrompt: 'Drive user acquisition and campaign performance. You can now post video content directly to Instagram using provided tools.'
  },
  {
    id: 'seo-agent',
    name: 'Growth & SEO',
    role: 'SEO Architect',
    category: 'marketing',
    icon: '⚡',
    description: 'Handles digital presence, content, and SEO performance auditing.',
    mcpTools: [{
      name: 'get_seo_report',
      description: 'Fetches lighthouse and SEO performance scores for the production site.',
      provider: 'seo_perf',
      parameters: {
        type: Type.OBJECT,
        properties: { domain: { type: Type.STRING, description: 'Target domain' } },
        required: ['domain']
      }
    }],
    systemPrompt: 'Optimize for organic growth. Monitor SEO performance.'
  },
  { id: 'lifecycle-agent', name: 'Lifecycle Agent', role: 'CRM Automation Lead', category: 'marketing', icon: '📧', description: 'Manages email and CRM automation flows.', mcpTools: [], systemPrompt: 'Design user lifecycle and retention automation.' },
  { id: 'content-agent', name: 'Content Agent', role: 'Community Lead', category: 'marketing', icon: '✍️', description: 'Generates content and manages community engagement.', mcpTools: [], systemPrompt: 'Write engaging copy and manage social interactions.' },

  // --- CUSTOMER OPERATIONS ---
  { id: 'support-agent', name: 'Support Agent', role: 'Customer Success', category: 'customer', icon: '🎧', description: 'Provides customer support and triage.', mcpTools: [], systemPrompt: 'Help users solve problems and improve satisfaction.' },
  { id: 'knowledge-agent', name: 'Knowledge Agent', role: 'Help Content Lead', category: 'customer', icon: '📚', description: 'Maintains the help center and documentation.', mcpTools: [], systemPrompt: 'Keep technical and user documentation up to date.' },
  { id: 'escalation-agent', name: 'Escalation Agent', role: 'Triage Lead', category: 'customer', icon: '🚩', description: 'Handles critical customer escalations and triage.', mcpTools: [], systemPrompt: 'Prioritize and resolve high-severity user issues.' },

  // --- FINANCE & LEGAL ---
  { id: 'finance-agent', name: 'Finance Agent', role: 'Cost Lead', category: 'finance', icon: '⚖️', description: 'Handles cost management and financial reporting.', mcpTools: [], systemPrompt: 'Optimize spend and manage budgets.' },
  { id: 'legal-agent', name: 'Legal Agent', role: 'Policy Lead', category: 'finance', icon: '📑', description: 'Manages legal compliance and policy reviews.', mcpTools: [], systemPrompt: 'Review contracts and ensure regulatory compliance.' },
  { id: 'privacy-agent', name: 'Data Protection Agent', role: 'Compliance Lead', category: 'finance', icon: '🛡️', description: 'Ensures data protection and GDPR compliance.', mcpTools: [], systemPrompt: 'Maintain data privacy and compliance standards.' },

  // --- PLATFORM OPERATIONS ---
  { id: 'infra-agent', name: 'Infrastructure Agent', role: 'Cost Optimizer', category: 'platform', icon: '☁️', description: 'Optimizes cloud infrastructure and cloud spend.', mcpTools: [], systemPrompt: 'Manage cloud resources and optimize infrastructure.' },
  { id: 'vendor-agent', name: 'Vendor Agent', role: 'Integration Lead', category: 'platform', icon: '🤝', description: 'Manages third-party vendor integrations.', mcpTools: [], systemPrompt: 'Manage vendor relationships and API integrations.' },

  {
    id: 'human-owner',
    name: 'Human Owner',
    role: 'Final Accountability',
    category: 'accountability',
    icon: '👑',
    description: 'Final sign-off and strategic accountability (Non-automatable).',
    mcpTools: [],
    systemPrompt: 'The ultimate authority. Review all autonomous outputs.'
  }
];

export const AGENTS: Agent[] = ALL_AGENTS;
