export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any, context: ToolContext) => Promise<any>;
  requiredFeatures?: string[];
}

export interface ToolContext {
  empresa_id: string;
  conversation_id: string;
  client_id?: string;
  job_id: string;
  features?: any;
}

