# RAG pipeline

```
Upload (PDF / .md / .txt, ≤ 8 MB)          Knowledge management screen or scripts/ingest-knowledge.ts
  → Text extraction                          unpdf (PDF pages marked [page N]); front matter for Markdown
  → Cleaning                                 whitespace, zero-width chars
  → Chunking                                 by section heading; ≤ 380 tokens; long sections split on sentences with ~40-token overlap
  → Metadata                                 document_id, document_name, category, topic, version, owner, effective_date, page, source_url, approved, last_updated
  → MiniLM embedding                         all-MiniLM-L6-v2, mean-pooled, L2-normalised, 384-d
  → Vector storage                           knowledge_chunks.embedding vector(384), HNSW cosine index
  → Semantic retrieval                       match_knowledge_chunks()  — approved AND current only
  → Metadata filtering                       category filter (e.g. Customer 360 → Account, Customers)
  → Hybrid + re-ranking                      Postgres full-text (search_knowledge_text) fused by reciprocal rank; re-ranked by query-term coverage
  → Sufficiency check                        best similarity ≥ RAG_MIN_SIMILARITY (or term coverage) — else "insufficient evidence"
  → Grounded answer                          Mistral with [S#]-tagged passages
  → Source citation                          tags validated; UI shows Document · Section · Page · Version · effective date
```

Example citation rendered under an answer:
```
Source: S1 · RFQ to Quotation SOP
Section 3.2 · Version 4.1 · effective 2026-01-15
```

## Versioning rules
- A document is identified by `document_key`; each upload is a `(document_key, version)` row.
- Uploading a **new version** marks the previous one `SUPERSEDED`, `is_current=false` (its chunks too) — kept for history, excluded from retrieval.
- Re-uploading an **existing version** is rejected: a policy is never silently replaced.
- Only **approved** current versions are retrievable; HR can withdraw approval instantly.
- Review/expiry dates are shown and flagged when overdue.

## Embedding providers
`EMBEDDINGS_PROVIDER=hf-api` (default; needs `HF_API_TOKEN`), `transformers` (in-process ONNX; `npm i @huggingface/transformers`; best on self-hosted Node), or `none`. If embeddings are unavailable the pipeline still indexes chunks for full-text retrieval and records `embedding_model = fts-only`; **Re-index embeddings** fills vectors later. Query and document embeddings must come from the same model.

## Replacing the sample content
The 14 documents in `knowledge/` are synthetic. Upload real SOPs/policies in **Knowledge management** with the same `document_key` and a higher version, or add Markdown files with front matter and run `npx tsx scripts/ingest-knowledge.ts`.

## Tests
`tests/unit/ai.test.ts`: front matter, section chunking within budget, page tracking, fusion/re-ranking, sufficiency thresholds, citation formatting, stripping of invented citations. `tests/db/…`: SQL retrieval returns only approved + current chunks (vector and full-text).
