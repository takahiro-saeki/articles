---
title: "Reproducing local image generation takes more than saving model weights"
published: false
tags: [ai, python, testing, tooling]
canonical_url: https://zenn.dev/hirodeath/articles/local-image-generation-reproducibility
---

Keeping a model locally also lets you manage generation settings locally. But an output image and a model name do not tell you which workflow ran, with which parameters, on which environment.

Start by preserving the submitted workflow, information identifying the model, the runtime environment, and the stage the operation reached. This article inspects `local-anime-studio` to establish what its run record contains and which failure path leaves no record.

The investigation took place on September 11, 2026, against commit `2aeb306`. Checks ran on Python `3.14.5` with a mocked ComfyUI client. They did not generate images on a GPU, download model weights again, or compare pixel equality.

## Identify the model file as well as its name

The repository handles configuration and orchestration without bundling ComfyUI or model weights. Its [model configuration](https://github.com/takahiro-saeki/local-anime-studio/blob/2aeb306e4baa272afab9a133357eb1e6e141e964/configs/models.animagine-xl-4.0-opt.yaml) records the provider, model repository, pinned revision, filename, size, SHA-256, and license information.

That is more specific than saying “used Animagine.” To determine whether a file obtained later is the same model, you need its origin and file identity even when the display name is unchanged.

A SHA-256 value in configuration is not evidence that the weights in the current environment were checked against it. This investigation verified the inventory's values and structure, not the hash of a model download.

The history includes the image-generation foundation in `d78eb55` and the local UI and other additions in `2aeb306`. The implementation described below is the latter revision; proposed improvements are identified separately.

## Save the workflow itself, not just its filename

The [image workflow](https://github.com/takahiro-saeki/local-anime-studio/blob/2aeb306e4baa272afab9a133357eb1e6e141e964/workflows/image/animagine-xl-4.0-opt-1024.json) contains the checkpoint, positive and negative prompts, dimensions, sampling settings, and output node.

Although its filename contains `1024`, its actual dimensions are 832 × 1216. The seed is 42, steps 28, CFG 5.0, sampler `euler_ancestral`, and scheduler `normal`. Inferring a square image from the filename would misread the configuration.

With `--record`, the [CLI implementation](https://github.com/takahiro-saeki/local-anime-studio/blob/2aeb306e4baa272afab9a133357eb1e6e141e964/src/local_anime_studio/__main__.py) stores the workflow JSON and the SHA-256 of the bytes it read. The submitted workflow remains inspectable even if the source file is edited later.

The relevant order of operations simplifies to this excerpt. It illustrates the save order and is not a standalone program:

```python
workflow_bytes = workflow_path.read_bytes()
workflow = json.loads(workflow_bytes)
system_stats = client.get_system_stats()
queued = client.queue_prompt(workflow)
completed = None
if wait:
    completed = client.wait_for_completion(queued["prompt_id"], timeout)

write_record(record_path, {
    "workflow": workflow,
    "workflow_sha256": hashlib.sha256(workflow_bytes).hexdigest(),
    "system_stats": system_stats,
    "queue_response": queued,
    "history_record": completed,
})
```

The hash covers raw bytes, so changing whitespace or line endings changes it even if the JSON has the same meaning. It identifies the file read by the CLI rather than establishing semantic equivalence.

## Queue acceptance and generation completion produce different records

In the [ComfyUI server API](https://docs.comfy.org/development/comfyui-server/comms_routes), `POST /prompt` validates a workflow, adds it to the queue, and returns information including `prompt_id`. `/system_stats` provides environment information, while `/history/{prompt_id}` provides operation history. An acceptance response does not establish completion.

The real CLI was extracted from the fixed commit into a temporary directory. Only its client was replaced with a fake to exercise two paths. The [verification code](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/local-image-records.py) uses the Python standard library.

| Condition | CLI exit code | Record file | Verified contents or behavior |
| --- | --- | --- | --- |
| `--record`, without waiting | 0 | Created | Matching workflow and hash, acceptance ID, `null` `history_record` |
| `--record --wait`, timeout after acceptance | 1 | Not created | Queue submission occurred, but execution never reached the save |

For the second path, the fake first returns a `prompt_id`, then raises `TimeoutError` while waiting for completion. It is not merely a failure before submission. Assertions also verify that the queue method was called in both cases.

The difference follows from saving after the wait. Requesting a record therefore does not guarantee that a failed attempt will leave one.

The repository's existing 34 unit tests also passed, as did its repository-validation script. Those results and the mocked checks above do not demonstrate successful image generation on an actual MPS device.

## Preserving failed attempts requires an earlier save

The current CLI record includes the timestamp, server, workflow path and body, environment information, queue response, and any retrieved history. It captures useful normal-run conditions, but a waiting timeout leaves a gap.

A possible improvement would persist the operation in stages:

```text
Before submission: save the workflow, model identity, and environment
After acceptance: save prompt_id and the accepted state
After completion: save history and output references
On failure: save the last confirmed stage and the error
```

This is an unimplemented proposal. The CLI's save order was not changed during this work.

Failure states should distinguish server-side execution failure from a client that stopped waiting. Processing might continue after a timeout, so preserving the acceptance ID provides a way to inspect history later. The mock did not simulate continuing server-side work.

The current record also does not automatically attach the entire model configuration. Connecting the checkpoint name in the workflow to the inventory's pinned revision and model hash as they stood at execution time is another potential improvement.

## Traceable conditions do not guarantee identical pixels

[PyTorch's reproducibility documentation](https://docs.pytorch.org/docs/main/notes/randomness.html) explains that complete reproducibility is not guaranteed across releases, commits, platforms, or between CPU and GPU, even with the same seed.

The initial purpose of the record is therefore to make conditions comparable when outputs differ. It helps distinguish a changed workflow, different weights, another environment, or an operation that never completed.

This investigation verified the implementation that stores workflow contents and their hash, the record written without waiting, and the absence of a record after a waiting timeout. Before attempting image-reproduction experiments, check that conditions and final observed states are preserved for failed attempts as well.
