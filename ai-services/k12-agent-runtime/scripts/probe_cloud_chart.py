"""Manually time cloud interpreter startup, matplotlib import, and chart rendering."""

from time import perf_counter

from e2b_code_interpreter import Sandbox

from k12_agent_runtime.core.config import Settings

STEPS = (
    ("warmup", "print('ready')"),
    (
        "matplotlib-import",
        "import matplotlib; matplotlib.use('Agg', force=True); "
        "import matplotlib.pyplot as plt; print(plt.get_backend())",
    ),
    (
        "chart-render",
        "from io import BytesIO; from IPython.display import Image, display; "
        "fig, ax = plt.subplots(figsize=(2, 2)); "
        "ax.plot([1, 2, 3], [2, 4, 3]); "
        "buffer = BytesIO(); fig.savefig(buffer, format='png'); "
        "display(Image(data=buffer.getvalue())); plt.close(fig)",
    ),
)


def main() -> None:
    settings = Settings()
    if not settings.e2b_domain or not settings.e2b_api_key:
        raise RuntimeError("请先在Runtime .env中配置E2B_DOMAIN和E2B_API_KEY")

    sandbox = None
    started = perf_counter()
    try:
        sandbox = Sandbox.create(
            template=settings.sandbox_template,
            timeout=180,
            allow_internet_access=False,
            domain=settings.e2b_domain,
            api_key=settings.e2b_api_key.get_secret_value(),
            request_timeout=settings.sandbox_provider_request_timeout_seconds,
        )
        print(f"create_seconds={perf_counter() - started:.2f}")

        for name, code in STEPS:
            step_started = perf_counter()
            try:
                execution = sandbox.run_code(
                    code,
                    language="python",
                    timeout=60.0,
                    request_timeout=75.0,
                )
            except Exception as exc:
                elapsed = perf_counter() - step_started
                error_name = type(exc).__name__
                print(f"{name}_seconds={elapsed:.2f} error={error_name}")
                raise
            images = sum(bool(getattr(item, "png", None)) for item in (execution.results or []))
            error_name = getattr(execution.error, "name", None)
            print(
                f"{name}_seconds={perf_counter() - step_started:.2f} "
                f"images={images} error={error_name or 'none'}"
            )
            if execution.error is not None:
                raise RuntimeError(f"{name}执行失败: {error_name}")
            if name == "chart-render" and images == 0:
                raise RuntimeError("云端绘图未返回PNG产物")
    finally:
        if sandbox is not None:
            sandbox.kill()
            print("sandbox_released=true")


if __name__ == "__main__":
    main()
