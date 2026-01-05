import json
import asyncio
from typing import Callable, Dict, Any, Optional
from utils.logging import get_logger

logger = get_logger(__name__)


class ToolErrorHandler:
    """Sistema centralizado de error handling para tools"""
    
    ERROR_TYPES = {
        "validation_error": {
            "message_template": "Dados inválidos fornecidos: {error}",
            "suggestion": "Verifique os parâmetros e tente novamente",
        },
        "business_rule": {
            "message_template": "Regra de negócio violada: {error}",
            "suggestion": "Ação não permitida neste contexto. Verifique as regras e tente novamente",
        },
        "system_error": {
            "message_template": "Erro interno do sistema: {error}",
            "suggestion": "Tente novamente ou solicite ajuda humana",
        },
    }
    
    @staticmethod
    def format_error(error_type: str, error_message: str, suggestion: Optional[str] = None) -> dict:
        """
        Formata erro no padrão padronizado
        
        Args:
            error_type: Tipo do erro (validation_error | business_rule | system_error)
            error_message: Mensagem de erro
            suggestion: Sugestão opcional (usa padrão se não fornecido)
        
        Returns:
            Dict com error_type, message, suggestion
        """
        error_config = ToolErrorHandler.ERROR_TYPES.get(
            error_type,
            ToolErrorHandler.ERROR_TYPES["system_error"]
        )
        
        message = error_config["message_template"].format(error=error_message)
        suggestion_text = suggestion or error_config["suggestion"]
        
        return {
            "error_type": error_type,
            "message": message,
            "suggestion": suggestion_text,
        }
    
    @staticmethod
    async def execute_with_error_handling(
        tool_name: str,
        tool_func: Callable,
        args: dict,
        context: dict,
        max_retries: int = 2,
        retry_delay: float = 1.0,
    ) -> str:
        """
        Executa tool com error handling robusto e retry logic
        
        Args:
            tool_name: Nome da tool
            tool_func: Função da tool a ser executada
            args: Argumentos para a tool
            context: Contexto explícito (empresa_id, conversation_id, client_id)
            max_retries: Número máximo de tentativas
            retry_delay: Delay entre tentativas (segundos)
        
        Returns:
            JSON string com resultado ou erro formatado
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                # Executar tool
                if asyncio.iscoroutinefunction(tool_func):
                    result = await tool_func(args, context)
                else:
                    result = tool_func(args, context)
                
                # Validar resposta
                if isinstance(result, dict):
                    # Se resultado contém erro, formatar como erro
                    if "error" in result:
                        error_result = ToolErrorHandler.format_error(
                            "system_error",
                            result.get("error", "Erro desconhecido"),
                        )
                        return json.dumps(error_result, ensure_ascii=False)
                    
                    # Se resultado contém error_type, já está formatado
                    if "error_type" in result:
                        return json.dumps(result, ensure_ascii=False)
                
                # Retornar resultado como JSON
                return json.dumps(result, ensure_ascii=False, default=str)
                
            except ValueError as e:
                # Erro de validação
                error_result = ToolErrorHandler.format_error(
                    "validation_error",
                    str(e),
                )
                logger.warning(f"Validation error in {tool_name}: {e}")
                return json.dumps(error_result, ensure_ascii=False)
                
            except KeyError as e:
                # Erro de regra de negócio (ex: feature não habilitada)
                error_result = ToolErrorHandler.format_error(
                    "business_rule",
                    f"Recurso não disponível: {str(e)}",
                )
                logger.warning(f"Business rule error in {tool_name}: {e}")
                return json.dumps(error_result, ensure_ascii=False)
                
            except Exception as e:
                last_error = e
                logger.error(f"Error executing {tool_name} (attempt {attempt + 1}/{max_retries + 1}): {e}", exc_info=True)
                
                # Se não é última tentativa, aguardar e tentar novamente
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * (attempt + 1))  # Backoff exponencial
                    continue
        
        # Todas as tentativas falharam
        error_result = ToolErrorHandler.format_error(
            "system_error",
            str(last_error) if last_error else "Erro desconhecido",
            "Tente novamente ou solicite ajuda humana",
        )
        return json.dumps(error_result, ensure_ascii=False)
    
    @staticmethod
    def classify_error(exception: Exception) -> str:
        """
        Classifica tipo de erro baseado na exceção
        
        Returns:
            Tipo de erro (validation_error | business_rule | system_error)
        """
        if isinstance(exception, ValueError):
            return "validation_error"
        elif isinstance(exception, KeyError) or isinstance(exception, PermissionError):
            return "business_rule"
        else:
            return "system_error"

