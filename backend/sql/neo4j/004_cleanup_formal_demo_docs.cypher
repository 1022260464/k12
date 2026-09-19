// Remove formal-demo KnowledgeDocumentRef leftovers (prefer teaching-resource-* EXPLAINS).
MATCH (d:KnowledgeDocumentRef)
WHERE d.documentId STARTS WITH 'formal-demo-'
DETACH DELETE d;
