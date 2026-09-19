// Neo4j constraints for K12 knowledge graph (run once).
// Compatible with Neo4j 5.x.

CREATE CONSTRAINT knowledge_point_code IF NOT EXISTS
FOR (n:KnowledgePoint) REQUIRE n.code IS UNIQUE;

CREATE CONSTRAINT course_chapter_ref_key IF NOT EXISTS
FOR (n:CourseChapterRef) REQUIRE n.refKey IS UNIQUE;

CREATE CONSTRAINT knowledge_document_ref_id IF NOT EXISTS
FOR (n:KnowledgeDocumentRef) REQUIRE n.documentId IS UNIQUE;

CREATE CONSTRAINT practice_question_ref_id IF NOT EXISTS
FOR (n:PracticeQuestionRef) REQUIRE n.questionId IS UNIQUE;
