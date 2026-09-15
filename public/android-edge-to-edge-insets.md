---
title: "AndroidのSafe Areaがずれたら、Insetsを適用しているコンポーネントから調べる"
tags:
  - Android
  - ReactNative
  - Expo
private: false
updated_at: '2026-09-15T11:03:32+09:00'
id: d12f32ce2d2ae999126f
organization_url_name: null
slide: false
ignorePublish: false
---

画面下の余白を直す前に、`insets.bottom`を誰が使っているかを確認します。親の`SafeAreaView`と子の`paddingBottom`が同じ領域を避けているなら、ライブラリの値が正しくても余白が余分に付く可能性があります。

この記事はSquadNoteのコードを読み直した調査手順です。実機で特定の余白バグを再現・修正した報告ではありません。対象は`circle-hub`のコミット`31e560d`、Expo SDK 54、React Native `0.81.5`、`react-native-safe-area-context`の指定`~5.6.0`です。2026年9月11日に確認しました。

## OSの条件と、アプリの設定を分けて確認する

[Androidの公式説明](https://developer.android.com/develop/ui/views/layout/edge-to-edge)では、Android 15以降の端末でtarget SDKが35以上の場合、edge-to-edge表示が適用されます。端末のOSだけでなく、アプリのtarget SDKも条件に含まれます。

SquadNoteの設定には`edgeToEdgeEnabled: true`があります。これを見つけただけでは、操作ボタンをシステムバーから避ける処理まで確認したことにはなりません。背景を端まで描く設定と、操作領域にInsetsを反映する処理を追います。

また、システムバー、画面の切り欠き、システムのジェスチャー領域は同じ分類ではありません。今回のReact Nativeコードはライブラリが提供する上下のInsetsを使っています。取得値が実機でどう変わるかは、ナビゲーション方式や向きも揃えて別途確認する必要があります。

## Providerと余白を付けるViewを区別する

認証後の画面構造を、関連部分だけにすると次の形です。

```text
SafeAreaProvider
  View
    Header       → paddingTop: insets.top
    View / Stack → 各画面
    BottomNav    → paddingBottom: insets.bottom
```

`SafeAreaProvider`があることと、すべての子画面へ余白を付けることは別です。公式ライブラリの[SafeAreaProvider](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-provider/)と[SafeAreaView](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-view/)を確認すると、値を提供する役割と、Insetsを余白として反映する役割を分けて読めます。

実装のBottomNavは、外側に下のInsets、内側にナビゲーション本体の高さを持ちます。

```tsx
const insets = useSafeAreaInsets();

return (
  <View style={[styles.container, { paddingBottom: insets.bottom }]}>
    <View style={{ height: layout.bottomNavHeight }}>
      {/* Navigation items */}
    </View>
  </View>
);
```

これは実コードから配置だけを残した抜粋です。ボタンや配色の定義は省略しています。内側の高さと外側の余白を分けるので、下端を避けるためにボタン自体の高さを変更する必要はありません。

一方、公開用のルートグループはHeaderとBottomNavを持たず、`SafeAreaView`でStackを囲みます。同じアプリ内でも、ルートグループによって余白の担当が違いました。

## 二重適用を疑うときは、同じ辺を辿る

認証後の画面に、さらに下辺を含む`SafeAreaView`を追加したとします。実際に余白が重なるかはProviderの位置や画面の領域に依存するため、コンポーネント名だけで断定はできません。確認するのは、親子が同じ下辺の領域を避ける設定になっているかです。

調査時には、次の情報を一つの画面について揃えます。

| 確認するもの | 調べる場所 |
| --- | --- |
| Insetsの基準となる領域 | 最寄りのSafeAreaProviderとその配置 |
| 上下どの辺を反映するか | SafeAreaViewの`edges` |
| 手動の加算 | `paddingTop`、`paddingBottom`、margin |
| 別の領域へ移る箇所 | モーダルや別ルートのProvider/レイアウト |
| 実際の値と描画 | 対象端末のInsets、コンテナ境界、ボタン位置 |

ライブラリのSafeAreaViewは、通常の加算モードでは指定したpaddingにInsetsを加えます。たとえばpaddingが16、bottom insetが24なら40になります。この値は説明用の例で、今回の実機から測った値ではありません。

`edges`を外すか、手動paddingを外すかは、どちらのコンポーネントがその辺を担当するかで決めます。値が大きく見えるたびに固定値で引き算すると、ナビゲーション方式や画面方向が変わったときの前提が残りません。

## 起動クラッシュを余白の問題として扱わない

調査の入口になった作業コピーの名前は`android-safe-area-hotfix`でした。しかし、[実際の修正コミット](https://github.com/takahiro-saeki/circle-hub/commit/31e560d)が変更しているのは、safe-area-contextの依存指定、lockfile、QAビルド設定とテストです。Insetsやpaddingを変更する差分ではありません。

対象の自動テストをNode.js `v24.15.0`、Vitest `4.1.4`で再実行すると、2件とも通りました。ただし内容は依存指定とQA設定の確認です。

```bash
pnpm --filter @squadnote/mobile exec vitest run src/lib/android-native-runtime.test.ts
```

この成功から、画面の余白が正しいことや、実機起動クラッシュが再発しないことまでは言えません。画面が開く前に落ちるならネイティブ側のエラーを先に確認し、画面が開いて配置がずれるなら余白の適用箇所を追います。

認証後の画面と公開画面では、Insetsを適用する箇所が違いました。調整するときは対象ルートを決め、そのルートで下辺を扱うコンポーネントを特定してから、実機の値と位置を照合します。
