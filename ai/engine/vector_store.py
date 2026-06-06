"""
================================================================================
 LEAVE FLOW — ChromaDB Vector Store Setup & Policy Seeding
================================================================================

 PURPOSE:
  Creates and seeds the ChromaDB vector store with company leave policy
  documents. This enables RAG-based policy Q&A through the AI chatbot.

 CALLED BY:
  - backend/main.py (line 26): seed_policy_vector_store()
      → Called once at app startup to ensure policies are in the vector DB

 WHERE IT FITS (AI FLOW):
  Server starts → main.py → seed_policy_vector_store()
    → Creates "leaveflow_policies" ChromaDB collection
    → Inserts all defined policy documents as vector embeddings
    → Later, when user asks policy questions:
      RagPipeline.query() retrieves from this collection

 POLICY DOCUMENTS STORED:
  Casual Leave, Sick Leave, Business Leave, Emergency Leave,
  Family Leave, Unpaid Leave, General Rules, Project Tags,
  Cancellation Policy, Approval Workflow

 DESIGN:
  - Uses ChromaDB PersistentClient for on-disk storage
  - OpenAI text-embedding-ada-002 generates embeddings
  - Idempotent: checks if collection already has documents before seeding
  - Storage location: ai/chroma_db/ (mounted from backend/ai_engine/)
================================================================================
"""

import os
from typing import List, Dict, Any
from dotenv import load_dotenv
import chromadb.utils.embedding_functions as ef

load_dotenv()

CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chroma_db")

_ef = None


def _get_ef():
    """
    Get or create the OpenAI embedding function singleton.
    See rag.py for details — same function used by both modules.
    """
    global _ef
    if _ef is None:
        _ef = ef.OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            api_key_env_var="OPENAI_API_KEY",
            model_name="text-embedding-ada-002",
        )
    return _ef


def get_policy_documents() -> List[Dict[str, Any]]:
    """
    Define the leave policy documents that will be embedded in ChromaDB.
    These form the knowledge base for RAG-based policy Q&A.

    Each document has:
      - id: Unique identifier
      - text: Policy content
      - metadata: {category, type} for filtering

    Returns: List of dicts with 'id', 'text', and 'metadata' keys
    """
    documents = [
        {
            "id": "policy_casual",
            "text": (
                "Casual Leave Policy:\n"
                "• Maximum 24 days per year\n"
                "• Accrues at 2 days per month from date of joining\n"
                "• Can be carried forward to next year\n"
                "• First 2 requests per month are auto-approved (max 2 days at a time)\n"
                "• 3rd+ request or more than 2 days → requires manager approval\n"
                "• Cannot go into negative balance\n"
                "• Tagged employees always require manager approval"
            ),
            "metadata": {"category": "leave_type", "type": "casual"}
        },
        {
            "id": "policy_sick",
            "text": (
                "Sick Leave Policy:\n"
                "• Maximum 12 days per year\n"
                "• No carry forward to next year\n"
                "• First 1 request per month is auto-approved (max 1 day at a time)\n"
                "• 2nd+ request or more than 1 day → requires manager approval\n"
                "• Cannot go into negative balance\n"
                "• Tagged employees always require manager approval"
            ),
            "metadata": {"category": "leave_type", "type": "sick"}
        },
        {
            "id": "policy_business",
            "text": (
                "Business Leave Policy:\n"
                "• Maximum 20 days per year\n"
                "• No carry forward to next year\n"
                "• Always requires manager approval\n"
                "• No auto-approval available\n"
                "• Cannot go into negative balance\n"
                "• Tagged employees always require manager approval"
            ),
            "metadata": {"category": "leave_type", "type": "business"}
        },
        {
            "id": "policy_emergency",
            "text": (
                "Emergency/Personal Leave Policy:\n"
                "• Maximum 10 days per year\n"
                "• No carry forward to next year\n"
                "• First 1 request per month is auto-approved (max 1 day at a time)\n"
                "• 2nd+ request or more than 1 day → requires manager approval\n"
                "• Cannot go into negative balance\n"
                "• Tagged employees always require manager approval"
            ),
            "metadata": {"category": "leave_type", "type": "emergency"}
        },
        {
            "id": "policy_family",
            "text": (
                "Family/Vacation Leave Policy:\n"
                "• Maximum 10 days per year\n"
                "• No carry forward to next year\n"
                "• Always requires manager approval\n"
                "• No auto-approval available\n"
                "• Cannot go into negative balance\n"
                "• Tagged employees always require manager approval"
            ),
            "metadata": {"category": "leave_type", "type": "family"}
        },
        {
            "id": "policy_unpaid",
            "text": (
                "Unpaid Leave Policy:\n"
                "• No limit on number of days\n"
                "• Apply only when all other leave types are exhausted\n"
                "• Always requires manager approval\n"
                "• No balance required to apply"
            ),
            "metadata": {"category": "leave_type", "type": "unpaid"}
        },
        {
            "id": "policy_general",
            "text": (
                "General Leave Rules:\n"
                "• Maximum 2 working days per month (except unpaid leave)\n"
                "• All leave balances reset on the anniversary of date of joining\n"
                "• Employees are notified via email and in-app notification on approvals and rejections\n"
                "• HR can override any leave decision\n"
                "• Leave can be applied for future dates only\n"
                "• Weekly calendar allows selecting multiple days at once"
            ),
            "metadata": {"category": "general", "type": "rules"}
        },
        {
            "id": "policy_tags",
            "text": (
                "Project Tag Policy:\n"
                "• Employees can be tagged to specific projects by HR or Manager\n"
                "• Tagged employees require manager approval for ALL leave types\n"
                "• No auto-approval for tagged employees\n"
                "• Project tags can be added/removed by HR or the employee's manager"
            ),
            "metadata": {"category": "general", "type": "tags"}
        },
        {
            "id": "policy_cancellation",
            "text": (
                "Cancellation Policy:\n"
                "• Approved leaves can be cancelled within 70 days of the leave date\n"
                "• Cancellation requests are reviewed by the manager\n"
                "• Manager can approve or reject the cancellation\n"
                "• If cancelled, leave balance is restored\n"
                "• Pending leaves can be cancelled directly by the employee"
            ),
            "metadata": {"category": "general", "type": "cancellation"}
        },
        {
            "id": "policy_approval",
            "text": (
                "Approval Workflow:\n"
                "• Leave applications go through an approval workflow based on leave type and employee status\n"
                "• Auto-approval: System automatically approves if within policy limits (for non-tagged employees)\n"
                "• Manager approval: Required for business leave, family leave, over-limit requests, and tagged employees\n"
                "• Managers can approve or reject with reason\n"
                "• HR can view all leaves and override decisions if needed"
            ),
            "metadata": {"category": "general", "type": "approval"}
        },
    ]
    return documents


def seed_policy_vector_store():
    """
    Seed policy documents into ChromaDB vector store.
    Called once during application startup.

    FLOW:
      1. Get or create the "leaveflow_policies" collection
      2. Check if collection already has documents (skip if seeded)
      3. If empty, add all policy documents from get_policy_documents()

    NOTE: This is idempotent — policies are only seeded on first run.
    If you update policy documents, clear the ChromaDB directory and restart.
    """
    try:
        import chromadb
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

        try:
            collection = client.get_collection("leaveflow_policies", embedding_function=_get_ef())
        except Exception:
            collection = client.create_collection("leaveflow_policies", embedding_function=_get_ef())

        # Skip seeding if documents already exist
        if collection.count() > 0:
            return

        documents = get_policy_documents()
        collection.add(
            documents=[d["text"] for d in documents],
            metadatas=[d["metadata"] for d in documents],
            ids=[d["id"] for d in documents],
        )
        print(f"✅ Seeded {len(documents)} policy documents into vector store")
    except Exception as e:
        print(f"⚠️ Policy vector store seeding skipped: {e}")
