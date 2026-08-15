import os
import sys
from pathlib import Path

import k12_agent_runtime


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
