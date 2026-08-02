---
title: Switching Between Web URLs and App Deep Links for LINE In-App Browser
tags: LINE, Deep Link, React Native, Next.js
published: false
---

This article is an English translation of the original Japanese article.

When sharing schedules or invite links via LINE, the link opens in the LINE in-app browser. For public pages that only require viewing, this is not a problem. However, for pages requiring Google login, authentication may fail.

As a countermeasure, I unified the entry point to HTTPS URLs and made the web side determine whether guidance to an external browser is needed.

## Not Directly Sharing Custom Scheme

The app has a `custom scheme`.

```text
squadnote://invite/org_123
```

However, this URL has no destination when the app is not installed. For URLs shared to LINE, I use HTTPS, which can also be opened on the web.

```text
https://squad-note.com/invite/org_123?openExternalBrowser=1
```

On iOS, Universal Links are configured, so if the app is installed, the same HTTPS URL can open the app. For devices without the app, it displays the web page.

## Separating Public and Member Pages

For schedule sharing, I change the path based on the public setting.

```ts
const path = schedule.isPublic
  ? `/s/${orgId}/${scheduleId}`
  : `/organizations/${orgId}/schedules/${scheduleId}`;

const url = `${config.apiUrl}${path}?openExternalBrowser=1`;
```

If it is a public schedule, I share `/s/...`, which does not require login. For non-public schedules, I use the member path. Sending everything to the login screen makes it unclear whether the recipient can view the content.

## The Parameter Is Not for Opening the App

`openExternalBrowser=1` is not a setting to enable Universal Links. It is a signal for the web to display guidance to move to an external browser when opened in the LINE in-app browser.

Separating the roles:

- HTTPS URL: common entry point for sharing
- Universal Links: association with installed app
- Web public page: fallback for users without the app
- `openExternalBrowser=1`: workaround for authentication in LINE in-app browser

Adding the query parameter alone does not make LINE automatically open Safari or Chrome. On the web side, I check the User-Agent and query parameter, then display instructions to open in an external browser.

## Separating Share Message from URL

On the React Native side, I used the OS share sheet.

```ts
const name = schedule.title ?? schedule.location ?? "Practice";
const message = `${name} ${date} ${startTime}-${endTime}\n${url}`;

await Share.share({ message });
```

I do not restore the destination from the share message, but instead include the necessary ID in the URL itself. Since both the app side and the web side can interpret the same path, I did not need to add branching for each sharing destination in React Native.

LINE workarounds and deep links appear similar, but they are issues on different layers. By consolidating shared URLs to HTTPS and keeping app association and web browser workarounds independent, the structure becomes easier to maintain.

## References

- [Expo: Linking into your app](https://docs.expo.dev/linking/overview/)
- [Apple: Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
