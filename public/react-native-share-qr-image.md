---
title: React Nativeで招待QRコードをPNGにして共有する
tags:
  - ReactNative
  - Expo
  - QRCode
  - TypeScript
  - iOS
private: false
updated_at: '2026-08-07T11:46:33+09:00'
id: 3dd9bb25393a1bf704f6
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

アプリの招待リンクをQRコードで表示し、そのまま画像として共有できるようにしました。

QRコードの表示には`react-native-qrcode-svg`、ViewのPNG化には`react-native-view-shot`、共有シートには`expo-sharing`を使っています。

```bash
npx expo install expo-sharing react-native-view-shot
pnpm add react-native-qrcode-svg react-native-svg
```

## QRコードだけでなく団体名も画像へ入れる

共有された画像だけを見ても内容が分かるよう、QRコードと団体名を1つのViewへ入れています。

```tsx
const captureAreaRef = useRef<View>(null);

<View
  ref={captureAreaRef}
  collapsable={false}
  style={styles.captureArea}
>
  <Text style={styles.orgName}>{orgName}</Text>
  <QRCode
    value={inviteUrl}
    size={200}
    color={colors.foreground}
    backgroundColor={colors.card}
  />
</View>
```

`collapsable={false}`を付けているのは、React NativeがネイティブViewを最適化で省略し、`captureRef`の対象を取得できなくなるのを避けるためです。

背景色も明示しています。透過画像のまま共有先の背景が暗いと、QRコードの余白や団体名が読みにくくなるためです。

## ViewをPNGとして保存する

共有ボタンでは`captureRef`へViewのrefを渡します。

```ts
const captured = await captureRef(captureAreaRef, {
  format: "png",
  quality: 1,
});
```

返ってきた値は一時ファイルのパスです。Androidではschemeなしのパスが返る場合があったため、共有前に`file://`を補っています。

```ts
const uri = captured.startsWith("file://")
  ? captured
  : `file://${captured}`;
```

## `expo-sharing`で共有する

端末で共有機能を利用できるか確認してから共有シートを開きます。

```ts
if (await Sharing.isAvailableAsync()) {
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: `${orgName}の招待QRコード`,
  });
} else {
  await Share.share({ url: uri });
}
```

実際の処理では、連打で複数の共有処理が始まらないようstateも持たせています。

```ts
const [sharing, setSharing] = useState(false);

const handleShareImage = async () => {
  if (sharing) return;
  setSharing(true);

  try {
    // captureRefとshareAsync
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert("共有に失敗しました", message);
  } finally {
    setSharing(false);
  }
};
```

処理中はボタンをdisabledにし、ラベルを「共有の準備中」に切り替えています。キャプチャから共有シートが開くまで少し間があるため、無反応に見せないための対応です。

## QRコードへ何を入れるか

QRコードにはcustom schemeではなく、Webでも開けるHTTPSの招待URLを入れています。

```ts
const inviteUrl = `${config.apiUrl}/invite/${orgId}`;
```

iOSではUniversal Linksを設定しているため、アプリが入っていれば招待画面をアプリで開きます。アプリがなければWeb版を表示します。

QR画像はスクリーンショットではありません。キャプチャ対象を専用のViewへ限定しているので、モーダルの閉じるボタンや「画像を共有」ボタンは画像に入りません。

## 実装全体

要点をまとめると次の形です。

```tsx
export function InviteQrModal({ orgName, inviteUrl }: Props) {
  const captureAreaRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const path = await captureRef(captureAreaRef, {
        format: "png",
        quality: 1,
      });
      const uri = path.startsWith("file://") ? path : `file://${path}`;
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <View ref={captureAreaRef} collapsable={false}>
        <Text>{orgName}</Text>
        <QRCode value={inviteUrl} size={200} />
      </View>
      <Pressable onPress={share} disabled={sharing}>
        <Text>{sharing ? "共有の準備中..." : "画像を共有"}</Text>
      </Pressable>
    </>
  );
}
```

QRコードのSVGを直接ファイルへ変換するより、表示用のViewをそのままキャプチャする方が、団体名や説明を含めた共有画像を作りやすい構成でした。

## 参考

- [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)
- [react-native-view-shot](https://github.com/gre/react-native-view-shot)
- [react-native-qrcode-svg](https://github.com/Expensify/react-native-qrcode-svg)

