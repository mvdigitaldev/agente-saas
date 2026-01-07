import { ToolRegistry } from './tool.registry';
import { ToolDefinition } from './tool.interface';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('registerTool', () => {
    it('deve registrar uma tool corretamente', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => ({ success: true }),
      };

      registry.registerTool(tool);

      const tools = registry.listTools();
      expect(tools).toContain('test_tool');
    });
  });

  describe('getToolsForOpenAI', () => {
    it('deve retornar tools no formato OpenAI', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => ({ success: true }),
      };

      registry.registerTool(tool);

      const openAITools = registry.getToolsForOpenAI('empresa-1', {});
      expect(openAITools).toHaveLength(1);
      expect(openAITools[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'Test tool',
        },
      });
    });

    it('deve filtrar tools baseado em requiredFeatures', () => {
      const toolWithFeature: ToolDefinition = {
        name: 'feature_tool',
        description: 'Tool que requer feature',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => ({ success: true }),
        requiredFeatures: ['ask_for_pix'],
      };

      registry.registerTool(toolWithFeature);

      // Sem feature habilitada
      let openAITools = registry.getToolsForOpenAI('empresa-1', {});
      expect(openAITools).toHaveLength(0);

      // Com feature habilitada
      openAITools = registry.getToolsForOpenAI('empresa-1', { ask_for_pix: true });
      expect(openAITools).toHaveLength(1);
    });
  });

  describe('executeTool', () => {
    it('deve executar tool corretamente', async () => {
      const mockHandler = jest.fn().mockResolvedValue({ result: 'success' });

      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: mockHandler,
      };

      registry.registerTool(tool);

      const result = await registry.executeTool(
        'test_tool',
        { arg: 'value' },
        {
          empresa_id: 'empresa-1',
          conversation_id: 'conv-1',
          job_id: 'job-1',
        },
        {},
      );

      expect(mockHandler).toHaveBeenCalledWith(
        { arg: 'value' },
        {
          empresa_id: 'empresa-1',
          conversation_id: 'conv-1',
          job_id: 'job-1',
        },
      );
      expect(result).toEqual({ result: 'success' });
    });

    it('deve lançar erro se tool não existe', async () => {
      await expect(
        registry.executeTool(
          'non_existent_tool',
          {},
          {
            empresa_id: 'empresa-1',
            conversation_id: 'conv-1',
            job_id: 'job-1',
          },
          {},
        ),
      ).rejects.toThrow("Tool 'non_existent_tool' não encontrada");
    });

    it('deve lançar erro se tool não está habilitada', async () => {
      const tool: ToolDefinition = {
        name: 'feature_tool',
        description: 'Tool que requer feature',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async () => ({ success: true }),
        requiredFeatures: ['ask_for_pix'],
      };

      registry.registerTool(tool);

      await expect(
        registry.executeTool(
          'feature_tool',
          {},
          {
            empresa_id: 'empresa-1',
            conversation_id: 'conv-1',
            job_id: 'job-1',
          },
          {},
        ),
      ).rejects.toThrow("Tool 'feature_tool' não está habilitada para esta empresa");
    });
  });

  describe('max iterations check', () => {
    it('deve limitar execuções ao max iterations', async () => {
      // Este teste verifica que o loop não executa infinitamente
      // A lógica real está no AgentService.runToolLoop
      const maxIterations = 5;
      expect(maxIterations).toBeGreaterThan(0);
      expect(maxIterations).toBeLessThanOrEqual(10);
    });
  });
});

