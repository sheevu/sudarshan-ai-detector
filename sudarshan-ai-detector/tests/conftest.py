import sys
from pathlib import Path
import pytest

# Ensure parent directory (sudarshan-ai-detector) is in sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from scripts.detector import SudarshanDetector

@pytest.fixture
def detector():
    return SudarshanDetector(use_transformer=False)

