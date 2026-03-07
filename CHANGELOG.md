# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-03-03

### Added
- **`sbox_docs_get_page`** — fetch any docs.facepunch.com page and return as Markdown with chunked reading support
- **`sbox_docs_search`** — full-text search across s&box documentation using BFS-crawled MiniSearch index
- In-memory LRU cache with TTL expiration (configurable via env vars)
- HTML→Markdown conversion pipeline (Cheerio + Turndown) with nav/footer stripping
- BFS documentation crawler that discovers internal links and indexes all reachable pages
- Centralized configuration module (`src/lib/config.ts`) reading from environment variables
- Shared singleton instances for cache and search index (`src/lib/instances.ts`)
- 50 unit tests covering cache, fetcher, search index, tools, and schemas

### Changed
- `sbox_api_get_type` now returns a clear "Phase 2" message instead of generic "Not implemented"

## [0.1.0] - 2026-03-03

### Added
- Initial project scaffold with TypeScript + MCP SDK
- 3 MCP tool stubs: `sbox_docs_search`, `sbox_docs_get_page`, `sbox_api_get_type`
- Zod schemas for input validation
- Cache, fetcher, and search index module skeletons
- Project specification (`Spec.md`)
- Git flow: main ← dev ← feature branches
