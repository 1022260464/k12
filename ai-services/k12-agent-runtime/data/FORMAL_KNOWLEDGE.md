# 正式演示知识语料说明

正式讲义正文请走 **管理端上传 PDF → 入库**（`teaching-resource-{id}`）。

不再维护 `formal_ai_literacy_knowledge.json` 向量种子，避免与已入库资料重复、且前端无法打开（无下载按钮）。

清理残留 seed：

```bash
uv run python scripts/delete_duplicate_formal_demo_docs.py
```

Neo4j 清理 formal-demo 文档节点：执行 `backend/sql/neo4j/004_cleanup_formal_demo_docs.cypher`，
或重启 Learning（若已把 004 加入 seed）。
