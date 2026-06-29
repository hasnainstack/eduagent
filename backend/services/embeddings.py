"""sentence-transformers embedding service.

Uses the all-MiniLM-L6-v2 model to produce 384-dimensional vectors.
The model is loaded once at import time and reused.
"""

from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _load_model() -> SentenceTransformer:
    """Load the embedding model (cached after first call)."""
    return SentenceTransformer(MODEL_NAME)


def get_embedding(text: str) -> list[float]:
    """Generate an embedding vector for a single text string."""
    model = _load_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def get_embeddings_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Generate embeddings for a batch of texts."""
    model = _load_model()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    return [emb.tolist() for emb in embeddings]
