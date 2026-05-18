"""
Knowledge base index builder.

Run this script before starting the app to build the vector index
from DepEd SLM PDF files placed in knowledge_base/slm_pdfs/.

Usage:
    python knowledge_base/build_index.py
"""

import os

PDF_DIR = os.path.join(os.path.dirname(__file__), "slm_pdfs")


def build_index():
    """
    Placeholder: Build a vector index from SLM PDFs.
    Implementation will use an embedding model and vector store
    in a later session.
    """
    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")] if os.path.exists(PDF_DIR) else []
    if not pdf_files:
        print(f"No PDF files found in {PDF_DIR}")
        print("Place DepEd SLM PDFs in this directory and re-run.")
        return

    print(f"Found {len(pdf_files)} PDF(s):")
    for f in pdf_files:
        print(f"  - {f}")

    # TODO: Implement PDF chunking, embedding, and index storage
    print("\nIndex building is not yet implemented. Coming in a later session.")


if __name__ == "__main__":
    build_index()
