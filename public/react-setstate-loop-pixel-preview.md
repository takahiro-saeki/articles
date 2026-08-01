---
title: ReactのsetState無限ループが画像プレビューで起きた原因
tags:
  - React
  - Nextjs
  - TypeScript
  - フロントエンド
  - デバッグ
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: true
posting_campaign_uuid: null
agreed_posting_campaign_term: false
---

ピクセル画像のプレビューで`Maximum update depth exceeded`が発生しました。`useEffect`の依存配列ではなく、キャッシュ済み画像を補完するref callbackと`onLoad`内の`setState`が循環していました。

## 起きていた循環

画像の自然サイズをstateへ保存し、その値から表示倍率を決めています。

```tsx
<PixelImg
  src={src}
  onLoad={(event) => {
    const img = event.currentTarget;
    setDims({ w: img.naturalWidth, h: img.naturalHeight });
  }}
/>
```

`PixelImg`側には、キャッシュ済み画像で通常の`onLoad`を取りこぼす場合の補完がありました。

```tsx
ref={(node) => {
  if (node && onLoad && node.complete && node.naturalWidth > 0) {
    onLoad({ currentTarget: node } as SyntheticEvent<HTMLImageElement>);
  }
}}
```

ref callbackが`onLoad`を呼び、`setDims`が新しいobjectを作ります。再レンダー後にref callbackが再び呼ばれ、同じサイズでもstate更新が続いていました。

## URLごとに補完を1回へ制限する

`PixelImg`では、補完済みの`currentSrc`をrefへ記録します。

```tsx
const firedFor = useRef<string | null>(null);

ref={(node) => {
  if (
    node &&
    onLoad &&
    node.complete &&
    node.naturalWidth > 0 &&
    firedFor.current !== node.currentSrc
  ) {
    firedFor.current = node.currentSrc;
    onLoad({ currentTarget: node } as SyntheticEvent<HTMLImageElement>);
  }
}}
```

画像URLが変わればもう一度発火し、同じURLの再レンダーでは止まります。

## 同じ寸法ならstateを変えない

受け取り側にも防御を入れました。

```tsx
setDims((previous) =>
  previous &&
  previous.w === img.naturalWidth &&
  previous.h === img.naturalHeight
    ? previous
    : { w: img.naturalWidth, h: img.naturalHeight },
);
```

値が同じときは以前の参照を返すため、Reactは再レンダーを省けます。発火元と更新先の両方で止めたのは、どちらかの実装が後から変わっても循環しにくくするためです。

画像読み込み周辺の無限ループでは、`useEffect`だけでなくcallback refも確認対象になります。refはDOM nodeを受け取る場所ですが、その中でstateを変えるとレンダーサイクルへ参加します。特に`complete`を見てイベントを手動発火する実装では、同じリソースへ何度発火したかを記録しておく必要があります。
