"""K12 agent runtime package."""

__version__ = "0.1.0"


def main() -> None:
    """Keep the package-level command compatible with the original uv project."""
    from k12_agent_runtime.main import main as run_server

    run_server()
