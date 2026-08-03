import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const args = new Set(process.argv.slice(2));
const dateArg = process.argv.find((arg) => arg.startsWith("--date="))?.slice(7);
const dryRun = args.has("--dry-run");
const today = dateArg ?? new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const schedule = JSON.parse(readFileSync("schedule/publishing-schedule.json", "utf8"));
const entry = schedule.find((item) => item.date === today);
if (!entry) {
  console.log(`${today}: scheduled article not found`);
  process.exit(0);
}

function splitMarkdown(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("frontmatter not found");
  return { frontmatter: match[1], body: match[2].trim() };
}

function field(frontmatter, name) {
  return frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, "m"))?.[1]
    ?.replace(/^["']|["']$/g, "");
}

function setField(raw, name, value) {
  const pattern = new RegExp(`^${name}:.*$`, "m");
  if (pattern.test(raw)) return raw.replace(pattern, `${name}: ${value}`);
  return raw.replace(/^---\n/, `---\n${name}: ${value}\n`);
}

function qiitaTags(frontmatter) {
  const block = frontmatter.match(/^tags:\n((?:\s+-\s+.*\n?)+)/m)?.[1] ?? "";
  return [...block.matchAll(/^\s+-\s+(.+)$/gm)].map((match) => ({ name: match[1].trim() }));
}

async function publishQiita(sourcePath, raw) {
  const token = process.env.QIITA_TOKEN;
  if (!token) throw new Error("QIITA_TOKEN is not set");
  const { frontmatter, body } = splitMarkdown(raw);
  const existingId = field(frontmatter, "id");
  const hasId = existingId && existingId !== "null";
  const response = await fetch(
    hasId ? `https://qiita.com/api/v2/items/${existingId}` : "https://qiita.com/api/v2/items",
    {
      method: hasId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: field(frontmatter, "title"),
        body,
        private: field(frontmatter, "private") === "true",
        tags: qiitaTags(frontmatter),
      }),
    },
  );
  if (!response.ok) throw new Error(`Qiita API ${response.status}: ${await response.text()}`);
  const result = await response.json();
  let updated = setField(raw, "id", result.id);
  updated = setField(updated, "ignorePublish", "false");
  updated = setField(updated, "updated_at", `'${result.updated_at}'`);
  writeFileSync(sourcePath, updated);
  return result.url;
}

async function publishDevto(path, raw, canonicalUrl) {
  const token = process.env.DEVTO_API_KEY;
  if (!token) throw new Error("DEVTO_API_KEY is not set");
  let updated = setField(raw, "canonical_url", canonicalUrl);
  updated = setField(updated, "published", "true");
  const { frontmatter, body } = splitMarkdown(updated);
  const existingId = field(frontmatter, "devto_id");
  const payload = {
    article: {
      title: field(frontmatter, "title"),
      body_markdown: body,
      published: true,
      canonical_url: canonicalUrl,
      tags: (field(frontmatter, "tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 4),
    },
  };
  const response = await fetch(
    existingId ? `https://dev.to/api/articles/${existingId}` : "https://dev.to/api/articles",
    {
      method: existingId ? "PUT" : "POST",
      headers: { "api-key": token, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw new Error(`dev.to API ${response.status}: ${await response.text()}`);
  const result = await response.json();
  if (!existingId) updated = setField(updated, "devto_id", result.id);
  writeFileSync(path, updated);
  return result.url;
}

const sourceRaw = readFileSync(entry.source, "utf8");
const devtoRaw = readFileSync(entry.devto, "utf8");
const sourceSlug = basename(entry.source, ".md");

const sourceFrontmatter = splitMarkdown(sourceRaw).frontmatter;
const devtoFrontmatter = splitMarkdown(devtoRaw).frontmatter;
const sourceIsPublished = entry.platform === "qiita"
  ? field(sourceFrontmatter, "ignorePublish") === "false" && Boolean(field(sourceFrontmatter, "id")) && field(sourceFrontmatter, "id") !== "null"
  : field(sourceFrontmatter, "published") === "true";
const devtoIsPublished = field(devtoFrontmatter, "published") === "true" && Boolean(field(devtoFrontmatter, "devto_id"));

if (dryRun) {
  console.log(JSON.stringify({ today, ...entry, sourceSlug, sourceIsPublished, devtoIsPublished }, null, 2));
  process.exit(0);
}

if (sourceIsPublished && devtoIsPublished) {
  console.log(`${today}: both articles are already published`);
  process.exit(0);
}

let canonicalUrl;
if (entry.platform === "qiita") {
  canonicalUrl = await publishQiita(entry.source, sourceRaw);
} else if (entry.platform === "zenn") {
  canonicalUrl = `https://zenn.dev/hirodeath/articles/${sourceSlug}`;
  writeFileSync(entry.source, setField(sourceRaw, "published", "true"));
} else {
  throw new Error(`unsupported platform: ${entry.platform}`);
}

const devtoUrl = await publishDevto(entry.devto, devtoRaw, canonicalUrl);
console.log(JSON.stringify({ date: today, platform: entry.platform, canonicalUrl, devtoUrl }));
