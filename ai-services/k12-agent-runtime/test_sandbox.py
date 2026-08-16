"""腾讯云 Agent Sandbox 手动连通性测试。

运行方式：
    uv run --env-file .env python test_sandbox.py
"""

import os
import re

from e2b_code_interpreter import Sandbox


def require_environment(name: str) -> str:
    """读取必需配置，但不输出 API Key 等敏感值。"""
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"环境变量 {name} 未配置")
    return value


def require_api_key() -> None:
    api_key = require_environment("E2B_API_KEY")
    if re.fullmatch(r"e2b_[0-9a-f]+", api_key) is None:
        raise RuntimeError(
            "E2B_API_KEY格式错误：请填写腾讯云API Keys页面生成的E2B兼容密钥；"
            "sdt-开头的是沙箱工具ID，不能作为API Key"
        )


def print_lines(lines: list[str]) -> None:
    for line in lines:
        print(line, end="" if line.endswith("\n") else "\n")


def main() -> None:
    domain = require_environment("E2B_DOMAIN")
    require_api_key()
    template = require_environment("K12_AGENT_SANDBOX_TEMPLATE")

    print(f"连接域名: {domain}")
    print(f"沙箱工具: {template}")

    sandbox: Sandbox | None = None
    try:
        sandbox = Sandbox.create(template=template, timeout=300)
        execution = sandbox.run_code(
            """
import importlib.util
import sys

print("K12 sandbox is ready")
print("Python:", sys.version)

for package in ("numpy", "pandas", "matplotlib"):
    installed = importlib.util.find_spec(package) is not None
    print(f"{package}: {'installed' if installed else 'missing'}")
""",
            language="python",
            timeout=60,
        )

        print_lines(execution.logs.stdout)
        print_lines(execution.logs.stderr)

        if execution.error is not None:
            raise RuntimeError(
                f"沙箱执行失败: {execution.error.name}: {execution.error.value}"
            )

        print("腾讯云 Agent Sandbox 连通性测试成功")
    finally:
        if sandbox is not None:
            sandbox.kill()
            print("沙箱实例已销毁")


if __name__ == "__main__":
    main()
