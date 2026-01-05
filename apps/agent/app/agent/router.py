import os
import json
from openai import AsyncOpenAI
from agent.policy import PolicyEngine
from agent.tools_registry import get_tool_registry
from memory.context_loader import ContextLoader
from utils.logging import get_logger
from utils.error_handler import ToolErrorHandler

logger = get_logger(__name__)

class Router:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.policy_engine = PolicyEngine()
        self.tools_registry = get_tool_registry()
        self.context_loader = ContextLoader()
        self.max_iterations = 5  # Prevenir loops infinitos

    async def process(
        self,
        empresa_id: str,
        conversation_id: str,
        config: dict,
        features: dict,
        st_memory: list,
        summary: str,
        lt_memory: list,
        nest_client,
    ):
        # Construir contexto para o LLM
        system_prompt = self._build_system_prompt(config, features, summary, lt_memory)
        messages = self._build_messages(st_memory, system_prompt)

        # Obter tools habilitadas para a empresa
        tools = self.tools_registry.get_openai_tools(empresa_id, features)

        # Obter max_iterations das features (padrão: 5)
        max_iterations = features.get('max_tool_iterations', self.max_iterations)
        if not isinstance(max_iterations, int) or max_iterations < 1:
            max_iterations = self.max_iterations

        # Loop de tool calling robusto
        for iteration in range(max_iterations):
            try:
                # Chamar LLM com tool calling
                response = await self.client.chat.completions.create(
                    model="gpt-4-turbo-preview",
                    messages=messages,
                    tools=tools if tools else None,
                    tool_choice="auto" if tools else None,
                )

                message = response.choices[0].message

                # Se não há tool calls, retornar resposta final
                if not message.tool_calls:
                    return {
                        "content": message.content,
                        "buttons": None,
                    }

                # Executar tools
                for tool_call in message.tool_calls:
                    # Sempre passar contexto explícito
                    client_id = self.context_loader.get_client_id(conversation_id)
                    context = {
                        "empresa_id": empresa_id,
                        "conversation_id": conversation_id,
                        "client_id": client_id,
                    }
                    
                    # Executar tool com error handling
                    result = await self._execute_tool_safely(
                        tool_call,
                        context,
                        features,
                    )
                    
                    # Adicionar resultado ao contexto
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result,
                    })

                # Adicionar mensagem do LLM ao histórico (com tool_calls se houver)
                message_dict = {
                    "role": message.role,
                    "content": message.content or "",
                }
                if message.tool_calls:
                    message_dict["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": tc.type,
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in message.tool_calls
                    ]
                messages.append(message_dict)

            except Exception as e:
                logger.error(f"Error in tool calling loop (iteration {iteration + 1}): {e}", exc_info=True)
                # Se erro crítico, retornar mensagem de erro
                if iteration == max_iterations - 1:
                    return {
                        "content": "Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente ou solicite ajuda humana.",
                        "buttons": None,
                    }
                continue

        # Se chegou aqui, excedeu max_iterations
        logger.warning(f"Max iterations reached for conversation {conversation_id}")
        return {
            "content": "Desculpe, não consegui processar sua solicitação completamente. Por favor, reformule sua pergunta ou solicite ajuda humana.",
            "buttons": None,
        }

    def _build_system_prompt(self, config: dict, features: dict, summary: str, lt_memory: list):
        prompt = f"""Você é um assistente de IA para um salão de beleza. 

Tom de voz: {config.get('tone', 'Amigável e profissional')}
Regras do salão: {config.get('rules', '')}

Features habilitadas:
- ask_for_pix: {features.get('ask_for_pix', False)}
- require_deposit: {features.get('require_deposit', False)}

Resumo da conversa: {summary or 'Nenhum'}

Memória de longo prazo:
{self._format_lt_memory(lt_memory)}

IMPORTANTE: Se ask_for_pix estiver False, NUNCA chame create_payment_link. Apenas confirme o agendamento sem cobrança.
"""
        return prompt

    def _format_lt_memory(self, lt_memory: list):
        if not lt_memory:
            return "Nenhuma memória relevante encontrada."
        return "\n".join([f"- {item['content']}" for item in lt_memory])

    def _build_messages(self, st_memory: list, system_prompt: str):
        messages = [{"role": "system", "content": system_prompt}]
        for msg in st_memory:
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })
        return messages

    async def _execute_tool_safely(
        self,
        tool_call,
        context: dict,
        features: dict,
    ) -> str:
        """
        Executa tool com error handling robusto
        
        Args:
            tool_call: Tool call do OpenAI
            context: Contexto explícito (empresa_id, conversation_id, client_id)
            features: Features habilitadas
        
        Returns:
            JSON string com resultado ou erro formatado
        """
        tool_name = tool_call.function.name
        
        try:
            # Parse arguments
            args = json.loads(tool_call.function.arguments)
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing tool arguments for {tool_name}: {e}")
            error_result = {
                "error_type": "validation_error",
                "message": f"Argumentos inválidos: {str(e)}",
                "suggestion": "Verifique os parâmetros fornecidos",
            }
            return json.dumps(error_result, ensure_ascii=False)
        
        # Executar tool via registry
        result = await self.tools_registry.execute_tool(
            name=tool_name,
            args=args,
            context=context,
            features=features,
        )
        
        logger.info(f"Executed tool {tool_name} for empresa {context['empresa_id']}")
        return result

