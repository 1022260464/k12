-- 在目标PostgreSQL数据库中执行。该脚本可重复执行，不会删除已有数据。
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS k12_rag;

CREATE TABLE IF NOT EXISTS k12_rag.knowledge_document (
    document_id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_uri TEXT,
    content TEXT NOT NULL,
    stage_code VARCHAR(32),
    grade VARCHAR(32),
    textbook VARCHAR(255),
    chapter VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS k12_rag.knowledge_chunk (
    chunk_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL
        REFERENCES k12_rag.knowledge_document(document_id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1024) NOT NULL,
    embedding_model VARCHAR(128) NOT NULL,
    source_uri TEXT,
    stage_code VARCHAR(32),
    grade VARCHAR(32),
    textbook VARCHAR(255),
    chapter VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_knowledge_chunk_document_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_stage_grade
    ON k12_rag.knowledge_chunk(stage_code, grade);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_textbook
    ON k12_rag.knowledge_chunk(textbook);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunk_embedding_hnsw
    ON k12_rag.knowledge_chunk
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
