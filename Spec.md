# sbox-docs-mcp — Spécification

> Serveur MCP permettant à l'IA de rechercher et lire la documentation s&box (Facepunch Studios).

---

## 1. Résumé

### Problème

s&box est un moteur de jeu basé sur Source 2 avec une couche C#/.NET open-source. Sa documentation est :

- **Dispersée** sur plusieurs surfaces (docs.facepunch.com, sbox.game/api, wiki.facepunch.com)
- **Incomplète** — la communauté a signalé des lacunes majeures ([issue #6850](https://github.com/Facepunch/sbox-issues/issues/6850)) : XML summaries manquants, recherche cassée, références brisées
- **Inaccessible à l'IA** — aucun MCP de documentation n'existe (le MCP existant de [suiramdev](https://github.com/suiramdev/sbox-mcp-server) est un outil d'automatisation de l'éditeur)

### Solution

Un serveur MCP qui expose 3 tools permettant à l'IA de :
- **Chercher** dans la documentation narrative
- **Lire** une page de documentation complète (convertie en Markdown)
- **Consulter** la référence API d'un type/classe spécifique

### Public cible

Développeurs utilisant un assistant IA (Claude, Cursor, VS Code + Copilot) pour développer des jeux/expériences sur s&box en C#.

---

## 2. Recherche & Faisabilité

### État des lieux documentation s&box

| Surface | URL | Type | Accès |
|---|---|---|---|
| Docs officielles | `docs.facepunch.com/s/sbox-dev` | Narratif (GitBook) | Public, HTML statique |
| API Reference | `sbox.game/api` | Référence (3,157 types, 28,115 membres) | Public, JS-rendered |
| Ancien wiki | `wiki.facepunch.com/sbox` | Wiki (CMS custom) | Public, HTML simple |
| Code source | `github.com/Facepunch/sbox-public` | C# avec XML doc comments | Public, MIT |

**Lacunes connues :**
- API reference : XML summaries manquants sur de nombreuses méthodes
- Recherche sur sbox.game/api : cassée/limitée
- Pas de sitemap.xml sur docs.facepunch.com
- sbox.game/api est JS-rendered (requiert un token CSRF, scraping non-trivial)

### MCPs similaires existants

| Projet | Cible | Approche |
|---|---|---|
| [godot-docs-mcp](https://github.com/james2doyle/godot-docs-mcp) (james2doyle) | Docs Godot | Search index (`searchindex.js`) + minisearch, Cloudflare Workers |
| [godot-docs-mcp](https://github.com/nuskey8/godot-docs-mcp) (nuskey8) | Docs Godot | 3 tools : search, get_page, get_class |
| [godot-doc-mcp](https://github.com/tkmct/godot-doc-mcp) (tkmct) | Docs Godot | Offline, `/doc` local, stdio |
| [Microsoft Learn MCP](https://github.com/MicrosoftDocs/mcp) | Docs Microsoft | `search` + `fetch` + `code_sample_search` |
| [docs-mcp-server](https://github.com/arabold/docs-mcp-server) (arabold) | Multi-sources | RAG complet avec embeddings + SQLite |
| [mcp-server-fetch](https://github.com/modelcontextprotocol/servers) (officiel) | Web générique | Fetch + HTML-to-Markdown, chunking via `start_index` |

### Conclusion faisabilité

**100% faisable.** Le pattern est mature, bien documenté, et prouvé par au moins 6 implémentations similaires. La documentation s&box est publiquement accessible. Le SDK MCP TypeScript est stable (v1.24.x).

---

## 3. Sources ciblées

### Source A : docs.facepunch.com/s/sbox-dev

**Type :** Documentation narrative (tutoriels, guides, concepts)

**Structure :**
```
docs.facepunch.com/s/sbox-dev/
├── About/        → Présentation, architecture moteur
├── Code/         → C# scripting, composants, attributs, fichiers
├── Systems/      → ActionGraph, networking, physique, audio
├── Scene/        → GameObjects, scènes, éditeur
├── Editor/       → Projets éditeur, éditeurs custom, Model Editor
└── Assets/       → Gestion assets, matériaux, textures
```

**URL pattern :** `docs.facepunch.com/s/sbox-dev/doc/{title-slug}-{alphanumeric-id}`

**Stratégie de scraping :**
- Fetch HTTP direct (pages HTML statiques, pas de JS requis)
- Conversion HTML → Markdown via Turndown + Cheerio
- Extraction du contenu principal (ignorer nav, sidebar, footer)
- Pas de sitemap disponible → construction manuelle d'un index des pages connues, ou crawl des liens internes

### Source B : sbox.game/api

**Type :** Référence API (3,157 types, 28,115 membres, 6 assemblies)

**Difficulté :** Le site est JS-rendered avec un token CSRF. Le scraping direct via fetch HTTP ne retourne pas le contenu.

**Stratégies possibles (par ordre de préférence) :**

1. **XML doc comments depuis le code source** (recommandé)
   - Le repo `Facepunch/sbox-public` (MIT) contient les fichiers C# avec `///` XML comments
   - Extraire les summaries, paramètres, returns directement depuis le source
   - Avantage : données structurées, pas de scraping web

2. **Headless browser (Puppeteer/Playwright)**
   - Render les pages JS, extraire le DOM résultant
   - Lourd mais fiable

3. **Proxy via sbox.guide** (non-officiel)
   - Site communautaire avec 3,157 types documentés
   - Risque : maintenance par un tiers, peut devenir indisponible

**Approche retenue pour le MVP :** Option 1 (XML doc comments) pour les données API, avec fallback sur fetch direct pour les pages qui fonctionnent sans JS.

---

## 4. Architecture technique

### Stack

| Composant | Technologie | Version |
|---|---|---|
| Runtime | Node.js | 18+ |
| Langage | TypeScript | 5.x |
| SDK MCP | `@modelcontextprotocol/sdk` | ^1.24 |
| Validation | `zod` | ^3.25 |
| HTML → Markdown | `turndown` | ^7.x |
| HTML parsing | `cheerio` | ^1.x |
| Recherche locale | `minisearch` | ^7.x |
| HTTP client | `node:fetch` (natif) | — |

### Transport

- **Principal :** `stdio` — compatibilité maximale (Claude Desktop, Cursor, VS Code, Claude Code)
- **Futur :** Streamable HTTP (`/mcp` endpoint) pour déploiement hosted

### Pattern architectural

```
┌─────────────────┐     stdio/HTTP      ┌──────────────────────┐
│   Client IA     │ ◄─────────────────► │   sbox-docs-mcp      │
│ (Claude, Cursor) │                     │                      │
└─────────────────┘                     │  ┌────────────────┐  │
                                        │  │  Search Index   │  │
                                        │  │  (minisearch)   │  │
                                        │  └───────┬────────┘  │
                                        │          │           │
                                        │  ┌───────▼────────┐  │
                                        │  │  Page Fetcher   │  │
                                        │  │  (turndown)     │  │
                                        │  └───────┬────────┘  │
                                        │          │           │
                                        │  ┌───────▼────────┐  │
                                        │  │  Cache Layer    │  │
                                        │  │  (in-memory)    │  │
                                        │  └────────────────┘  │
                                        └──────────────────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                             docs.facepunch   sbox.game/api   sbox-public
                                .com          (fallback)      (GitHub)
```

**Flux de données :**
1. L'IA appelle un tool MCP (ex: `sbox_docs_search`)
2. Le serveur vérifie le cache → si hit, retourne immédiatement
3. Sinon, fetch la source appropriée, convertit en Markdown, met en cache
4. Retourne le contenu Markdown au client IA

---

## 5. Tools MCP exposés

### Tool 1 : `sbox_docs_search`

Recherche dans la documentation narrative s&box.

**Description MCP :** *"Search s&box documentation for guides, tutorials, and concepts. Returns a list of matching pages with titles and URLs."*

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `query` | `string` | oui | Termes de recherche |
| `limit` | `number` | non | Nombre max de résultats (défaut: 10, max: 25) |

**Retour :** Liste de résultats avec `title`, `url`, `snippet` (extrait pertinent).

```json
{
  "content": [{
    "type": "text",
    "text": "## Résultats pour \"component lifecycle\"\n\n1. **Components and Properties** — docs.facepunch.com/s/sbox-dev/doc/components-...\n   > Components are the building blocks of game logic in s&box...\n\n2. **First Steps** — docs.facepunch.com/s/sbox-dev/doc/first-steps-...\n   > Create your first component and understand the lifecycle..."
  }]
}
```

### Tool 2 : `sbox_docs_get_page`

Récupère le contenu complet d'une page de documentation, converti en Markdown.

**Description MCP :** *"Fetch a specific s&box documentation page and return its content as Markdown. Supports chunked reading for large pages."*

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `url` | `string` | oui | URL complète de la page docs.facepunch.com |
| `start_index` | `number` | non | Index de début pour pagination (défaut: 0) |
| `max_length` | `number` | non | Longueur max du contenu retourné (défaut: 5000 chars) |

**Retour :** Contenu Markdown de la page avec metadata.

```json
{
  "content": [{
    "type": "text",
    "text": "# Components and Properties\n\nComponents are C# classes that attach to GameObjects...\n\n## Creating a Component\n\n```csharp\npublic sealed class MyComponent : Component\n{\n    [Property] public float Speed { get; set; } = 200f;\n    ...\n}\n```\n\n---\n_Page 1/3 — Use start_index=5000 for next chunk_"
  }]
}
```

### Tool 3 : `sbox_api_get_type`

Récupère la documentation d'un type/classe de l'API s&box.

**Description MCP :** *"Get API documentation for a specific s&box type, class, or struct. Returns properties, methods, events, and descriptions."*

| Paramètre | Type | Requis | Description |
|---|---|---|---|
| `type_name` | `string` | oui | Nom du type (ex: `GameObject`, `Component`, `SceneFile`) |
| `include_methods` | `boolean` | non | Inclure les méthodes (défaut: true) |
| `include_properties` | `boolean` | non | Inclure les propriétés (défaut: true) |

**Retour :** Documentation structurée du type en Markdown.

```json
{
  "content": [{
    "type": "text",
    "text": "# GameObject\n\n**Namespace:** `Sandbox`\n**Assembly:** `Sandbox.Game`\n\n> The base object in a scene. GameObjects have a transform and can hold components.\n\n## Properties\n\n| Name | Type | Description |\n|---|---|---|\n| `Name` | `string` | Display name |\n| `Enabled` | `bool` | Whether the object is active |\n| `Transform` | `GameTransform` | World transform |\n| `Components` | `ComponentList` | Attached components |\n\n## Methods\n\n### `AddComponent<T>()`\nAdds a component of type T to this GameObject.\n```csharp\nvar renderer = gameObject.AddComponent<ModelRenderer>();\n```"
  }]
}
```

---

## 6. Schemas Zod

```typescript
import { z } from 'zod'

// Tool 1: sbox_docs_search
export const SearchDocsInput = z.object({
  query: z.string().min(1).describe('Search terms'),
  limit: z.number().min(1).max(25).default(10).describe('Max results'),
})

// Tool 2: sbox_docs_get_page
export const GetPageInput = z.object({
  url: z
    .string()
    .url()
    .refine(
      (u) => u.includes('docs.facepunch.com') || u.includes('wiki.facepunch.com'),
      'URL must be from docs.facepunch.com or wiki.facepunch.com'
    )
    .describe('Documentation page URL'),
  start_index: z.number().min(0).default(0).describe('Start index for chunked reading'),
  max_length: z.number().min(100).max(20000).default(5000).describe('Max content length'),
})

// Tool 3: sbox_api_get_type
export const GetApiTypeInput = z.object({
  type_name: z.string().min(1).describe('Type name (e.g. GameObject, Component)'),
  include_methods: z.boolean().default(true).describe('Include methods'),
  include_properties: z.boolean().default(true).describe('Include properties'),
})
```

---

## 7. Stratégie de cache

### Cache en mémoire (Map)

| Donnée | TTL | Raison |
|---|---|---|
| Pages docs (HTML → MD) | **4 heures** | Les docs changent rarement, mais pas jamais |
| Résultats de recherche | **1 heure** | Moins critique, peut devenir stale |
| Types API (depuis XML/source) | **24 heures** | Très stable, change uniquement lors de mises à jour moteur |
| Index de recherche | **Au démarrage** | Chargé une fois, reconstruit au redémarrage |

### Limites

- **Max entrées cache :** 500 pages (LRU eviction)
- **Max mémoire estimée :** ~50 MB (pages Markdown compressées)
- Pas de persistance disque pour le MVP — le cache se reconstruit au redémarrage

### Invalidation

- TTL-based (expiration automatique)
- Invalidation manuelle possible via redémarrage du serveur
- Futur : header `Cache-Control` respecté si la source en fournit

---

## 8. Configuration

### Variables d'environnement

```bash
# Optionnel — toutes les valeurs ont des défauts sensibles
SBOX_DOCS_CACHE_TTL=14400        # TTL cache pages en secondes (défaut: 4h)
SBOX_DOCS_MAX_CACHE_ENTRIES=500  # Max entrées cache (défaut: 500)
SBOX_DOCS_REQUEST_TIMEOUT=10000  # Timeout HTTP en ms (défaut: 10s)
SBOX_DOCS_USER_AGENT="sbox-docs-mcp/1.0"  # User-Agent pour les requêtes
```

### Configuration Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "sbox-docs": {
      "command": "npx",
      "args": ["-y", "sbox-docs-mcp"],
      "env": {
        "SBOX_DOCS_CACHE_TTL": "14400"
      }
    }
  }
}
```

### Configuration Claude Code (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "sbox-docs": {
      "command": "npx",
      "args": ["-y", "sbox-docs-mcp"]
    }
  }
}
```

---

## 9. Exemples d'utilisation

### Scénario 1 : Comprendre le système de composants

> **Utilisateur :** "Comment créer un composant qui fait bouger un personnage dans s&box ?"
>
> **L'IA utilise :** `sbox_docs_search({ query: "component movement character" })`
> → Trouve la page "Components and Properties" + "PlayerController"
>
> **L'IA utilise :** `sbox_docs_get_page({ url: "https://docs.facepunch.com/s/sbox-dev/doc/components-..." })`
> → Lit le guide complet sur les composants
>
> **L'IA utilise :** `sbox_api_get_type({ type_name: "PlayerController" })`
> → Récupère les propriétés et méthodes de PlayerController
>
> **Résultat :** L'IA fournit un code complet et correct avec les bonnes API.

### Scénario 2 : Debugger une erreur réseau

> **Utilisateur :** "J'ai une erreur avec le networking, les propriétés ne se synchronisent pas"
>
> **L'IA utilise :** `sbox_docs_search({ query: "networking sync property" })`
> → Trouve la page sur le système réseau
>
> **L'IA utilise :** `sbox_api_get_type({ type_name: "SyncAttribute" })`
> → Découvre l'attribut `[Sync]` et ses contraintes
>
> **Résultat :** L'IA identifie que l'utilisateur n'utilise pas `[Sync]` correctement.

### Scénario 3 : Explorer l'API d'un type inconnu

> **Utilisateur :** "C'est quoi SceneFile dans s&box ?"
>
> **L'IA utilise :** `sbox_api_get_type({ type_name: "SceneFile" })`
> → Documentation complète du type avec propriétés, méthodes, exemples
>
> **Résultat :** Explication claire et précise basée sur la vraie API, pas sur des suppositions.

---

## 10. Roadmap

### Phase 1 — MVP (v0.2.0) ✅

- [x] Setup projet TypeScript + SDK MCP
- [x] Implémenter `sbox_docs_get_page` (fetch + Turndown)
- [x] Implémenter `sbox_docs_search` (index minisearch avec crawl BFS)
- [x] Cache en mémoire avec TTL + LRU eviction
- [x] Transport stdio
- [x] Tests unitaires (50 tests — cache, fetcher, search-index, tools, schemas)
- [ ] Publication npm (`sbox-docs-mcp`)

**Livrable :** Un serveur MCP fonctionnel capable de chercher et lire les docs narratives de s&box.

### Phase 2 — API Reference (v0.2.0)

- [ ] Parser les XML doc comments depuis `Facepunch/sbox-public`
- [ ] Implémenter `sbox_api_get_type`
- [ ] Index de recherche enrichi (docs + types API)
- [ ] Améliorer le scraping des pages docs (gestion des cas limites)
- [ ] Crawler automatique des liens internes pour construire l'index

**Livrable :** Support complet de la référence API avec les 3,157 types documentés.

### Phase 3 — Production (v1.0.0)

- [ ] Transport Streamable HTTP (déploiement hosted possible)
- [ ] Index pré-construit mis à jour automatiquement (GitHub Actions)
- [ ] Versioning de la doc (suivre les releases s&box)
- [ ] Support multi-versions de la documentation
- [ ] Publication sur les annuaires MCP (PulseMCP, awesome-mcp-servers)

**Livrable :** MCP de qualité production, prêt pour la communauté s&box.
