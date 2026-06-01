import os
from typing import List, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI
import chromadb.utils.embedding_functions as ef

load_dotenv()

CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chroma_db")

_ef = None


def _get_ef():
    global _ef
    if _ef is None:
        _ef = ef.OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            api_key_env_var="OPENAI_API_KEY",
            model_name="text-embedding-ada-002",
        )
    return _ef


class RagPipeline:
    def __init__(self):
        self._client = None
        self._llm_client = None

    @property
    def client(self):
        if self._client is None:
            import chromadb
            self._client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        return self._client

    @property
    def llm(self):
        if self._llm_client is None:
            self._llm_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        return self._llm_client

    def _get_collection(self):
        try:
            return self.client.get_collection("leaveflow_policies", embedding_function=_get_ef())
        except Exception:
            return self.client.create_collection("leaveflow_policies", embedding_function=_get_ef())

    def query(self, question: str) -> Dict[str, Any]:
        collection = self._get_collection()
        if collection.count() == 0:
            return {"answer": "Policy knowledge base is empty.", "source_documents": []}

        results = collection.query(query_texts=[question], n_results=4)
        if not results["documents"] or not results["documents"][0]:
            return {"answer": "No relevant policies found.", "source_documents": []}

        context_docs = results["documents"][0]
        context = "\n\n".join(context_docs)

        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"You are a leave policy expert. Answer based on the context below.\n\nContext:\n{context}"},
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
        collection = self._get_collection()
        if ids is None:
            ids = [f"doc_{i}" for i in range(len(texts))]
        if metadatas is None:
            metadatas = [{} for _ in texts]
        collection.add(documents=texts, metadatas=metadatas, ids=ids)
