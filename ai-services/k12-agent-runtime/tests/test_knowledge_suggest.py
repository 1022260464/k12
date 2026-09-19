from k12_agent_runtime.interfaces.api.routes.knowledge import _parse_suggest_json


def test_parse_suggest_json_from_plain_object():
    data = _parse_suggest_json('{"codes":["a.b"],"reasons":{"a.b":"相关"}}')
    assert data["codes"] == ["a.b"]
    assert data["reasons"]["a.b"] == "相关"


def test_parse_suggest_json_from_markdown_fence():
    raw = """```json
{"codes":["x.y"],"reasons":{}}
```"""
    data = _parse_suggest_json(raw)
    assert data["codes"] == ["x.y"]
