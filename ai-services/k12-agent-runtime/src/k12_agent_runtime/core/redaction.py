from typing import Any

_SENSITIVE_KEY_PARTS = (
    "authorization",
    "cookie",
    "password",
    "secret",
    "token",
    "api_key",
    "apikey",
)


def redact_mapping(value: dict[str, Any], *, max_depth: int = 6) -> dict[str, Any]:
    """递归遮盖上下文中的常见凭证字段，避免写入日志数据库。"""
    return {
        str(key): _redact_value(str(key), item, depth=0, max_depth=max_depth)
        for key, item in value.items()
    }


def _redact_value(key: str, value: Any, *, depth: int, max_depth: int) -> Any:
    normalized_key = key.lower().replace("-", "_")
    if any(part in normalized_key for part in _SENSITIVE_KEY_PARTS):
        return "[REDACTED]"
    if depth >= max_depth:
        return "[MAX_DEPTH]"
    if isinstance(value, dict):
        return {
            str(child_key): _redact_value(
                str(child_key),
                child_value,
                depth=depth + 1,
                max_depth=max_depth,
            )
            for child_key, child_value in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [
            _redact_value("", item, depth=depth + 1, max_depth=max_depth)
            for item in value[:100]
        ]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)
