---
title: Protecting a personal web app with Cloudflare Access and email OTP
tags: cloudflare, workers, zerotrust, security
published: false
---

_This article is an English translation of the original Japanese article._

I deployed a personal task management app to Cloudflare Workers, but I did not want anyone with the URL to be able to open it. Building and maintaining a login system for an app with one user felt excessive.

Cloudflare Access fit this use case. It can place email one-time-code authentication in front of a `workers.dev` URL without any application code changes, and the setup is available on the free plan.

## Why I chose Access instead of an application login

My decision came down to three points:

- For an app with static assets and APIs, adding a login screen does not stop someone from downloading the JavaScript bundle directly. Any data included in the bundle remains visible.
- Access authenticates the request at the edge before it reaches the application. HTML, JavaScript, and API routes receive the same protection.
- There is no login implementation or password store to maintain. The user receives a code by email.

Putting authentication in front of the application usually requires infrastructure work. Since this app already runs on Cloudflare, it was a dashboard setting.

## Setup

### 1. Enable Access on the `workers.dev` URL

In the Cloudflare dashboard, open Workers & Pages, select the Worker, and open Domains & Routes. The `workers.dev` URL has a visibility dropdown. Choose the option to protect it with Access.

Cloudflare then confirms that visitors must sign in and match an Access policy before the Worker loads. Once enabled, Access handles the request before the Worker.

### 2. Allow only your email address

Open the Cloudflare Access management screen and restrict the policy to your own email address. Opening the URL now follows this flow:

1. Access redirects to its sign-in page.
2. Entering the email address sends a six-digit one-time code.
3. Entering the code opens the application.

The same flow works from a phone.

### 3. Close the preview URL too

The same dashboard also includes the preview URL, which looks like `*-project-name.subdomain.workers.dev`. Protecting the main URL while leaving the preview public can expose the latest deployment through that route. Disable the preview URL if you do not use it, or protect it with Access as well.

### 4. Complete Zero Trust setup if needed

The first visit to the Access management screen may ask you to select a plan. The Free plan covers up to 50 users at no charge. Cloudflare may ask for a payment method during setup, but the Free plan itself does not create a charge.

You can also change the session duration under Access, Applications, and the selected application. For a personal app, extending it up to one month avoids entering a code every day.

## Verify that Access is active

Opening the app in a private browser window should show the Access login page. You can also check with curl.

```bash
$ curl -s -o /dev/null -w "%{http_code}\n" https://my-app.example.workers.dev/
302
```

An unauthenticated request should receive a 302 redirect to `*.cloudflareaccess.com` instead of reaching the application. Check an `/api/...` route as well to confirm that the protection applies to both pages and APIs.

## About the Access JWT warning

When enabling Access, the dashboard warns that Workers handling sensitive data should validate the Access JWT and reject requests that bypass Access.

This protects against future routes that do not pass through the configured Access application. My current setup exposes only the protected `workers.dev` URL. Adding a custom domain or another route would change that assumption. For sensitive data, validating the Access JWT inside the Worker adds another boundary instead of relying only on the entry route configuration. The AUD tag and JWK public key URL used for validation are not secrets like passwords or API keys.

## What this setup provides

- Access restricts a personal app without adding application login code.
- A `workers.dev` URL can be protected directly from the dashboard without a custom domain.
- Preview URLs need their own protection or should be disabled.
- A longer session duration keeps the app convenient for daily personal use.

## Environment

- Cloudflare Workers on a `workers.dev` domain and Cloudflare Access on the Zero Trust Free plan
- The application uses Next.js and `@opennextjs/cloudflare`, but the Access setup does not depend on the application framework
