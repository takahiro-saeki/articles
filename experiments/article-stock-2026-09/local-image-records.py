"""Exercise the real CLI from a fixed Git archive, with a fake ComfyUI server."""
import contextlib
import hashlib
import importlib
import io
import json
from pathlib import Path
import platform
import subprocess
import sys
import tarfile
import tempfile
from unittest.mock import patch

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else "../local-anime-studio").resolve()
COMMIT = "2aeb306e4baa272afab9a133357eb1e6e141e964"

class FakeClient:
    queued = 0

    def __init__(self, server):
        pass

    def get_system_stats(self):
        return {"system": {"python_version": "mock"}, "devices": [{"type": "mps"}]}

    def queue_prompt(self, workflow):
        FakeClient.queued += 1
        return {"prompt_id": "test-prompt"}

    def wait_for_completion(self, prompt_id, timeout):
        raise TimeoutError("simulated timeout after queue acceptance")

with tempfile.TemporaryDirectory(prefix="article-image-records-") as temp:
    root = Path(temp)
    archive = subprocess.check_output(["git", "archive", COMMIT], cwd=REPO)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(root, filter="data")
    sys.path.insert(0, str(root / "src"))
    cli = importlib.import_module("local_anime_studio.__main__")
    workflow = root / "workflows/image/animagine-xl-4.0-opt-1024.json"
    record = root / "queued.json"
    common = ["--workflow", str(workflow), "--record", str(record)]
    with patch.object(cli, "ComfyUIClient", FakeClient), contextlib.redirect_stdout(io.StringIO()):
        queued_exit = cli.main(common)
    data = json.loads(record.read_text())
    assert queued_exit == 0
    assert data["history_record"] is None
    assert data["queue_response"]["prompt_id"] == "test-prompt"
    assert data["workflow"] == json.loads(workflow.read_bytes())
    assert data["workflow_sha256"] == hashlib.sha256(workflow.read_bytes()).hexdigest()
    record.unlink()
    with patch.object(cli, "ComfyUIClient", FakeClient), contextlib.redirect_stdout(io.StringIO()):
        timeout_exit = cli.main(common + ["--wait", "--timeout", "0.01"])
    assert timeout_exit == 1
    assert not record.exists()
    assert FakeClient.queued == 2
    print(json.dumps({
        "commit": COMMIT, "python": platform.python_version(), "server": "fake client; no GPU or network",
        "without_wait": {"exit": queued_exit, "record_exists": True, "history_record": None,
                         "workflow_and_raw_byte_hash_match": True},
        "wait_timeout": {"exit": timeout_exit, "queue_accepted": True, "record_exists": False},
        "queue_calls": FakeClient.queued,
    }, indent=2))
