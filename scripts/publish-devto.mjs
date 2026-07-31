// dev.to へ記事を投稿/更新するスクリプト。
// 使い方:
//   DEVTO_API_KEY=xxx node scripts/publish-devto.mjs devto/my-article.md
//
// frontmatter:
//   title:         記事タイトル(必須)
//   tags:          カンマ区切り最大4つ(例: react, typescript)
//   canonical_url: 元記事(Zenn/Qiita)のURL。クロスポストなら必ず設定する
//   published:     true で公開、false で下書き(デフォルト false)
//   devto_id:      投稿後に自動で書き込まれる。ある場合は更新になる
import { readFileSync, writeFileSync } from "node:fs";

const apiKey = process.env.DEVTO_API_KEY;
const file = process.argv[2];
if (!apiKey || !file) {
  console.error("Usage: DEVTO_API_KEY=xxx node scripts/publish-devto.mjs <path/to/article.md>");
  process.exit(1);
}

const raw = readFileSync(file, "utf-8");
const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
if (!match) {
  console.error("frontmatter (--- で囲まれたヘッダー) が見つかりません");
  process.exit(1);
}
const [, fmRaw, body] = match;

const fm = {};
for (const line of fmRaw.split("\n")) {
  const m = line.match(/^(\w+):\s*(.*)$/);
  if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!fm.title) {
  console.error("frontmatter に title がありません");
  process.exit(1);
}

const article = {
  title: fm.title,
  body_markdown: body.trim(),
  published: fm.published === "true",
  tags: (fm.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4),
  ...(fm.canonical_url ? { canonical_url: fm.canonical_url } : {}),
};

const isUpdate = Boolean(fm.devto_id);
const url = isUpdate
  ? `https://dev.to/api/articles/${fm.devto_id}`
  : "https://dev.to/api/articles";

const res = await fetch(url, {
  method: isUpdate ? "PUT" : "POST",
  headers: { "api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({ article }),
});

if (!res.ok) {
  console.error(`dev.to API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const result = await res.json();
console.log(`${isUpdate ? "更新" : "投稿"}しました: ${result.url}`);
const isPublished = result.published === true || Boolean(result.published_at);
console.log(`状態: ${isPublished ? "公開" : "下書き"}`);

// 新規投稿時は devto_id を frontmatter に書き戻して、次回から更新にする
if (!isUpdate && result.id) {
  const updated = raw.replace(/^---\n/, `---\ndevto_id: ${result.id}\n`);
  writeFileSync(file, updated);
  console.log(`devto_id: ${result.id} を ${file} に書き込みました`);
}
