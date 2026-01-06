"""FastAPI application entry point"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.agent.api.routes import router
from app.utils.logging import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="Agent Service",
    description="Serviço de agente IA para processamento de mensagens",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ajustar em produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(router, prefix="/api", tags=["agent"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {"service": "agent", "status": "running"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

