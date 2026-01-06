import os
from typing import List, Dict, Any, Optional

import openai

from app.utils.logging import get_logger
from app.agent.llm.schemas import AgentLLMResponse

logger = get_logger(__name__)


class LLMClient:
    """
    Cliente abstraído para interações com LLM (OpenAI).
    Trata configuração, retries (básicos) e tratamento de erros.
    """

    def __init__(
        self,
        model: str = "gpt-4-turbo-preview",
        temperature: float = 0
    ):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("OPENAI_API_KEY não encontrada. LLMClient pode falhar.")

        self.client = openai.AsyncOpenAI(api_key=self.api_key)
        self.model = model
        self.temperature = temperature

    async def generate_response(
        self,
        messages: List[Dict],
        tools: Optional[List[Dict]] = None,
        tool_choice: Any = "auto"
    ) -> AgentLLMResponse:
        """
        Gera uma resposta do modelo.
        """
        try:
            kwargs = {}
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = tool_choice

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                **kwargs
            )

            message = response.choices[0].message

            return AgentLLMResponse(
                content=message.content,
                tool_calls=message.tool_calls if message.tool_calls else None,
                usage=response.usage.model_dump() if response.usage else None
            )

        except openai.APIConnectionError:
            logger.error("Falha de conexão com OpenAI", exc_info=True)
            raise

        except openai.RateLimitError:
            logger.error("Rate limit da OpenAI atingido", exc_info=True)
            raise

        except openai.APIError as e:
            logger.error(f"Erro na API da OpenAI: {e}", exc_info=True)
            raise

        except Exception as e:
            logger.error(f"Erro inesperado no LLMClient: {e}", exc_info=True)
            raise
