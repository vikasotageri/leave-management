"""
================================================================================
 LEAVE FLOW — Retrieval-Augmented Generation (RAG) Pipeline
================================================================================

 PURPOSE:
  Implements RAG for answering leave policy questions using the company's
  policy documents stored in ChromaDB. When a user asks about leave policy,
  relevant chunks are retrieved and provided as context to the LLM.

 CALLED BY:
  - ai/agents/tools.py (line 869): get_policy_answer tool
      → Called when LangGraph agent determines user needs policy info
      → Returns {"answer": "...", "source_documents": [...]}

 WHERE IT FITS (AI FLOW):
  User asks "What is the sick leave policy?"
    → LangGraph supervisor classifies as "Policy Agent"
    → Policy Agent calls get_policy_answer tool
      → RagPipeline.query(question) ← THIS FILE
        → ChromaDB similarity search
        → LLM generates answer from retrieved context
    → Returns answer to user

 DESIGN:
  - Uses ChromaDB (PersistentClient) for vector storage
  - OpenAI text-embedding-ada-002 for embedding generation
  - GPT-4o-mini for answer generation
  - Returns top 4 most relevant document chunks
================================================================================
"""

import os
from typing import List, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI
import chromadb.utils.embedding_functions as ef

load_dotenv()

# ChromaDB persistence directory (ai/chroma_db/)
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chroma_db")

_ef = None


def _get_ef():
    """
    Get or create the OpenAI embedding function singleton.
    Used by ChromaDB to vectorize text queries for similarity search.
    """
    global _ef
    if _ef is None:
        _ef = ef.OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            api_key_env_var="OPENAI_API_KEY",
            model_name="text-embedding-ada-002",
        )
    return _ef


class RagPipeline:
    """
    RAG pipeline that retrieves policy documents from ChromaDB
    and generates answers using GPT-4o-mini.

    Usage:
        rag = RagPipeline()
        result = rag.query("What is the sick leave policy?")
        print(result["answer"])
    """

    def __init__(self):
        self._client = None
        self._llm_client = None

    @property
    def client(self):
        """Lazy-initialized ChromaDB PersistentClient."""
        if self._client is None:
            import chromadb
            self._client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        return self._client

    @property
    def llm(self):
        """Lazy-initialized OpenAI client."""
        if self._llm_client is None:
            self._llm_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        return self._llm_client

    def _get_collection(self):
        """
        Get or create the "leaveflow_policies" collection in ChromaDB.
        Created during seed_policy_vector_store() in vector_store.py.
        """
        try:
            return self.client.get_collection("leaveflow_policies", embedding_function=_get_ef())
        except Exception:
            return self.client.create_collection("leaveflow_policies", embedding_function=_get_ef())

    def query(self, question: str) -> Dict[str, Any]:
        """
        Main query method. Retrieves relevant policy docs and generates answer.

        FLOW:
          1. Get the ChromaDB collection
          2. Check if collection has documents (return empty if not)
          3. Query ChromaDB for top 4 similar documents
          4. Build context from retrieved documents
          5. Send context + question to GPT-4o-mini
          6. Return structured response with answer and source documents

        Args:
            question: User's policy question (e.g., "Can I carry forward casual leave?")

        Returns:
            dict with keys:
              - answer: Generated answer text
              - source_documents: List of relevant policy chunks
        """
        collection = self._get_collection()
        if collection.count() == 0:
            return {"answer": "Policy knowledge base is empty.", "source_documents": []}

        # Retrieve top 4 most similar documents
        results = collection.query(query_texts=[question], n_results=4)
        if not results["documents"] or not results["documents"][0]:
            return {"answer": "No relevant policies found.", "source_documents": []}

        context_docs = results["documents"][0]
        context = "\n\n".join(context_docs)

        # Generate answer using GPT-4o-mini with retrieved context
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a leave policy expert. Answer based on the context below.\n\n"
                        f"Context:\n{context}"
                    )
                },
                {"role": "user", "content": question},
            ],
            max_tokens=500,
            temperature=0.1,
        )

        return {
            "answer": response.choices[0].message.content or "I couldn't find an answer.",
            "source_documents": [{"content": d, "metadata": {}} for d in context_docs],
        }

    def add_documents(self, texts: List[str], metadatas: List[Dict] = None, ids: List[str] = None):
        """
        Add policy documents to the ChromaDB collection.
        Called during seeding and when HR updates policies.

        Args:
            texts: List of policy document text chunks
            metadatas: Optional metadata for each chunk
            ids: Optional custom IDs for each chunk
        """
        collection = self._get_collection()
        if ids is None:
            ids = [f"doc_{i}" for i in range(len(texts))]
        if metadatas is None:
            metadatas = [{} for _ in texts]
        collection.add(documents=texts, metadatas=metadatas, ids=ids)
