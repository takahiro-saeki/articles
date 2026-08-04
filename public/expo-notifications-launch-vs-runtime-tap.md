---
title: expo-notificationsで「通知から起動」と「起動後の通知タップ」を分けて処理する
tags:
  - Expo
  - ReactNative
  - expo-notifications
  - ExpoRouter
  - Push通知
private: false
updated_at: '2026-08-04T10:02:53+09:00'
id: f4eb6cb33972bb3ab15e
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

Push通知をタップしたときの処理は、アプリが起動しているかどうかで入口が変わります。Expo Routerで通知先の画面へ移動する場合、1つのlistenerだけでは終了状態からの起動を拾えないことがあります。

私のアプリでは、起動時と起動後を次の2つで処理しています。

- `getLastNotificationResponseAsync()`: 通知タップからアプリが起動した場合
- `addNotificationResponseReceivedListener()`: 起動後に通知がタップされた場合

## 通知データの形を決める

サーバーから送る通知には、遷移先を`data.url`へ入れています。

```ts
{
  title: "出欠締切のお知らせ",
  body: "明日の練習の出欠を確認してください",
  data: {
    url: "/organizations/org_123/schedules/schedule_456"
  }
}
```

表示用の`title`や`body`を解析して遷移先を決めるのではなく、アプリが扱えるpathを別データとして渡します。

## 通知から起動された場合

アプリが終了している状態では、起動後に最後の通知レスポンスを確認します。

```ts
void Notifications.getLastNotificationResponseAsync().then((response) => {
  if (response) {
    handleNotificationTap(response.notification);
  }
});
```

この処理は非同期です。認証確認やNavigatorの準備前に`router.push`すると遷移が競合することがあるため、私のアプリではログイン確認が終わってから実行しています。

```ts
useRegisterPushToken(authChecked);
```

## 起動後に通知をタップした場合

バックグラウンドまたはフォアグラウンドから通知をタップした場合はlistenerで受け取ります。

```ts
const subscription =
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(response.notification);
  });

return () => subscription.remove();
```

画面の再マウントやFast Refreshでlistenerが重複しないよう、cleanupで`remove()`を呼びます。

## 2つの入口を同じ関数へ集める

入口は違っても、通知データの検証と遷移は共通です。

```ts
function handleNotificationTap(notification: Notifications.Notification) {
  const data = notification.request.content.data as
    | { url?: string; linkUrl?: string }
    | null;

  const raw = data?.url ?? data?.linkUrl;
  if (!raw) return;

  const path = raw.startsWith("/")
    ? raw
    : (raw.match(/^https?:\/\/[^/]+(\/.+)$/)?.[1] ?? null);

  if (!path) return;
  router.push(path as never);
}
```

過去に送った通知との互換性を残すため、`url`と`linkUrl`の両方を受けています。新規実装ならキーは1つに決めた方が単純です。

また、外部から渡されるURLをそのまま`router.push`しない方が安全です。許可するhostとpathの形式を決め、アプリ内ルートへ変換してから渡します。

## 通知を受信しただけでは遷移しない

`addNotificationReceivedListener`と`addNotificationResponseReceivedListener`は用途が違います。

```ts
Notifications.addNotificationReceivedListener((notification) => {
  // 通知を受信したとき
});

Notifications.addNotificationResponseReceivedListener((response) => {
  // ユーザーが通知をタップしたとき
});
```

通知が届いただけで画面を切り替えると、ユーザーが入力中の画面を失う可能性があります。私のアプリでは、画面遷移はタップ後のresponseだけで行います。

## まとめたフック

実際の構成を簡略化すると次の形です。

```ts
export function useNotificationNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let active = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) {
        handleNotificationTap(response.notification);
      }
    });

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationTap(response.notification);
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [enabled]);
}
```

終了状態からの起動と、起動後のタップを同じものとして扱うのではなく、入口だけ分けて最後に同じ遷移関数へ渡すと整理しやすくなりました。

## 参考

- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo: Handle incoming notifications](https://docs.expo.dev/push-notifications/receiving-notifications/)

