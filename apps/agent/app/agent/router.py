import os
import json
from openai import AsyncOpenAI
from agent.policy import PolicyEngine
from utils.logging import get_logger

logger = get_logger(__name__)

class Router:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.policy_engine = PolicyEngine()

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

        # Tool definitions para o agente
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_available_slots",
                    "description": "Buscar horários disponíveis para agendamento",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "service_id": {"type": "string"},
                            "start_date": {"type": "string"},
                            "end_date": {"type": "string"},
                        },
                        "required": ["start_date", "end_date"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "create_appointment",
                    "description": "Criar um agendamento",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "client_id": {"type": "string"},
                            "service_id": {"type": "string"},
                            "start_time": {"type": "string"},
                            "end_time": {"type": "string"},
                        },
                        "required": ["client_id", "service_id", "start_time", "end_time"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "create_payment_link",
                    "description": "Criar link de pagamento Pix (só se ask_for_pix estiver habilitado)",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "appointment_id": {"type": "string"},
                            "amount": {"type": "number"},
                        },
                        "required": ["appointment_id", "amount"],
                    },
                },
            },
        ]

        # Chamar LLM com tool calling
        response = await self.client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )

        message = response.choices[0].message

        # Processar tool calls
        if message.tool_calls:
            for tool_call in message.tool_calls:
                result = await self._execute_tool(
                    tool_call.function.name,
                    json.loads(tool_call.function.arguments),
                    empresa_id,
                    conversation_id,
                    nest_client,
                    features,
                )
                # Adicionar resultado ao contexto e continuar
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(result),
                })

            # Segunda chamada para obter resposta final
            response = await self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=messages,
            )
            message = response.choices[0].message

        return {
            "content": message.content,
            "buttons": None,  # Pode ser implementado depois
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

    async def _execute_tool(
        self,
        tool_name: str,
        args: dict,
        empresa_id: str,
        conversation_id: str,
        nest_client,
        features: dict,
    ):
        if tool_name == "get_available_slots":
            return await nest_client.get_available_slots({
                "empresa_id": empresa_id,
                **args,
            })

        elif tool_name == "create_appointment":
            result = await nest_client.create_appointment({
                "empresa_id": empresa_id,
                **args,
            })
            # Se ask_for_pix estiver ON, criar link de pagamento
            if features.get("ask_for_pix") and result.get("appointment_id"):
                payment_link = await nest_client.create_payment_link({
                    "empresa_id": empresa_id,
                    "appointment_id": result["appointment_id"],
                    "amount": args.get("amount", 0),
                })
                result["payment_link"] = payment_link
            return result

        elif tool_name == "create_payment_link":
            # Verificar se ask_for_pix está habilitado
            if not features.get("ask_for_pix"):
                return {"error": "ask_for_pix está desabilitado"}
            return await nest_client.create_payment_link({
                "empresa_id": empresa_id,
                **args,
            })

        return {"error": f"Unknown tool: {tool_name}"}

