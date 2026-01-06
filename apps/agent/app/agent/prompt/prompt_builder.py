from typing import List, Dict, Optional
import json


class PromptBuilder:
    """
    Responsável por montar o prompt final para o LLM.

    REGRA:
    - NÃO cria mensagens
    - NÃO duplica mensagens
    - Apenas organiza o que já existe
    """

    def __init__(self, system_persona: str = "Você é um assistente útil e amigável."):
        self.default_system_persona = system_persona

    def build(
        self,
        st_messages: List[Dict],
        summary: Optional[str],
        preferences: Dict,
        tools_schema: Optional[List[Dict]] = None,
    ) -> List[Dict]:

        messages: List[Dict] = []

        # 1. System prompt
        system_content = self._construct_system_prompt(summary, preferences)
        messages.append({"role": "system", "content": system_content})

        # 2. Histórico recente (curto prazo)
        valid_roles = {"user", "assistant", "function", "tool"}

        for msg in st_messages:
            if msg.get("role") in valid_roles and msg.get("content"):
                messages.append(
                    {
                        "role": msg["role"],
                        "content": msg["content"],
                    }
                )

        return messages

    def _construct_system_prompt(
        self,
        summary: Optional[str],
        preferences: Dict,
    ) -> str:

        parts = [self.default_system_persona]

        if summary:
            parts.append(f"\nCONTEXTO ANTERIOR (Resumo):\n{summary}")

        if preferences:
            parts.append(
                f"\nPREFERÊNCIAS DO USUÁRIO:\n{json.dumps(preferences, ensure_ascii=False, indent=2)}"
            )

        parts.append("\nDIRETRIZES:")
        parts.append("- Use o contexto fornecido para personalizar a resposta.")
        parts.append("- Seja direto e conciso.")
        parts.append("- Se precisar de informações extras, pergunte.")

        return "\n".join(parts)
