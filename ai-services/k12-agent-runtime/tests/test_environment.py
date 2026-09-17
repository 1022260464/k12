import os
import sys
from pathlib import Path

import k12_agent_runtime
from k12_agent_runtime.core.config import Settings


def test_python_version() -> None:
    assert sys.version_info[:2] == (3, 13)


def test_project_virtual_environment() -> None:
    project_root = Path(__file__).resolve().parents[1]
    expected_venv = project_root / ".venv"
    assert os.path.normcase(str(Path(sys.prefix).resolve())) == os.path.normcase(
        str(expected_venv.resolve())
    )


def test_project_package_can_be_imported() -> None:
    assert k12_agent_runtime.__version__ == "0.1.0"


def test_settings_uses_module_env_when_started_outside_module(monkeypatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    configured_files = Settings.model_config["env_file"]
    assert Path(configured_files[-1]) == Path(__file__).resolve().parents[1] / ".env"

    module_dir = tmp_path / "module"
    module_dir.mkdir()
    (module_dir / ".env").write_text("K12_AGENT_APP_NAME=from_module_env\n", encoding="utf-8")
    monkeypatch.setitem(Settings.model_config, "env_file", (".env", module_dir / ".env"))
    monkeypatch.delenv("K12_AGENT_APP_NAME", raising=False)

    assert Settings().app_name == "from_module_env"
