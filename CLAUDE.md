## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

### Querying (prefer over grep)

- For codebase questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists.
- Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
- These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.

### Keeping the graph current

| Change type | Command | Cost |
| --- | --- | --- |
| Code (`.ts`, `.tsx`, `.py`, …) | `graphify update .` | Free (AST only) |
| Docs (`.md`, specs) | `graphify update .` then check `graphify-out/needs_update` | LLM if flag exists |
| After many doc changes | `/graphify . --update` | LLM (incremental) |

**Agent rule:** After modifying code, run `graphify update .` before answering architecture questions.

**Automation already installed:**
- `post-commit` hook — AST rebuild on every commit (background, log: `~/.cache/graphify-rebuild.log`)
- `post-checkout` hook — full code rebuild on branch switch
- If `graphify-out/needs_update` exists, semantic re-extraction is needed; run `graphify update .` or notify the user.

### Version control

`graphify-out/` is gitignored — local only, not pushed to GitHub. Rebuild after pulling with `graphify update .`.

### Useful commands

```bash
graphify query "how does navigation work?"
graphify path "ProductPage" "Navigation Config"
graphify explain "Field Tickets"
graphify update .                    # after code changes
open graphify-out/graph.html         # interactive viz (local only)
tail -f ~/.cache/graphify-rebuild.log  # watch post-commit rebuilds
```
