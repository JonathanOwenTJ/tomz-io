import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

const SITE = "https://tomz.io";
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const outputPath = fileURLToPath(import.meta.url);

function jsonLd(html) {
  const blocks = [];
  for (const [, source] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const value = JSON.parse(source);
    blocks.push(...(Array.isArray(value) ? value : Array.isArray(value?.["@graph"]) ? value["@graph"] : [value]));
  }
  return blocks;
}

function publicUrl(value, prefix) {
  const url = new URL(value, SITE);
  if (url.origin !== SITE || !url.pathname.startsWith(prefix)
      || url.username || url.password || url.search || url.hash) {
    throw new Error(`Book catalog contains invalid canonical URL: ${value}`);
  }
  return url.toString();
}

function coverUrl(value) {
  if (!value) return null;
  const url = new URL(value, SITE);
  // Book Manifest permits any HTTPS cover publisher; don't narrow that contract.
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`Book catalog contains an invalid cover URL: ${value}`);
  }
  return url.toString();
}

/**
 * The already-built, public CollectionPage JSON-LD is the source of truth.
 * No parallel book manifest parser, RSS parser, or manually maintained catalog.
 */
export function collectBookCatalog(distRoot) {
  const rootIndex = join(distRoot, "books/index.html");
  if (!existsSync(rootIndex)) throw new Error("Missing static bookshelf page");
  const listHtml = readFileSync(rootIndex, "utf8");
  const ids = [...listHtml.matchAll(/<h2>\s*<a href=["'][^"']*\/books\/([a-z0-9-]+)\/?["']/g)]
    .map((m) => m[1]);
  if (!ids.length || new Set(ids).size !== ids.length) {
    throw new Error("Built bookshelf has no unique book listing");
  }
  const books = ids.map((id) => {
    if (!ID.test(id)) throw new Error("Invalid book ID: " + id);
    const pagePath = join(distRoot, "books", id, "index.html");
    if (!existsSync(pagePath)) throw new Error("Missing book page: " + id);
    const page = readFileSync(pagePath, "utf8");
    const meta = jsonLd(page).find((x) => x?.["@type"] === "CollectionPage");
    if (!meta || typeof meta.name !== "string" || !meta.name.trim()) {
      throw new Error("Missing book CollectionPage JSON-LD: " + id);
    }
    const bookUrl = publicUrl(String(meta.url), "/books/");
    if (new URL(bookUrl).pathname.replace(/\/$/, "") !== `/books/${id}`) {
      throw new Error("Book ID does not match canonical: " + id);
    }
    if (meta.mainEntity?.["@type"] !== "ItemList" || !Array.isArray(meta.mainEntity.itemListElement)) {
      throw new Error("Missing chapter ItemList for book: " + id);
    }
    const entries = meta.mainEntity.itemListElement.map((entry, i) => {
      if (!entry || entry["@type"] !== "ListItem" || typeof entry.name !== "string" || !entry.name.trim()
          || entry.position !== i + 1) {
        throw new Error("Invalid chapter at " + id + "/" + i);
      }
      const url = publicUrl(String(entry.url), "/");
      // A Book may logically collect an existing Blog; preserve its canonical.
      if (!new URL(url).pathname.startsWith(`/books/${id}/`)
          && !new URL(url).pathname.startsWith("/blogs/")) {
        throw new Error("Book catalog contains invalid chapter canonical: " + url);
      }
      return { title: entry.name, url, position: entry.position };
    });
    if (new Set(entries.map((entry) => entry.url)).size !== entries.length) {
      throw new Error("Duplicate chapter in " + id);
    }
    return {
      id,
      title: meta.name,
      description: String(meta.description || ""),
      url: bookUrl,
      cover: coverUrl(meta.image),
      entryCount: entries.length,
      entries,
    };
  });
  return { schemaVersion: 1, source: `${SITE}/books/`, books };
}

if (process.argv[1] && resolve(process.argv[1]) === outputPath) {
  const dist = resolve(process.cwd(), "dist");
  const catalog = collectBookCatalog(dist);
  const target = join(dist, "books/catalog.json");
  writeFileSync(target, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Book catalog generated: ${catalog.books.length} books, ${catalog.books.reduce((n, b) => n + b.entryCount, 0)} chapters -> ${target}`);
}
