---
title: "A version-named Plane Module still needs evidence identifying the tested build"
published: false
tags: plane, expo, projectmanagement
canonical_url: null
---

"Verified 1.0.11" does not uniquely identify an app. There may be iOS and Android builds, and a rebuild can retain the same version displayed to users.

If a Plane Module represents a release, use its name for the intended deliverable and record the actual artifact identifiers with each verification result. The Module name alone is insufficient evidence of what was tested.

## Modules are not in use in this project yet

On September 11, 2026, I read SquadNote's Module lists. Both the ordinary list and the archived list returned 0 entries with no next page. The structure in this article is a proposal. I did not create Modules, run builds, or submit anything to a store.

[Plane's Module documentation](https://docs.plane.so/core-concepts/modules) describes grouping work items around features or milestones and allows a work item to belong to multiple Modules. The same work can appear in both a feature Module and a release Module.

Module membership identifies planned scope. To establish which artifact was tested, it needs a separate verification result.

## Git contains several different version fields

The example uses circle-hub at fixed commit `a34608c`. I read its [app configuration](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/app.config.ts) and [EAS configuration](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/eas.json). These values belong to that repository snapshot. This is not a table of the currently distributed app.

| Field | Value found in Git | What it establishes |
| --- | --- | --- |
| version | 1.0.11 | Configured version displayed to users |
| ios.buildNumber | 2 | iOS build number written in the file |
| android.versionCode | 1 | Android build number written in the file |
| cli.appVersionSource | remote | Configuration for managing build versions through EAS |
| production.autoIncrement | true | Configuration for automatic increments in production builds |
| runtimeVersion.policy | appVersion | Selected runtimeVersion policy |

[Expo's version management documentation](https://docs.expo.dev/build-reference/app-versions/) explains that the remote source manages build versions through EAS and does not update the local configuration when those versions increment. The 2 and 1 in this table therefore cannot be copied into a report as the latest submitted build numbers.

I did not retrieve the EAS build history for this article. The distributed artifacts' numbers remain unverified. Finding a value in Git and identifying the external artifact that needs testing are separate steps.

## Give the Module and the verification record different jobs

A possible Module name is "SquadNote 1.0.11 release preparation," a label that people can use when planning. Its verification work should record enough information to identify a specific target.

```json
{
  "module_label": "SquadNote 1.0.11 release preparation",
  "verification_target": {
    "platform": "ios",
    "channel": "testflight",
    "app_version": "1.0.11",
    "build_number": null,
    "artifact_reference": null,
    "source_commit": null
  },
  "verification_result": "not_run"
}
```

This is an example of a proposed record format. It is neither an existing Module API response nor data from a submitted build. It should not be marked verified while the null fields remain unresolved.

Do not automatically fill source_commit with `a34608c` just because that was the commit used for this article's research. The commit inspected and the commit used to create a distributed artifact have not been shown to be the same.

| Target being checked | Identifying information to add |
| --- | --- |
| An iOS TestFlight build | App version, build number, artifact reference, source commit |
| An Android test distribution | App version, versionCode, distribution track or artifact, source commit |
| A Web deployment | Environment, deployment identifier, source commit |
| A downloadable game | Target OS, distribution file, checksum, source commit |

This table proposes records for different distribution targets. Web and game releases do not need to adopt the same app version format. The shared requirement is that another verifier can reach the same target.

## Preserve previous results when rebuilding

Suppose an iOS build has been tested and is then rebuilt with the same displayed version. Even if the Module name stays unchanged, the earlier result does not automatically apply to the new artifact.

Create a record for the new artifact and decide which checks must run again. A work item describing the shared implementation can be reused, but keep the records of which artifact passed separate. Deleting the earlier result removes a comparison point if a problem appears later.

If Android is deferred to the next release, record the scope change and remaining work rather than only removing it from the Module. Independently of how dates are managed, this preserves what the release actually intended to distribute.

## What this review established

The verified findings are that both Module lists were empty, that the fixed Git snapshot contained the listed configuration values, and that the official documentation describes remote version management. I did not test the UI after creating a Module, retrieve actual build numbers, or perform distribution checks.

The release report cannot be marked complete while its artifact fields remain unverified. An initial Module can instead separate the plan from the result, then require target identifiers to be checked when someone records verification.
