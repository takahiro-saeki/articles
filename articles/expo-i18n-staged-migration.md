---
title: "Expoアプリを日本語から日英中対応へ段階的に移行した記録"
emoji: "🌏"
type: "tech"
topics: ["expo", "reactnative", "i18next", "i18n", "typescript"]
published: true
---

日本語だけで作っていたExpoアプリを、日本語、英語、中国語簡体字へ移行しました。全画面を一度に翻訳せず、基盤、主要フロー、残りの画面という3段階に分けています。

翻訳文を用意する作業より難しかったのは、端末言語と手動設定の優先順位、日付表示、翻訳途中の画面をどう扱うかでした。

## 最初に言語設定の責務を決めた

使用したのは`i18next`と`react-i18next`です。端末言語の取得にはHermesの`Intl`を使いました。

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

設定画面で選んだ値は`SecureStore`へ保存します。保存値が`system`なら端末設定、具体的な言語なら手動設定を優先します。

```ts
export async function setLanguagePreference(pref: LanguagePreference) {
  await SecureStore.setItemAsync(LANGUAGE_PREF_KEY, pref);
  await i18n.changeLanguage(pref === "system" ? detectDeviceLanguage() : pref);
}
```

初回描画は同期的に初期化し、保存済み設定を後から読みます。設定読込のためだけに起動画面を止めない方針にしました。

## Stage 1は共通UIだけ

最初はボトムナビ、ダッシュボード、設定画面の言語選択だけを対象にしました。

```tsx
const { t } = useTranslation();

<Text>{t("dashboard.title")}</Text>
```

ここで一つ不具合が見つかりました。ボトムナビが表示ラベルをアクティブ判定にも使っていたため、翻訳すると判定が壊れます。表示文言とは別に固定の`key`を持たせました。

```ts
type TabItem = {
  key: "home" | "schedules" | "notifications" | "settings";
  label: string;
  href: Href;
};
```

翻訳前は気づきにくいものの、ラベルを識別子として使う設計は多言語化で表面化します。

## Stage 2は出欠の主要フロー

次に日程一覧、日程詳細、出欠登録を移行しました。この段階では、ユーザーが日常的に通る操作を一つの言語で完結できる状態を目標にしています。

翻訳キーは画面単位に分けました。

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

ステータス値はAPIと共通の英語識別子を維持し、表示だけ翻訳します。DBへ日本語ラベルを保存しないため、言語を増やしてもデータ移行は不要です。

## Stage 3で日付と残りの画面を移した

最後に管理画面、通知、問い合わせ、空状態、エラー文言を置き換えました。同時に日付表示も`Intl.DateTimeFormat`へ寄せています。

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

翻訳JSONだけを見ていると、曜日、日時、API由来のエラーが抜けます。画面ごとの確認表には「固定文言」「日付」「サーバーエラー」「空状態」を分けて載せました。

## Webとは言語決定の入口が違う

Webでは`Accept-Language`やURLのlocaleを使えます。共有URLを考えると、`/en/...`のようにURLへlocaleを含める方法は、受け取った相手にも同じ言語を見せやすい利点があります。

一方、モバイルには毎回のURLがありません。端末設定を初期値にし、アプリ内の手動設定を優先する方が自然でした。Webとモバイルで翻訳データを共有するとしても、言語を決める処理まで同じにする必要はありません。

段階移行の途中では日本語が混ざります。それでも、主要フローを区切って完成させる方が、全画面へキーだけ置いて検証しきれない状態より進めやすく感じました。

## 参考

- [i18next](https://www.i18next.com/)
- [React i18next](https://react.i18next.com/)
- [Next.js: Internationalization](https://nextjs.org/docs/app/guides/internationalization)
