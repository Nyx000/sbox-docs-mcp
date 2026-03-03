# sbox-docs-mcp

MCP server for fetching [s&box](https://sbox.game) (Facepunch Studios) documentation. Gives AI assistants access to s&box guides, tutorials, and API references.

## Tools

| Tool | Description |
|---|---|
| `sbox_docs_search` | Search documentation for guides and concepts |
| `sbox_docs_get_page` | Fetch a documentation page as Markdown |
| `sbox_api_get_type` | Get API docs for a specific type/class |

## Installation

### Claude Desktop

Add to `claude_desktop_config.json`:

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

### From source

```bash
git clone https://github.com/SofianeBel/sbox-docs-mcp.git
cd sbox-docs-mcp
npm install
npm run build
npm start
```

## Development

```bash
npm run dev          # Watch mode
npm test             # Run tests
npm run build        # Build for production
```

See [Spec.md](Spec.md) for full technical specification.

## License

MIT
