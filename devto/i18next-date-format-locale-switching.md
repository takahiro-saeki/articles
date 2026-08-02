---
title: Supporting Language Switching for Date Formats, Not Just Text, with i18next
tags: i18next, React Native, Expo, TypeScript
published: false
---

This article is an English translation of the original Japanese article.

After introducing `i18next` to a React Native app, dates like `7月24日(金)` remained in Japanese on the screen. Just adding more translation JSON does not change places where `Date` is directly formatted.

To avoid having text and dates in different languages, I unified the language detection and passed it to `Intl.DateTimeFormat`.

## Three Language Settings

The setting values are Japanese, English, and follow device, for a total of three types.

```ts
export type LanguagePreference = "system" | "ja" | "en";
```

I save the user's choice in `SecureStore`. Only when `system`, I read the device locale from Hermes's `Intl`.

```ts
function detectSystemLanguage(): "ja" | "en" {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale.toLowerCase().startsWith("ja") ? "ja" : "en";
}
```

In this implementation, I also call `i18n.changeLanguage` the moment the UI changes.

```ts
export async function setLanguagePreference(pref: LanguagePreference) {
  await SecureStore.setItemAsync(LANGUAGE_KEY, pref);
  const language = pref === "system" ? detectSystemLanguage() : pref;
  await i18n.changeLanguage(language);
}
```

## Not Handwriting Dates

Previously, I held months and weekdays in arrays and assembled strings. I replace this with `Intl.DateTimeFormat`.

```ts
export function formatScheduleDate(value: Date, language: string) {
  const locale = language === "ja" ? "ja-JP" : "en-US";

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(value);
}
```

In components, I use `i18n.resolvedLanguage`.

```tsx
const { t, i18n } = useTranslation();
const label = formatScheduleDate(date, i18n.resolvedLanguage ?? "ja");
```

I check `resolvedLanguage` to align with the language i18next actually adopted, including fallbacks.

## Gradually Increasing Translation Coverage

Replacing all screens at once means tracking translation gaps and layout breaks simultaneously. I actually proceeded in the following order:

1. Language saving, dashboard, and tabs
2. Main screens for attendance registration
3. Settings, notifications, admin screens, and date displays

By handling date support last, I could verify it separately from text translation gaps. I check if the weekday changed, if the month-day order changed, and if the layout breaks with long English representations.

Counting only strings passing through the translation function does not determine the completion of multi-language support. Displays generated outside JSON, like dates, times, numbers, and error messages, also need to connect to the language setting.

## References

- [i18next documentation](https://www.i18next.com/)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
