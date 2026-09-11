---
title: "Expo SecureStoreとAsyncStorageを、秘密情報と復旧方法から使い分ける"
tags:
  - Expo
  - ReactNative
  - SecureStore
  - AsyncStorage
private: false
updated_at: null
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

保存先を選ぶときは、「秘密にする必要があるか」と「読めなくなったらどう戻すか」を別々に決めます。SecureStoreへ保存したことは、再インストールや端末移行を含めて必ず取り出せるという保証にはなりません。

認証トークンは機密性と再認証をセットで考え、言語や表示設定は既定値へ戻せるようにします。保存APIを置き換える際にも、復旧時の動作は別に設計します。

## 今回比較した資料とコード

2026年9月11日に公式資料を確認しました。Expoの[SecureStore最新版ページ](https://docs.expo.dev/versions/latest/sdk/securestore/)は推奨版~57.0.3、[AsyncStorageの利用説明](https://react-native-async-storage.github.io/3.0/api/usage/)は3.0系です。

一方、題材のcircle-hubは固定commit `a34608c`を使います。[モバイルの依存定義](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/package.json)はExpo ~54.0.33、expo-secure-store ~15.0.3で、AsyncStorageの直接依存はありません。現在の公式APIを確認することと、このアプリで移行済みであることを分けています。

[認証処理](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/auth.ts)はSecureStoreへトークンとユーザー情報を保存し、[言語設定](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/i18n.ts)も同じ保存先を使っています。秘密ではない値をSecureStoreへ置くこと自体が、誤りとは限りません。保存先を増やすかは、データ量と復旧動作を見て決めます。

## 暗号化と永続性を一つの条件にしない

[AsyncStorageの公式リポジトリ](https://github.com/react-native-async-storage/async-storage)では、暗号化しない永続的なkey-value保存として説明されています。認証トークンをそのまま置く先としては選びません。

SecureStoreについては、公式資料の次の条件が保存方針に関わります。

| 条件 | 設計への影響 |
| --- | --- |
| OSの安全な保存機構を使う | 小さな秘密情報の保存先候補になる |
| Androidではアンインストールで保持されない | 再認証などの復旧が必要 |
| iOSでは再インストール後も残る場合があるが、依存しない | 削除・再インストールを完全な初期化手順にしない |
| 生体認証の設定変更で読めなくなる条件がある | 認証付き保存では再取得手段を用意する |
| 大きな値はOS側で拒否され得る | 書き込み失敗を扱い、容量を決め打ちしない |

古いiOSの約2048バイトという記述を、全環境での固定上限として使うのも避けます。ここでは容量を実測していません。Androidのバックアップについても、SecureStoreのデータを復元すれば元の鍵で復号できると仮定せず、公式の除外設定を確認します。

## 「値がない」と「読めない」を分ける

元コードのgetTokenは、SecureStore.getItemAsyncの結果をそのまま返します。保存層が例外を返す代替処理を使うと、getTokenもrejectしました。すべての失敗がnullになる実装ではありません。

呼び出し側で復旧を選ぶなら、次のように分ける案があります。これは新しく作ったラッパーで、元コードには適用していません。

```js
async function readSessionToken(store) {
  try {
    const token = await store.getItemAsync("session_token");
    return token === null
      ? { kind: "missing" }
      : { kind: "value", token };
  } catch {
    return { kind: "unavailable" };
  }
}
```

Node.js 24.15.0で、値を返す、nullを返す、例外を返す保存先をそれぞれ渡しました。結果は順にvalue、missing、unavailableで、いずれも読み取りは1回でした。OSの暗号化処理や生体認証を試したものではありません。

valueは、文字列を読めたという意味に限ります。そのトークンが有効か、サーバーが誰として扱うかは別の確認です。unavailableを受け取ったときに、同じ秘密をAsyncStorageへ書き直すフォールバックは入れていません。保存先の障害を理由に、求めていた機密性を変えてしまうためです。

## 設定値なら、既定値へ戻る道を作る

実際の言語設定は、保存値がない、対応外、読み取り失敗のときにsystemへ戻す処理を持っています。復元できる設定値なので、トークンとは失敗時の扱いが違います。

AsyncStorageへ設定を分けるなら、3.0系ではcreateAsyncStorageで保存インスタンスを作るAPIがあります。ただし、現在のアプリにその版が入っているという意味ではありません。Expo SDKと互換性を確認し、追加した版に合わせて使います。

移行では、新しい保存先を先に読み、なければ旧保存先から既知の値だけを取り込み、新しい書き込みの成功後に旧値を消す、といった順序を検討できます。途中で失敗したときの再実行まで決めてから行います。この記事では依存追加もデータ移行もしていません。

## 端末にしかないデータを、復旧可能と決めつけない

言語なら既定値へ戻せます。認証なら再ログインが候補になります。一方、利用者が作った未送信の文章などは、削除すると再取得できるとは限りません。その保存先を決める前に、同期やバックアップの要件を決めます。

今回確認したのは公式仕様、既存コード、読み取り結果を分けるラッパーの3条件です。端末移行、再インストール、生体認証変更、暗号化の実装、保存容量は実機で検証していません。それらの端末依存の動作は、対象環境での確認が残っています。
