class RagModelError(RuntimeError):
    """RAG模型或向量存储调用失败时使用的稳定错误类型。"""

    def __init__(self, code: str, status_code: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code
