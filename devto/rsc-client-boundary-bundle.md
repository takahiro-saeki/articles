---
title: "Do more Client boundaries mean more JavaScript? Comparing one entry with two"
published: false
description: "Three equivalent Next.js pages show why imported dependencies matter more than counting use client directives."
tags: [nextjs, react, performance, webdev]
canonical_url: "https://zenn.dev/hirodeath/articles/rsc-client-boundary-bundle"
---

Fewer `'use client'` directives do not necessarily mean less JavaScript. In this experiment, putting two buttons in separate Client Components required 22,883 fewer bytes of JavaScript referenced by the initial HTML than making the whole page one Client Component.

The difference came from importing catalog rendering code and data into the client dependency graph, rather than the number of boundaries. Rendering the catalog as a Server Component also increased HTML size. Looking only at JavaScript cannot establish a reduction in total traffic.

## Build the same screen three ways

The screen contains 256 generated public catalog entries and two independent counters. Names include a sequence number and a deterministically generated SHA-256 string. They represent neither real user data nor a production workload distribution.

| Configuration | Client entry modules | How the catalog is rendered |
| --- | ---: | --- |
| broad | 1 | A Client Component imports Catalog |
| leaves | 2 | The Server Page renders Catalog; only the buttons are Client Components |
| slot | 1 | The Server Page renders Catalog and passes it as children to a Client Frame |

This counts Client entry modules introduced for this page. It does not count Next.js internals or all component instances on the screen.

The leaves Page contains the following code. CounterA and CounterB each have `'use client'`; Catalog does not.

```jsx
import CounterA from '../../../components/counter-a';
import CounterB from '../../../components/counter-b';
import Catalog from '../../../components/catalog';
export default function Page() {
  return <main><h1>Catalog</h1><CounterA /><CounterB /><Catalog /></main>;
}
```

`'use client'` establishes a boundary in the import graph. When a client entry imports Catalog, data imported by Catalog becomes a client dependency too. Neither its name nor the absence of a directive in its own file keeps it on the server. This matches the [Next.js Server and Client Components documentation](https://nextjs.org/docs/app/getting-started/server-and-client-components).

## What the production build measurement includes

The experiment ran `next build --webpack` with Next.js 16.3.4 and Node.js 24.15.0 on September 11, 2026. It used `cacheComponents: false` and no React Compiler.

The installed React / React DOM dependencies were 19.2.5, while the implementation bundled by Next.js for App Router was `19.3.0-canary-cbb046ab-20260731`. The version check included the bundled modules instead of relying only on dependency declarations.

All three routes were built in one application. Each initial HTML response supplied a deduplicated list of `script src` URLs. The uncompressed column measures the fetched files, including the shared runtime. Python recompressed each file separately for the gzip total; that column is not measured network transfer size.

| Configuration | JS uncompressed bytes | JS gzip bytes | HTML uncompressed bytes | HTML gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| broad | 581,755 | 181,794 | 25,984 | 12,550 |
| leaves | 558,872 | 170,154 | 58,819 | 20,438 |
| slot | 558,817 | 170,183 | 58,617 | 20,222 |

This compares scripts referenced by the initial HTML. It excludes code loaded by subsequent lazy imports, cache reuse after visiting other routes, source maps, and CDN compression choices. Changes to build chunking will also change the numbers.

Playwright verified that all 256 catalog rows and the initial button labels matched. Clicking each button produced `A: 1` and `B: 1`. The smaller configurations did not remove content or interaction.

## Find the removed dependency in the chunks

Webpack module information included Catalog and generated data imported through broad. A search for the identifying string from the last catalog name also found it in broad's fetched JavaScript, but not in the JavaScript fetched for leaves or slot.

Although leaves introduced another entry module, it excluded data used only to render the list from client imports. This does not prove that making arbitrarily many small Client Components always produces smaller bundles. The comparison contains just two simple buttons.

The HTML increase also needs checking. A catalog rendered on the server still reaches the browser as HTML and RSC representations. Its data does not disappear from transmission. All three HTML responses contained the catalog, and the complete HTML containing the RSC representation was larger for leaves and slot.

Reducing JavaScript transfer or execution and reducing the combined size of every response are different measurements. This experiment measured neither hydration time nor input latency, so it does not claim a particular rendering speedup.

## Distinguish an import from a children slot

The slot Page creates the Catalog element on the server, then passes it to Frame.

```jsx
import Frame from '../../../components/frame';
import Catalog from '../../../components/catalog';
export default function Page() { return <Frame><Catalog /></Frame>; }
```

Frame owns the two counters on the client and places the children it receives. That differs from importing Catalog inside Frame. Treating every visual descendant of a Client Component as client code misses this distinction between the component tree and the import graph.

Props passed from Server to Client Components must still satisfy serialization constraints. The [use client API documentation](https://nextjs.org/docs/app/api-reference/directives/use-client) does not grant permission to pass arbitrary ordinary functions or secret values. This experiment uses generated data that is intended to appear in the browser.

The uncompressed JavaScript difference between slot and leaves was 55 bytes. Gzip reversed their order. Such a small difference does not decide the design: a Frame responsible for the whole list's interactions may suit a slot, while independent buttons may suit separate leaves. Choose according to who needs to own the state.

## Repeat the comparison on your screen

The [comparison application](https://github.com/takahiro-saeki/articles/tree/codex/article-stock-2026-09/experiments/article-stock-2026-09/next-batch07) and [measurement runner](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/run-next-batch07.py) retain the pinned dependencies and generated data.

Keep the same content and interactions, then inspect what each client entry imports. When moving expensive work to the server, check both what disappeared from JavaScript and what moved into HTML or RSC. Counting boundaries cannot replace that inspection.
