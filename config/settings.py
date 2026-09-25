import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # Neo4j Database
    neo4j_uri: str = Field(default="bolt://localhost:7687", alias="NEO4J_URI")
    neo4j_user: str = Field(default="neo4j", alias="NEO4J_USER")
    neo4j_password: str = Field(default="graphragpassword", alias="NEO4J_PASSWORD")

    # Ollama Local Service
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    llm_model: str = Field(default="llama3.1:8b", alias="LLM_MODEL")
    embedding_model: str = Field(default="nomic-embed-text", alias="EMBEDDING_MODEL")

    # Optional OpenAI
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")

    # Ingestion & Chunking
    chunk_size: int = 600
    chunk_overlap: int = 100

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
