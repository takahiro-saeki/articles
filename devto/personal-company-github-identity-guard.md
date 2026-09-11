---
title: "Check GitHub identity and destination before pushing: a hook denial is only part of the check"
published: false
tags: github, git, security
canonical_url: null
---

When personal and company GitHub accounts share an environment, use the working directory to select the expected account, then check which account the execution environment actually uses. A remote's owner alone does not establish the authenticated identity.

The identity-checking hook installed in this personal development environment was inspected and run through 6 cases with fake `gh` and `git` commands. A mismatched account and a failed account lookup produced different outcomes.

## Separate author information, API identity, and push destination

The local operating policy assigns `~/Documents/GitHub` to personal projects and `~/work` to company projects. The expected personal GitHub account is `takahiro-saeki`. The directory selects the expected identity. Authentication still needs a separate check.

Git commit author information also needs to be distinguished from GitHub API credentials. The [GitHub CLI environment reference](https://cli.github.com/manual/gh_help_environment) gives `GH_TOKEN` and `GITHUB_TOKEN` precedence over stored credentials. Switching a stored account can therefore leave a different token active in the current process.

Calling `user` with [gh api](https://cli.github.com/manual/gh_api) and selecting `--jq .login` returns only the login from that response. Keep the token value out of the log.

## Exercise the existing hook locally

The inspected file is `~/.Codex/hooks/check-github-account.sh`. When a command string matches an operation in its scope, it compares the working directory with the API login and checks conditions such as a remote pointing to the company account.

The file present on September 11, 2026, was executed without modification. Command text supplied on standard input was data to inspect, not a push to execute. Only the values returned by fake `gh` and `git` commands changed.

| Input condition | Existing hook result |
| --- | --- |
| Personal account and intended remote match | No denial |
| Company account returned in the personal directory | Denial |
| Account lookup fails and yields an empty value | No denial |
| Remote points to the company account | Denial |
| Personal owner but a different repository | No denial |
| Read-only `git status` | Outside scope; no denial |

"No denial" means the hook did not return deny for that input. It does not establish the safety of the entire operation or prove that the host registers and invokes this hook.

The failed-lookup row follows from the implementation checking a mismatch only when the login is nonempty. The different-repository row follows from the hook not requiring an exact repository match.

## A read-only precondition check should stop when lookup fails

The following read-only check was prepared for this article. It is deliberately specific to this personal repository's HTTPS URL.

```sh
expected_account=takahiro-saeki
expected_remote=https://github.com/takahiro-saeki/articles.git
actual_account=$(gh api user --jq .login) || exit 1
[ "$actual_account" = "$expected_account" ] || exit 1
actual_remote=$(git remote get-url --push origin) || exit 1
[ "$actual_remote" = "$expected_remote" ] || exit 1
printf '%s\n' 'identity and destination verified'
```

With the same 6 cases, only the correct account and correct remote returned exit code 0; every other case returned exit code 1. Failed identity lookup also stops execution. This short example contains no push operation.

The check does not replace or modify the installed hook. The verified values must also remain in the environment used by the subsequent operation. A previous result cannot be reused after moving to another shell and changing credentials or the remote.

## Do not extend a GitHub CLI check to another authentication path

`gh api user` identifies the credentials used by GitHub CLI. It does not establish the account used by a push through an SSH key or another Git credential helper.

Actual operations also need a consistent authentication path. Resolve any ambiguity about whether the project is personal or company work before operating. Afterward, check the repository owner and the commit on the intended branch. Browser display names and commit author names are insufficient for those checks.

The [6-case verifier](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/identity-guard-batch12.py) and [results with the inspected file's SHA](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/production/2026-09/batch-12/identity-experiment.json) are saved. The Bash hook and POSIX sh example ran on macOS without real credentials, real pushes, or hook configuration changes. This does not cover a real API during network failure or every command spelling, so a few denial cases do not establish complete prevention.
