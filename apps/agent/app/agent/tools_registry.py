import json
from typing import Dict, List, Callable, Any, Optional
from app.utils.logging import get_logger

logger = get_logger(__name__)


class ToolDefinition:
    """Definição de uma tool com metadados"""
    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict,
        executor: Callable,
        required_features: Optional[List[str]] = None,
        validator: Optional[Callable] = None,
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.executor = executor
        self.required_features = required_features or []
        self.validator = validator


class ToolRegistry:
    """Registro centralizado de tools para o agente"""
    
    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}
        self._validators: Dict[str, Callable] = {}
    
    def register_tool(self, tool_def: ToolDefinition):
        """Registra uma tool no registry"""
        self._tools[tool_def.name] = tool_def
        if tool_def.validator:
            self._validators[tool_def.name] = tool_def.validator
        logger.info(f"Tool registered: {tool_def.name}")
    
    def get_openai_tools(self, empresa_id: str, features: dict) -> List[dict]:
        """
        Retorna lista de tools no formato OpenAI Function Calling
        Filtra por features habilitadas para a empresa
        """
        tools = []
        
        for tool_name, tool_def in self._tools.items():
            # Verificar se todas as features requeridas estão habilitadas
            if self._is_tool_available(tool_def, features):
                tools.append({
                    "type": "function",
                    "function": {
                        "name": tool_def.name,
                        "description": tool_def.description,
                        "parameters": tool_def.parameters,
                    },
                })
        
        logger.debug(f"Returning {len(tools)} enabled tools for empresa {empresa_id}")
        return tools
    
    def _is_tool_available(self, tool_def: ToolDefinition, features: dict) -> bool:
        """Verifica se tool está disponível baseado nas features"""
        for required_feature in tool_def.required_features:
            if not features.get(required_feature, False):
                return False
        return True
    
    async def execute_tool(
        self,
        name: str,
        args: dict,
        context: dict,
        features: dict,
    ) -> str:
        """
        Executa uma tool com validação e error handling
        
        Args:
            name: Nome da tool
            args: Argumentos da tool (do LLM)
            context: Contexto explícito (empresa_id, conversation_id, client_id)
            features: Features habilitadas para a empresa
        
        Returns:
            JSON string com resultado ou erro formatado
        """
        if name not in self._tools:
            error_result = {
                "error_type": "system_error",
                "message": f"Tool '{name}' não encontrada",
                "suggestion": "Verifique o nome da tool e tente novamente",
            }
            return json.dumps(error_result, ensure_ascii=False)
        
        tool_def = self._tools[name]
        
        # Verificar disponibilidade
        if not self._is_tool_available(tool_def, features):
            error_result = {
                "error_type": "business_rule",
                "message": f"Tool '{name}' não está habilitada para esta empresa",
                "suggestion": "Esta funcionalidade não está disponível no momento",
            }
            return json.dumps(error_result, ensure_ascii=False)
        
        # Validar parâmetros se validator existir
        if name in self._validators:
            try:
                validator = self._validators[name]
                validated_args = validator(**args)
                args = validated_args.dict() if hasattr(validated_args, 'dict') else validated_args
            except Exception as e:
                error_result = {
                    "error_type": "validation_error",
                    "message": f"Parâmetros inválidos: {str(e)}",
                    "suggestion": "Verifique os parâmetros fornecidos e tente novamente",
                }
                return json.dumps(error_result, ensure_ascii=False)
        
        # Executar tool com contexto explícito
        try:
            # Sempre passar contexto explícito, mesmo que a tool não use agora
            result = await tool_def.executor(args, context)
            
            # Validar resposta
            if isinstance(result, dict) and "error" in result:
                error_result = {
                    "error_type": "system_error",
                    "message": result.get("error", "Erro desconhecido"),
                    "suggestion": "Tente novamente ou solicite ajuda humana",
                }
                return json.dumps(error_result, ensure_ascii=False)
            
            # Retornar resultado como JSON string
            return json.dumps(result, ensure_ascii=False, default=str)
            
        except Exception as e:
            logger.error(f"Error executing tool {name}: {e}", exc_info=True)
            error_result = {
                "error_type": "system_error",
                "message": f"Erro ao executar tool: {str(e)}",
                "suggestion": "Tente novamente ou solicite ajuda humana",
            }
            return json.dumps(error_result, ensure_ascii=False)
    
    def list_tools(self) -> List[str]:
        """Lista todas as tools registradas"""
        return list(self._tools.keys())


# Instância global do registry
_registry = None


def get_tool_registry() -> ToolRegistry:
    """Retorna instância singleton do registry"""
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry

