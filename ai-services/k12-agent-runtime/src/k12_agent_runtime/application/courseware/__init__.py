"""大模型生成结构化互动课件。

课件是固定 JSON 协议（application/vnd.k12.courseware.v1+json），
前端 CoursewarePlayer 负责渲染翻页、答题与朗读；生成侧只负责产出并校验协议。
"""

from k12_agent_runtime.application.courseware.generate import GenerateCoursewareUseCase

__all__ = ["GenerateCoursewareUseCase"]
