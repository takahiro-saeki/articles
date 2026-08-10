---
title: Turning Storybook stories into Vitest browser tests in Next.js
tags: storybook, vitest, nextjs, playwright
published: false
---

_This article is an English translation of the original Japanese article._

Maintaining a UI component catalog and a separate component test suite costs too much in an indie Next.js project. I use a setup where writing a Storybook story also creates a browser test. The same artifact serves as both the catalog and the component test.

The setup combines Storybook's Vitest addon with Vitest browser mode. Most of it lives in two configuration files.

## How it works

- Storybook uses `@storybook/nextjs-vite` for the component catalog.
- The `@storybook/addon-vitest` plugin turns each story into a test case.
- Vitest browser mode runs the tests in real Chromium through Playwright rather than jsdom.

Adding `Button.stories.tsx` therefore adds a test that renders the button in a browser. If the story has a `play` function, the same test runs those interactions.

## Configuration 1: `.storybook/main.ts`

```ts
import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
};
export default config;
```

With `@storybook/nextjs-vite`, components that use Next.js-specific features such as `next/image` and `next/navigation` still run in the Vite-based Storybook. In my project it also starts noticeably faster than the webpack version.

## Configuration 2: `vitest.config.ts`

Vitest `projects` separate regular unit tests from Storybook tests.

```ts
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      // Regular unit tests for the logic layer
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      // Storybook tests: stories running in a browser
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
```

Two details matter here:

1. `storybookTest()` loads the story files and registers them as tests. A story needs no extra code for a render check. Add a `play` function when you want to verify interactions.
2. The Playwright provider runs the test in headless Chromium. CSS layout and focus behavior use a real browser implementation.

Because the projects are separate, I can run only the fast logic tests with `vitest run --project unit`, then use `vitest run` when I want the full suite including stories.

## Why I keep this setup

The reason to write a test and the reason to write a catalog entry become the same. A separate component test suite is often the first thing I stop maintaining in a solo project. Here, the routine act of creating a story to inspect a component also adds a regression test.

Running in a real browser has also been more useful than I expected. Dialog focus traps, portals, and similar behavior can be missed or reported incorrectly by jsdom. Chromium exercises those paths directly.

The accessibility addon reports warnings in Storybook as well, so the catalog, component tests, and accessibility checks stay in one place.

## Limitations

- Browser mode is clearly slower than unit tests because it launches a browser. Splitting the projects lets me run only unit tests during most development work.
- A story without a `play` function checks that rendering does not break. That is still useful, but important form components benefit from interaction tests.

## Environment

- Storybook 10 with `@storybook/nextjs-vite` and `@storybook/addon-vitest`
- Vitest and `@vitest/browser-playwright` with Chromium
- Next.js 15 App Router inside a Turborepo monorepo
- The configuration is shortened from a project in production
