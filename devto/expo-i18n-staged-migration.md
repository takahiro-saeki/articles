---
title: "Migrating an Expo app from Japanese to multi-language support in stages"
tags: expo, reactnative, i18n, typescript
published: false
---

This article is an English translation of the original Japanese article.

I migrated an Expo app from Japanese only to Japanese, English, and Simplified Chinese. Instead of translating everything at once, I divided the work into three stages: foundation, core flows, and remaining screens.

The harder part was not gathering translations, but deciding device language versus manual setting priority, date formatting, and handling untranslated screens.

## Defined language setting responsibility first

I used `i18next` and `react-i18next`. For device language detection, I used Hermes `Intl`.

```ts
export const SUPPORTED_LANGUAGES = ["ja", "en", "zh-Hans"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = SupportedLanguage | "system";

export function detectDeviceLanguage(): SupportedLanguage {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
  const lang = locale.toLowerCase().split(/[-_]/)[0];
  if (lang === "zh") return "zh-Hans";
  return lang === "ja" || lang === "en" ? lang : "ja";
}
```

The setting screen stores the chosen value in `SecureStore`. If the saved value is `system`, the device setting takes priority; if it is a specific language, the manual setting wins.

```ts
export async function setLanguagePreference(pref: LanguagePreference) {
  await SecureStore.setItemAsync(LANGUAGE_PREF_KEY, pref);
  await i18n.changeLanguage(pref === "system" ? detectDeviceLanguage() : pref);
}
```

Initial render initializes synchronously, then reads the saved setting later. I chose not to block the launch screen just to load the setting.

## Stage 1: common UI only

First, I targeted only the bottom navigation, dashboard, and language picker in the settings screen.

```tsx
const { t } = useTranslation();

<Text>{t("dashboard.title")}</Text>
```

Here I found a bug. The bottom navigation was using display labels for active detection, so translation broke the logic. I added a fixed `key` separate from the label.

```ts
type TabItem = {
  key: "home" | "schedules" | "notifications" | "settings";
  label: string;
  href: Href;
};
```

Using labels as identifiers is hard to notice until translation, but multilingual support surfaces this design issue.

## Stage 2: attendance core flow

Next, I migrated the schedule list, schedule detail, and attendance submission. At this stage, the goal was a state where a user could complete daily operations in one language.

I split translation keys by screen.

```json
{
  "scheduleDetail": {
    "attending": "参加",
    "absent": "不参加",
    "maybe": "未定",
    "waitlisted": "キャンセル待ち"
  }
}
```

Status values maintain shared English identifiers with the API, translating only for display. Since the DB does not store Japanese labels, adding languages requires no data migration.

## Stage 3: dates and remaining screens

Finally, I replaced admin screens, notifications, inquiry forms, empty states, and error messages. At the same time, I moved date display to `Intl.DateTimeFormat`.

```ts
function formatDate(date: Date, language: SupportedLanguage) {
  const locale = language === "zh-Hans" ? "zh-CN" : `${language}-${language === "ja" ? "JP" : "US"}`;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
```

When reviewing only translation JSON, it is easy to miss weekdays, date/time formatting, and API-derived errors. I split the checklist per screen into "fixed strings," "dates," "server errors," and "empty states."

## Web and mobile differ in language entry points

On the web, you can use `Accept-Language` or locale in the URL. Considering shared URLs, including locale in the URL like `/en/...` has the advantage of showing the same language to the recipient.

Mobile, however, does not have a URL for each launch. Using device settings as the initial value and prioritizing in-app manual settings felt more natural. Even if web and mobile share translation data, the logic that decides the language does not need to be the same.

During staged migration, Japanese mixes in. Still, completing the main flow in sections felt easier to manage than placing keys across all screens and leaving verification incomplete.

## References

- [i18next](https://www.i18next.com/)
- [React i18next](https://react.i18next.com/)
- [Next.js: Internationalization](https://nextjs.org/docs/app/guides/internationalization)
