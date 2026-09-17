"""对象存储领域模型和端口。"""

from k12_agent_runtime.domain.storage.models import StoredObject
from k12_agent_runtime.domain.storage.ports import ObjectStorage

__all__ = ["ObjectStorage", "StoredObject"]
