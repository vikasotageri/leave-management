import os
from typing import List, Dict, Any
from dotenv import load_dotenv
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


class VectorStore:
    def __init__(self, collection_name: str = "leaveflow_policies"):
        self.collection_name = collection_name
        self._client = None
        self._collection = None

    @property
    def client(self):
        if self._client is None:
            import chromadb
            self._client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            try:
                self._collection = self.client.get_collection(self.collection_name, embedding_function=_get_ef())
            except Exception:
                self._collection = self.client.create_collection(self.collection_name, embedding_function=_get_ef())
        return self._collection

    def add_documents(self, documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]):
        if not documents:
            return
        existing = set(self.collection.get()["ids"]) if self.collection.count() > 0 else set()
        new_ids = []
        new_docs = []
        new_meta = []
        for i, doc_id in enumerate(ids):
            if doc_id not in existing:
                new_ids.append(doc_id)
                new_docs.append(documents[i])
                new_meta.append(metadatas[i] if i < len(metadatas) else {})
        if new_ids:
            self.collection.add(documents=new_docs, metadatas=new_meta, ids=new_ids)

    def search(self, query: str, n_results: int = 5, filter_dict: Dict = None) -> List[Dict]:
        kwargs = {"query_texts": [query], "n_results": n_results}
        if filter_dict:
            kwargs["where"] = filter_dict
        results = self.collection.query(**kwargs)
        if not results["ids"]:
            return []
        return [
            {
                "id": results["ids"][0][i],
                "document": results["documents"][0][i],
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else 0,
            }
            for i in range(len(results["ids"][0]))
        ]

    def count(self) -> int:
        return self.collection.count()

    def delete_collection(self):
        try:
            self.client.delete_collection(self.collection_name)
            self._collection = None
        except Exception:
            pass


def seed_policy_vector_store():
    store = VectorStore()
    if store.count() > 0:
        return store

    policies = [
        ("leave_policy_1", "Employees accrue 2 days of leave per month, maximum 24 days per year. Unused leave carries forward up to 12 days.", {"type": "policy", "category": "accrual"}),
        ("leave_policy_2", "Sick leave maximum is 2 days per month. Casual leave maximum is 1 day per month.", {"type": "policy", "category": "limits"}),
        ("leave_policy_3", "Business leave maximum is 10 days per month and always requires manager approval.", {"type": "policy", "category": "business"}),
        ("leave_policy_4", "Emergency leave maximum is 4 days per month and 15 days per year.", {"type": "policy", "category": "emergency"}),
        ("leave_policy_5", "Auto-approval applies when: within limits, not project-tagged, no team conflict, and sick+casual combined under 3 per month.", {"type": "policy", "category": "auto_approval"}),
        ("leave_policy_6", "Cancellation window is 70 days. Pending leaves auto-cancel, approved leaves need manager approval to cancel.", {"type": "policy", "category": "cancellation"}),
        ("leave_policy_7", "Advance booking allowed up to 2 months in advance.", {"type": "policy", "category": "advance_booking"}),
        ("leave_policy_8", "Project-tagged employees cannot auto-approve leaves. All their leaves require manager approval regardless of type.", {"type": "policy", "category": "project_tag"}),
        ("leave_policy_9", "Employees with team conflicts must get manager approval. Team conflict means another employee on same project has leave on same date.", {"type": "policy", "category": "conflict"}),
        ("leave_policy_10", "Unpaid leave has no limit and always requires manager approval. No balance is needed for unpaid leave.", {"type": "policy", "category": "unpaid"}),
    ]
    store.add_documents(
        documents=[p[1] for p in policies],
        metadatas=[p[2] for p in policies],
        ids=[p[0] for p in policies],
    )
    return store
