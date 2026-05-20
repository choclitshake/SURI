"""
Knowledge base index builder for SURI.

Scans knowledge_base/slm_pdfs/ for DepEd SLM PDFs, chunks them,
assigns each chunk to competency node(s) via an explicit filename-to-node map,
embeds with sentence-transformers, and stores in ChromaDB.

Usage:
    python knowledge_base/build_index.py
"""

import os
import re
import sys
import time

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.join(SCRIPT_DIR, "slm_pdfs")
CHROMA_DIR = os.path.join(SCRIPT_DIR, "chroma_db")

COLLECTION_MAIN = "suri_slm"

# ---------------------------------------------------------------------------
# Explicit filename → node map
# ---------------------------------------------------------------------------
NODE_PDF_MAP = {
    "FD": [
        "grade6_fractions_addition_subtraction.pdf",
        "grade6_fractions_multiplication.pdf",
        "grade6_fractions_division.pdf",
        "grade6_decimals_operations.pdf",
    ],
    "RPP": [
        "grade6_ratio_proportion.pdf",
        "grade6_percent.pdf",
        "grade6_rate_speed_distance.pdf",
    ],
    "OI": [
        "grade7_operations_integers.pdf",
        "grade7_absolute_value_integers.pdf",
    ],
    "AE": [
        "grade7_algebraic_expressions.pdf",
        "grade7_evaluating_expressions.pdf",
    ],
    "L1V": [
        "grade7_linear_equations_one_var.pdf",
        "grade7_solving_equations.pdf",
    ],
    "LE": [
        "grade7_laws_of_exponents.pdf",
    ],
    "SP": [
        "grade7_special_products.pdf",
        "grade7_polynomial_multiplication.pdf",
    ],
    "PO": [
        "grade7_algebraic_expressions.pdf",
        "grade7_polynomial_multiplication.pdf",
        "grade8_polynomial_operations_a.pdf",
        "grade8_polynomial_operations_b.pdf",
    ],
    "FP": [
        "grade8_factoring_gcf.pdf",
        "grade8_factoring_difference_squares.pdf",
        "grade8_factoring_trinomials.pdf",
        "grade8_factoring_general.pdf",
    ],
    "L2V": [
        "grade8_linear_equations_two_var.pdf",
        "grade8_slope_intercept.pdf",
    ],
    "SLE": [
        "grade8_systems_equations_graphing.pdf",
        "grade8_systems_equations_algebraic.pdf",
    ],
    "QE": [
        "grade9_quadratic_equations_intro.pdf",
        "grade9_quadratic_formula.pdf",
        "grade9_discriminant_roots.pdf",
    ],
    "RER": [
        "grade9_radicals_intro.pdf",
        "grade9_simplifying_radicals.pdf",
        "grade9_operations_radicals.pdf",
        "grade9_radical_equations.pdf",
        "grade9_rational_exponents.pdf",
        "grade9_rational_exponents_advanced.pdf",
    ],
    "PD": [
        "grade10_polynomial_division.pdf",
        "grade10_synthetic_division.pdf",
        "grade10_remainder_factor_theorem.pdf",
        "grade10_rational_root_theorem.pdf",
    ],
    "PE": [
        "grade10_polynomial_equations.pdf",
        "grade10_factoring_polynomials_higher.pdf",
        "grade10_polynomial_roots.pdf",
    ],
}

NODE_GRADE: dict[str, int] = {
    "FD": 6, "OI": 7, "LE": 7, "SP": 7, "FP": 8, "QE": 9,
    "RPP": 6, "AE": 7, "L1V": 7, "L2V": 8, "SLE": 8,
    "RER": 9, "PO": 8, "PD": 10, "PE": 10,
}

# ---------------------------------------------------------------------------
# Build reverse map: filename → list of node_ids
# ---------------------------------------------------------------------------
_FILENAME_TO_NODES: dict[str, list[str]] = {}
for _nid, _files in NODE_PDF_MAP.items():
    for _fname in _files:
        _FILENAME_TO_NODES.setdefault(_fname, []).append(_nid)


def _get_node_ids_for_file(filename: str) -> list[str]:
    """Return all node_ids that claim this filename, or ['GENERAL'] if none."""
    return _FILENAME_TO_NODES.get(filename, ["GENERAL"])


# ---------------------------------------------------------------------------
# Readable PDF renaming map
# ---------------------------------------------------------------------------
# Maps the original g#_q#_m# filenames to human-readable names.
# Files not in this map keep their original names.
PDF_RENAME_MAP: dict[str, str] = {
    # Grade 6
    "g6_q1_m1.pdf": "grade6_fractions_addition_subtraction.pdf",
    "g6_q1_m2.pdf": "grade6_fractions_multiplication.pdf",
    "g6_q1_m3.pdf": "grade6_fractions_division.pdf",
    "g6_q2_m1.pdf": "grade6_decimals_operations.pdf",
    "g6_q2_m2.pdf": "grade6_ratio_proportion.pdf",
    "g6_q2_m3.pdf": "grade6_percent.pdf",
    "g6_q2_m4.pdf": "grade6_rate_speed_distance.pdf",
    # Grade 7
    "g7_q1_m3.pdf": "grade7_operations_integers.pdf",
    "g7_q1_m4.pdf": "grade7_absolute_value_integers.pdf",
    "g7_q1_m9.pdf": "grade7_laws_of_exponents.pdf",
    "g7_q2_m4.pdf": "grade7_algebraic_expressions.pdf",
    "g7_q2_m5.pdf": "grade7_evaluating_expressions.pdf",
    "g7_q2_m6.pdf": "grade7_linear_equations_one_var.pdf",
    "g7_q2_m7.pdf": "grade7_solving_equations.pdf",
    "g7_q2_m8.pdf": "grade7_special_products.pdf",
    "g7_q2_m9.pdf": "grade7_polynomial_multiplication.pdf",
    # Grade 8
    "g8_q1_m1.pdf": "grade8_factoring_gcf.pdf",
    "g8_q1_m2.pdf": "grade8_factoring_difference_squares.pdf",
    "g8_q1_m3.pdf": "grade8_factoring_trinomials.pdf",
    "g8_q1_m4.pdf": "grade8_factoring_general.pdf",
    "g8_q1_m5a.pdf": "grade8_polynomial_operations_a.pdf",
    "g8_q1_m5b.pdf": "grade8_polynomial_operations_b.pdf",
    "g8_q1_m6.pdf": "grade8_linear_equations_two_var.pdf",
    "g8_q1_m7.pdf": "grade8_slope_intercept.pdf",
    "g8_q1_m8.pdf": "grade8_systems_equations_graphing.pdf",
    "g8_q1_m9.pdf": "grade8_systems_equations_algebraic.pdf",
    # Grade 9
    "g9_q1_m1.pdf": "grade9_quadratic_equations_intro.pdf",
    "g9_q1_m2.pdf": "grade9_quadratic_formula.pdf",
    "g9_q1_m3.pdf": "grade9_discriminant_roots.pdf",
    "g9_q2_m3.pdf": "grade9_radicals_intro.pdf",
    "g9_q2_m4.pdf": "grade9_simplifying_radicals.pdf",
    "g9_q2_m5.pdf": "grade9_operations_radicals.pdf",
    "g9_q2_m6.pdf": "grade9_radical_equations.pdf",
    "g9_q2_m7.pdf": "grade9_rational_exponents.pdf",
    "g9_q2_m8.pdf": "grade9_rational_exponents_advanced.pdf",
    # Grade 10
    "g10_q1_m1.pdf": "grade10_polynomial_functions.pdf",
    "g10_q1_m2.pdf": "grade10_polynomial_equations.pdf",
    "g10_q1_m3.pdf": "grade10_remainder_factor_theorem.pdf",
    "g10_q1_m4.pdf": "grade10_rational_root_theorem.pdf",
    "g10_q1_m5.pdf": "grade10_polynomial_division.pdf",
    "g10_q1_m6.pdf": "grade10_synthetic_division.pdf",
    "g10_q1_m7.pdf": "grade10_factoring_polynomials_higher.pdf",
    "g10_q1_m8.pdf": "grade10_polynomial_roots.pdf",
    "g10_q1_m9.pdf": "grade10_polynomial_graphs.pdf",
}


def _rename_pdfs() -> dict[str, str]:
    """Rename PDFs in slm_pdfs/ to human-readable names. Returns old→new map."""
    renamed: dict[str, str] = {}
    for old_name, new_name in PDF_RENAME_MAP.items():
        old_path = os.path.join(PDF_DIR, old_name)
        new_path = os.path.join(PDF_DIR, new_name)
        if os.path.exists(old_path) and not os.path.exists(new_path):
            os.rename(old_path, new_path)
            renamed[old_name] = new_name
            print(f"  Renamed: {old_name} -> {new_name}")
    return renamed


def _grade_from_filename(filename: str) -> int:
    """Extract grade level from the PDF filename."""
    m = re.search(r"grade(\d+)", filename, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"g(\d+)", filename, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return 0


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def build_index() -> None:
    """Build the ChromaDB index from SLM PDFs."""
    # Late imports so import errors surface clearly
    try:
        import chromadb
        from llama_index.core import SimpleDirectoryReader
        from llama_index.core.node_parser import SentenceSplitter
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        print(f"Missing dependency: {exc}")
        print("Install with:  pip install -r backend/requirements.txt")
        sys.exit(1)

    # ------------------------------------------------------------------
    # 0. Discover PDFs
    # ------------------------------------------------------------------
    if not os.path.isdir(PDF_DIR):
        print(f"PDF directory not found: {PDF_DIR}")
        print("Create it and add DepEd SLM PDFs, then re-run.")
        sys.exit(1)

    pdf_files = sorted(f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf"))
    if not pdf_files:
        print(f"No PDF files found in {PDF_DIR}")
        sys.exit(1)

    print(f"Found {len(pdf_files)} PDF(s) in {PDF_DIR}")

    # ------------------------------------------------------------------
    # 1. Rename PDFs to readable names
    # ------------------------------------------------------------------
    print("\n-- Renaming PDFs --")
    renamed = _rename_pdfs()
    if renamed:
        print(f"  Renamed {len(renamed)} file(s)")
        # Re-scan after rename
        pdf_files = sorted(f for f in os.listdir(PDF_DIR)
                           if f.lower().endswith(".pdf"))
    else:
        print("  All files already have readable names")

    # ------------------------------------------------------------------
    # 2. Load PDFs with LlamaIndex
    # ------------------------------------------------------------------
    print("\n-- Loading PDFs --")
    t0 = time.time()
    reader = SimpleDirectoryReader(
        input_dir=PDF_DIR,
        required_exts=[".pdf"],
        exclude_hidden=False,
        filename_as_id=True,
    )
    documents = reader.load_data()
    print(f"  Loaded {len(documents)} document page(s) in {time.time()-t0:.1f}s")

    # ------------------------------------------------------------------
    # 3. Chunk documents
    # ------------------------------------------------------------------
    print("\n-- Chunking documents --")
    splitter = SentenceSplitter(chunk_size=512, chunk_overlap=64)
    nodes = splitter.get_nodes_from_documents(documents, show_progress=True)
    print(f"  Created {len(nodes)} chunks")

    # ------------------------------------------------------------------
    # 4. Classify chunks → competency nodes using filename map
    # ------------------------------------------------------------------
    print("\n-- Classifying chunks by filename --")
    main_chunks: list[dict] = []   # node_id != GENERAL
    general_chunks: list[dict] = []

    for idx, node in enumerate(nodes):
        text = node.get_content()
        source_doc = os.path.basename(
            node.metadata.get("file_name", node.metadata.get("file_path", "unknown"))
        )

        # Look up which node_ids this file belongs to
        assigned_node_ids = _get_node_ids_for_file(source_doc)

        for node_id in assigned_node_ids:
            grade = NODE_GRADE.get(node_id, _grade_from_filename(source_doc))

            chunk_record = {
                "text": text,
                "node_id": node_id,
                "grade_level": grade,
                "source_doc": source_doc,
                "chunk_index": idx,
            }

            if node_id == "GENERAL":
                general_chunks.append(chunk_record)
            else:
                main_chunks.append(chunk_record)

    print(f"  Main chunks:    {len(main_chunks)}")
    print(f"  General chunks: {len(general_chunks)}")

    # ------------------------------------------------------------------
    # 5. Load embedding model
    # ------------------------------------------------------------------
    print("\n-- Loading embedding model (all-MiniLM-L6-v2) --")
    t0 = time.time()
    embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    print(f"  Model loaded in {time.time()-t0:.1f}s")

    # ------------------------------------------------------------------
    # 6. Set up ChromaDB — drop and recreate collection cleanly
    # ------------------------------------------------------------------
    print("\n-- Setting up ChromaDB --")
    client = chromadb.PersistentClient(path=CHROMA_DIR)

    # Delete existing collection if it exists, then recreate
    try:
        client.delete_collection(COLLECTION_MAIN)
        print(f"  Dropped existing '{COLLECTION_MAIN}' collection")
    except Exception:
        pass  # Collection did not exist yet

    main_collection = client.create_collection(COLLECTION_MAIN)
    print(f"  Created fresh '{COLLECTION_MAIN}' collection")
    print(f"  Persist path: {CHROMA_DIR}")

    # ------------------------------------------------------------------
    # 7. Embed & store — main collection only
    # ------------------------------------------------------------------
    print("\n-- Embedding & storing main chunks --")
    _store_chunks(main_chunks, main_collection, embed_model, "main")

    # General chunks are NOT embedded — they are only logged
    if general_chunks:
        print(f"\n  Skipped {len(general_chunks)} GENERAL chunk(s) (not embedded)")

    # ------------------------------------------------------------------
    # 8. Summary report
    # ------------------------------------------------------------------
    _print_summary(main_chunks, general_chunks)


def _store_chunks(
    chunks: list[dict],
    collection,
    embed_model,
    label: str,
) -> None:
    """Embed and add chunks into a ChromaDB collection."""
    if not chunks:
        print(f"  No {label} chunks to store.")
        return

    stored = 0
    batch_size = 64

    for batch_start in range(0, len(chunks), batch_size):
        batch = chunks[batch_start : batch_start + batch_size]

        ids: list[str] = []
        texts: list[str] = []
        metadatas: list[dict] = []

        for ch in batch:
            # Include node_id in the document ID so that the same chunk
            # duplicated under multiple nodes gets a unique ID per node.
            doc_id = f"{ch['node_id']}::{ch['source_doc']}::{ch['chunk_index']}"

            ids.append(doc_id)
            texts.append(ch["text"])
            metadatas.append({
                "node_id": ch["node_id"],
                "grade_level": ch["grade_level"],
                "source_doc": ch["source_doc"],
                "chunk_index": ch["chunk_index"],
            })

        if not ids:
            continue

        # Batch-embed
        embeddings = embed_model.encode(texts, show_progress_bar=False).tolist()

        collection.add(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        stored += len(ids)

    print(f"  Stored {stored} chunk(s).")


def _print_summary(
    main_chunks: list[dict],
    general_chunks: list[dict],
) -> None:
    """Print a human-readable summary of the indexing results."""
    print("\n" + "=" * 60)
    print("  INDEXING SUMMARY")
    print("=" * 60)

    total = len(main_chunks) + len(general_chunks)
    print(f"\n  Total chunks processed: {total}")
    print(f"  Main index chunks:     {len(main_chunks)}")
    print(f"  General (unmatched):   {len(general_chunks)}")

    # Chunks per node
    node_counts: dict[str, int] = {}
    for ch in main_chunks:
        node_counts[ch["node_id"]] = node_counts.get(ch["node_id"], 0) + 1

    print(f"\n  {'Node':<6} {'Label':<45} {'Chunks':>6}")
    print(f"  {'-'*6} {'-'*45} {'-'*6}")

    all_nodes = list(NODE_PDF_MAP.keys())
    zero_nodes: list[str] = []

    for nid in all_nodes:
        count = node_counts.get(nid, 0)
        label = _node_label(nid)
        bar = "#" * min(count // 2, 30) if count > 0 else "-"
        print(f"  {nid:<6} {label:<45} {count:>6}  {bar}")
        if count == 0:
            zero_nodes.append(nid)

    if zero_nodes:
        print(f"\n  [!] WARNING: {len(zero_nodes)} node(s) have ZERO chunks:")
        for nid in zero_nodes:
            pdfs = NODE_PDF_MAP.get(nid, [])
            print(f"     - {nid} ({_node_label(nid)})")
            for pdf in pdfs:
                print(f"       Expected PDF: {pdf}")
        print("     These nodes will have no content for RAG retrieval!")
        print("     Add the missing PDF(s) to slm_pdfs/ and re-run.")
    else:
        print("\n  [OK] All nodes have at least one chunk.")

    print("=" * 60 + "\n")


def _node_label(node_id: str) -> str:
    """Return a human label for a node ID."""
    labels = {
        "FD": "Fractions & Decimals",
        "OI": "Operations on Integers",
        "LE": "Laws of Exponents",
        "SP": "Special Products / Polynomial Multiplication",
        "FP": "Factoring Polynomials",
        "QE": "Quadratic Equations",
        "RPP": "Ratio, Proportion, Percent",
        "AE": "Algebraic Expressions & Evaluation",
        "L1V": "Linear Equations in 1 Variable",
        "L2V": "Linear Equations in 2 Variables",
        "SLE": "Systems of Linear Equations",
        "RER": "Rational Exponents & Radicals",
        "PO": "Polynomial Operations",
        "PD": "Polynomial Division",
        "PE": "Polynomial Equations",
    }
    return labels.get(node_id, node_id)


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    build_index()
