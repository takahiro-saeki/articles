---
title: React Nativeの共有プレビューが画面外へはみ出し、ScrollViewも動かなかった原因
tags:
  - ReactNative
  - Expo
  - ScrollView
  - react-native-view-shot
  - TypeScript
private: false
updated_at: '2026-08-08T09:39:41+09:00'
id: 1704eaa555192befe189
organization_url_name: null
slide: false
ignorePublish: false
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

月次予定を画像化して共有するモーダルで、予定が多い月だけ共有ボタンが画面外へ押し出されました。プレビューは`ScrollView`なのにスクロールもできません。

問題は画像化ではなく、モーダル内で高さが確定していない`ScrollView`へ`flex: 1`を指定したことでした。

## 問題が起きたレイアウト

外側のシートには`maxHeight: "85%"`、内側のプレビューには`flex: 1`を指定していました。

```tsx
<View style={styles.sheet}>
  <Header />
  <ScrollView style={styles.preview}>
    <ShareImagePreview />
  </ScrollView>
  <ShareButton />
</View>
```

```ts
const styles = StyleSheet.create({
  sheet: { maxHeight: "85%" },
  preview: { flex: 1, minHeight: 160 },
});
```

外側はコンテンツ依存の高さで、上限だけが割合指定です。この中では`ScrollView`が使える残り高さを確定できず、内容の全高で描画されました。その結果、シート自体が画面外へ伸びています。

## 画面高から確定値を作る

`useWindowDimensions`で画面高を取得し、プレビューへポイント値の`maxHeight`を渡しました。

```tsx
const { height: windowHeight } = useWindowDimensions();
const previewMaxHeight = Math.max(160, windowHeight * 0.85 - 320);

<ScrollView
  style={[styles.preview, { maxHeight: previewMaxHeight }]}
  contentContainerStyle={styles.previewContent}
>
  <ShareImagePreview />
</ScrollView>
```

`320`はヘッダー、タブ、共有ボタン、余白に使う領域です。厳密なデザイントークンではありませんが、この画面ではシート内の固定部分を差し引く値として扱っています。小さい端末でもプレビューが消えないよう、下限は`160`にしました。

```ts
preview: {
  minHeight: 160,
  borderWidth: 1,
  borderRadius: 10,
}
```

## キャプチャ対象と表示領域は分けて考える

`react-native-view-shot`で長い画像を作る場合、画面上のプレビューサイズと、書き出す画像全体のサイズは同じとは限りません。今回制限したのはモーダル上の閲覧領域です。共有用Viewの内容まで切り詰める変更ではありません。

確認したのは次の3点です。

- 予定が少ない月では余白が不自然に広がらない
- 予定が多い月ではプレビュー内をスクロールできる
- 小さい端末でも共有ボタンへ到達できる

`ScrollView`が動かないとき、まずスクロール設定を疑いたくなります。しかし、親子のどこにも確定した高さがない場合は、スクロールする必要のない大きなViewとして計算されます。モーダル内の割合指定と`flex: 1`が重なっていたら、確定した`height`か`maxHeight`を一度与えると切り分けやすくなります。

## 参考

- [React Native: useWindowDimensions](https://reactnative.dev/docs/usewindowdimensions)
- [React Native: ScrollView](https://reactnative.dev/docs/scrollview)
- [react-native-view-shot](https://github.com/gre/react-native-view-shot)
