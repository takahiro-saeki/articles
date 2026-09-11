---
title: "An AASA 200 response is not enough: compare the development app ID and URL paths"
published: false
tags: ios, expo, debugging
canonical_url: null
---

An AASA endpoint can return JSON with HTTP 200 without listing the app you want. Check the HTTP response, application identifier, matching path, and association used by the device in that order.

The production and development AASA requests both returned 200, but both bodies defined the production app. Comparison with the development app configuration showed that its application identifier was missing.

## Do not follow redirects in the initial GET

The inspection date was September 11, 2026. Save headers separately from the response body.

```sh
curl --silent --show-error \
  --dump-header aasa.headers \
  --output aasa.json \
  https://squad-note.com/.well-known/apple-app-site-association
```

Adding -L can conceal an initial 302 behind the final response. [Apple's TN3155](https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links) does not support redirects for hosting the AASA file itself. That is distinct from redirects involving a link the user taps.

The retrieved responses were as follows. No authentication was sent.

| Domain | HTTP | Content-Type | appID in the body |
| --- | ---: | --- | --- |
| squad-note.com | 200 | application/json | 3VDD942S97.com.squadnote.app |
| dev.squad-note.com | 200 | application/json | 3VDD942S97.com.squadnote.app |

Each body was 125 bytes, and their hashes matched. Both responses had Cache-Control set to s-maxage=31536000. These were observations at retrieval time, not records obtained from Apple's CDN or a device.

## Does the JSON include the development identifier?

The [app configuration](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/app.config.ts) was read at circle-hub commit `a34608c`. Evaluating the configuration function with each environment produced these values.

| Environment | bundleIdentifier | associatedDomains |
| --- | --- | --- |
| production | com.squadnote.app | applinks:squad-note.com |
| development | com.squadnote.app.dev | applinks:dev.squad-note.com |

The [AASA route in the fixed source](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/app/.well-known/apple-app-site-association/route.ts) returns the same production identifier found in the downloaded body.

Comparing the identifier combination specified in the source therefore finds no entry for the development app, 3VDD942S97.com.squadnote.app.dev. Successfully retrieving the file from the development domain does not establish its association with the development application.

This comparison concerns configuration files. The signed entitlements of an installed app were not inspected, so this does not establish the cause of a failure on a particular device. For an actual build, also inspect its application-identifier and Associated Domains.

## Compare URLs against the existing paths

The retrieved AASA uses the legacy appID and paths format. It lists 3 paths.

```json
[
  "/organizations/*",
  "/s/*",
  "/invite/*"
]
```

[Apple's legacy format documentation](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html) describes matching paths without the query or fragment and distinguishes letter case. Avoid casually mixing this format with appIDs and components.

The local test used a small comparison function supporting only the positive prefix patterns in this file. It parses the URL with JavaScript's URL and checks whether pathname starts with a listed prefix.

| URL path or suffix | Result from this limited checker |
| --- | --- |
| /invite/demo | Matches |
| /invite/demo?openExternalBrowser=1#check | Matches |
| /Invite/demo | Does not match |
| /invite | Does not match |
| /settings | Does not match |

This function is not Apple's matcher. It does not implement components or exclusion rules, and stops with an unsupported result for formats it cannot handle. Unsupported by this checker does not mean invalid AASA.

Including HTTP 302, an HTML Content-Type, malformed JSON, the development app ID mismatch, and the components format gave 10 conditions. That count combines comparisons of retrieved data with local variations of those conditions.

## Verify Apple's matching and device association separately

TN3155 describes using swcutil on a Mac to verify saved JSON against a URL. On macOS 26.6.2 in this environment, the tool required root, and noninteractive sudo exited because a password was required. The swcutil check was therefore not performed. The limited local checker is not presented as equivalent official verification.

For a device investigation, inspect the signed app's associated domains, device diagnostics, and the way the link is opened. Typing a URL directly into Safari's address bar or navigating within the same domain may not exercise opening an external Universal Link.

This research did not tap links on a device or collect a sysdiagnose. The point where JSON looks correct and the point where the OS chooses an app remain separate results.

## Do not infer device cache state from origin headers

Apple describes using its own CDN to retrieve and cache AASA on iOS 14 and later. Updating the origin body alone does not establish that installed devices used a new association.

The observed s-maxage=31536000 does not justify claiming that a device will wait that many seconds before updating. The observation concerns the origin response. Apple's state and the device's state require separate evidence.

No AASA or app configuration was changed for this article. Comparing the downloaded JSON, configured app ID, and target URL established that the response did not list the development identifier. Signed-build and device verification remain.
