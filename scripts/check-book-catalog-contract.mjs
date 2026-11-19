import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBookCatalog } from "./generate-book-catalog.mjs";

const root = mkdtempSync(join(tmpdir(), "tomz-book-catalog-contract-"));
const index = join(root, "books/index.html");
const book = join(root, "books/agent/index.html");
mkdirSync(join(root, "books/agent"), { recursive: true });
const listing = '<article class="area-overview-card"><h2><a href="/books/agent">Agent</a></h2></article>';
const base = {
  "@type": "CollectionPage", name: "一起学智能体",
  description: "公开书籍", url: "https://tomz.io/books/agent",
  image: "/books/covers/agent.webp",
  mainEntity: { "@type": "ItemList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "第一篇", url: "https://tomz.io/books/agent/first" },
  ] },
};
function render(value) {
  writeFileSync(index, listing);
  writeFileSync(book, '<script type="application/ld+json">' + JSON.stringify(value) + '</script>');
}
try {
  render(base);
  const result = collectBookCatalog(root);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.books[0].entryCount, 1);
  assert.equal(result.books[0].cover, "https://tomz.io/books/covers/agent.webp");
  assert.equal(result.books[0].entries[0].url, "https://tomz.io/books/agent/first");
  render({ ...base, image: "https://evil.example/cover.webp" });
  assert.throws(() => collectBookCatalog(root), /invalid cover/);
  render({ ...base, url: "https://wrong.example/books/agent" });
  assert.throws(() => collectBookCatalog(root), /invalid canonical/);
  render({ ...base, mainEntity: { "@type": "ItemList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "第一篇", url: "https://tomz.io/books/agent/first" },
    { "@type": "ListItem", position: 2, name: "重复篇", url: "https://tomz.io/books/agent/first" },
  ] } });
  assert.throws(() => collectBookCatalog(root), /Duplicate chapter/);
  console.log("PASS book catalog: source JSON-LD, canonical URLs, cover allowlist, entry uniqueness");
} finally {
  rmSync(root, { recursive: true, force: true });
}

const dist = join(process.cwd(), "dist");
const generated = JSON.parse(readFileSync(join(dist, "books/catalog.json"), "utf8"));
assert.deepEqual(generated, collectBookCatalog(dist));
assert.ok(generated.books.every(book => book.entryCount === book.entries.length));
console.log(`PASS published catalog: ${generated.books.length} books / ${generated.books.reduce((count, book) => count + book.entryCount, 0)} canonical chapters`);
