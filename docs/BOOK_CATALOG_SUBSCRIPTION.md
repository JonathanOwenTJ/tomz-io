# Public book catalog subscription (v1)

The public `/books/catalog.json` is a **derived JSON projection of the already published Book pages**, not a new book manifest or alternate article body.

`scripts/generate-book-catalog.mjs` runs **after the static site and content-time/RSS steps**. It reads the real `/books/` listing order and each `/books/<id>` page's `CollectionPage` JSON-LD, including `mainEntity.ItemList`. This automatically covers native Book entries and external Books imported at exact SHA by the production importer. No second list of books or chapter contents is committed.

Response:

```json
{
  "schemaVersion": 1,
  "source": "https://tomz.io/books/",
  "books": [{
    "id": "agent",
    "title": "一起学智能体",
    "description": "…",
    "url": "https://tomz.io/books/agent",
    "cover": "https://tomz.io/books/covers/agent.webp",
    "entryCount": 13,
    "entries": [{
      "title": "…",
      "url": "https://tomz.io/books/agent/…",
      "position": 1
    }]
  }]
}
```

The canonical contents, authorship, dates and SEO remain owned by `src/pages/books/**` and the original Article/CollectionPage output. It does not expose chapter body, author fields or publication timestamps because they are not guaranteed by the Book `ItemList` contract. `entryCount` is the number of current public index entries; it is not a count of new RSS changes.

An external consumer may periodically `fetch` this static JSON using the site's CORS/HTTP cache policy. In a browser, `ETag` and `Cache-Control` are HTTP/CDN responsibilities. This is **polling of a published JSON feed**, not WebSub/push and not a server-side subscription service. The main `/rss.xml` remains the separate Article update stream (including Book chapters).

Publishing the schema on `main` requires the normal Cloudflare Pages release; a feature branch or local build does **not** change the current `tomz.io` endpoint. Build and check with `pnpm run build && pnpm run verify:static-output`. The production process must execute `external-books:production` before build for external books such as `qishu`.

Book Manifest 可以使用其他合法 HTTPS 封面托管域名；目录保留发布者声明的 URL，不额外限制为 tomz.io 或 assets.tomz.io。已发布博客被逻辑收录为 Book 章节时，条目继续指向原博客 canonical（不复制正文）。

HTTP consumer policy: the published JSON path has a targeted `_headers` rule with `Cache-Control: public, max-age=300, must-revalidate` and exposed ETag/Last-Modified response headers when available. The production Cloudflare site currently already adds `Access-Control-Allow-Origin: *` globally; this PR intentionally does **not** add a second competing ACAO header. After deployment, verify `200`, `application/json`, ACAO, caching, and validators **from the real production URL** before enabling new consumers.
