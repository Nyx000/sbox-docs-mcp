# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**sbox-docs-mcp** — MCP server that exposes s&box (Facepunch Studios) documentation to AI assistants. Three tools: search docs, fetch pages, query API types. Currently scaffolded with TODO stubs — implementation pending.

See `Spec.md` for full specification (research, architecture, schemas, roadmap).

## Commands

```bash
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode (tsc --watch)
npm start            # Run the MCP server (stdio transport)
npx tsc --noEmit     # Type-check without emitting
```

## Architecture

```
src/
├── index.ts              # Entry point — McpServer + 3 tool registrations
├── schemas/index.ts      # Zod schemas for all tool inputs (source of truth)
├── tools/
│   ├── search-docs.ts    # sbox_docs_search → uses SearchIndex
│   ├── get-page.ts       # sbox_docs_get_page → uses fetcher + Cache
│   └── get-api-type.ts   # sbox_api_get_type → uses fetcher + Cache
└── lib/
    ├── cache.ts          # In-memory LRU cache with TTL expiration
    ├── fetcher.ts        # HTTP fetch + HTML→Markdown (cheerio + turndown)
    └── search-index.ts   # Full-text search index (minisearch)
```

**Data flow:** Tool receives validated params → checks Cache → on miss, Fetcher scrapes source → converts HTML to Markdown → stores in Cache → returns to MCP client.

**Documentation sources:**
- `docs.facepunch.com/s/sbox-dev` — narrative docs (HTML, direct fetch)
- `sbox.game/api` — API reference (JS-rendered, needs alternative strategy — see Spec.md §3)

## Key Patterns

- **ESM only** — `"type": "module"` in package.json, use `.js` extensions in imports
- **MCP SDK** — `@modelcontextprotocol/sdk`, tools registered via `server.tool(name, description, schema.shape, handler)`
- **Zod schemas** — defined in `src/schemas/index.ts`, tool handlers receive pre-validated params
- **Transport** — stdio (StdioServerTransport) for universal client compatibility

## Git Flow

```
main                        # Production stable — jamais de commit direct
  └── dev                   # Développement — intégration des features
       ├── feature/xxx      # Nouvelles fonctionnalités
       ├── fix/xxx          # Corrections de bugs
       └── refactor/xxx     # Refactoring
```

**Workflow obligatoire :**

1. **Créer une branche depuis `dev`** : `git checkout -b feature/nom-feature dev`
2. **Commits atomiques** avec Conventional Commits : `feat:`, `fix:`, `refactor:`
3. **PR vers `dev`** : `gh pr create -B dev`
4. **Review + merge sur `dev`**
5. **Quand `dev` est stable** → PR de `dev` vers `main` : `gh pr create -B main`

**Règles :**
- Ne JAMAIS commit directement sur `main` ou `dev`
- Toute modification passe par une branche `feature/`, `fix/`, ou `refactor/` depuis `dev`
- Tester sur la branche avant la PR vers `dev`
- Tester sur `dev` avant la PR vers `main`

## Changelog & Versioning

**Semantic Versioning (semver) :**
```
MAJOR.MINOR.PATCH (ex: 0.2.1)
├── MAJOR : Breaking changes
├── MINOR : Nouvelles features
└── PATCH : Bug fixes, petites améliorations
```

**Règles :**
- Chaque PR mergée sur `dev` = nouvelle entrée dans `CHANGELOG.md` + bump de version dans `package.json`
- `feat:` → bump MINOR (0.1.0 → 0.2.0)
- `fix:` → bump PATCH (0.2.0 → 0.2.1)
- Breaking change → bump MAJOR (0.2.1 → 1.0.0)
- Le changelog suit le format [Keep a Changelog](https://keepachangelog.com/)
- Entrées triées par date DESC (plus récente en premier)
- Description orientée utilisateur, pas technique

## Tests

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
```

**Règles strictes :**
- Les tests DOIVENT passer avant toute PR
- Ne JAMAIS modifier un test pour le faire passer — corriger le code source
- Ne pas s'arrêter tant que tous les tests ne passent pas
- Chaque nouvelle feature/fix doit avoir ses tests correspondants
- Les tests vivent dans `src/__tests__/` en miroir de la structure `src/`

## Documentation

**Fichiers docs maintenus :**
- `README.md` — présentation projet, installation, usage
- `CHANGELOG.md` — historique des changements (mis à jour à chaque PR)
- `CLAUDE.md` — instructions pour Claude Code (ce fichier)
- `Spec.md` — spécification technique complète

**Règles :**
- Mettre à jour la documentation concernée dans la même PR que le code
- Ne pas créer de fichiers `.md` supplémentaires à la racine sans raison

## Environment Variables

All optional with sensible defaults — see `.env.example`:
- `SBOX_DOCS_CACHE_TTL` — cache TTL in seconds (default: 14400 = 4h)
- `SBOX_DOCS_MAX_CACHE_ENTRIES` — LRU cache limit (default: 500)
- `SBOX_DOCS_REQUEST_TIMEOUT` — HTTP timeout in ms (default: 10000)
- `SBOX_DOCS_USER_AGENT` — User-Agent header for requests
