---
title: i18nextで文言だけでなく日付フォーマットも言語切り替えへ対応する
tags:
  - i18next
  - reactnative
  - expo
  - TypeScript
  - I18n
private: false
updated_at: '2026-08-12T13:43:30+09:00'
id: e0b48ea5b3a0e5ae6b51
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

React Nativeアプリへ`i18next`を導入したあとも、画面には`7月24日(金)`のような日本語の日付が残っていました。翻訳JSONを増やすだけでは、`Date`を直接整形している箇所は変わりません。

文言と日付が別々の言語にならないよう、言語判定を共通化して`Intl.DateTimeFormat`へ渡しました。

## 言語設定は3種類にする

設定値は日本語、英語、端末に従う、の3種類です。

```ts
export type LanguagePreference = "system" | "ja" | "en";
```

ユーザーの選択は`SecureStore`へ保存します。`system`の場合だけ、Hermesの`Intl`から端末ロケールを読み取ります。

```ts
function detectSystemLanguage(): "ja" | "en" {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale.toLowerCase().startsWith("ja") ? "ja" : "en";
}
```

この実装では、UIを変えた瞬間に`i18n.changeLanguage`も呼びます。

```ts
export async function setLanguagePreference(pref: LanguagePreference) {
  await SecureStore.setItemAsync(LANGUAGE_KEY, pref);
  const language = pref === "system" ? detectSystemLanguage() : pref;
  await i18n.changeLanguage(language);
}
```

## 日付を手書きしない

以前は月や曜日を配列で持ち、文字列を組み立てていました。これを`Intl.DateTimeFormat`へ置き換えます。

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

コンポーネントでは`i18n.resolvedLanguage`を使います。

```tsx
const { t, i18n } = useTranslation();
const label = formatScheduleDate(date, i18n.resolvedLanguage ?? "ja");
```

`resolvedLanguage`を見るのは、フォールバックを含めてi18nextが実際に採用した言語へ揃えるためです。

## 翻訳対象を段階的に増やす

全画面を一度に置き換えると、翻訳漏れと画面崩れを同時に追うことになります。実際には次の順で進めました。

1. 言語保存とダッシュボード、タブ
2. 出欠登録の主要画面
3. 設定、通知、管理画面と日付表示

日付対応を最後に回したことで、文字列の翻訳漏れとは別に確認できました。曜日が変わったか、月日の順序が変わったか、長い英語表記でレイアウトが崩れないかを見ます。

翻訳関数を通している文字列だけを数えても、多言語対応の完了判定にはなりません。日付、時刻、数値、エラーメッセージのように、JSONの外で生成する表示も言語設定へつなぐ必要があります。

## 参考

- [i18next documentation](https://www.i18next.com/)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
