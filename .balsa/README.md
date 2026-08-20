# Balsa React agent context

Use the CLI to search by intent before loading catalog files into context. Then read only the selected specification under `specs/components/`.
Use `catalog-index.json` only when CLI search is unavailable, and `catalog.json` only for dependency, token, documentation, or source metadata.

```sh
npx balsa-ui@latest search "settings form"
npx balsa-ui@latest info input --markdown
npx balsa-ui@latest add input button
```

This workspace uses the React Balsa registry. Installed source is editable application code; preserve local changes and do not use `--force` without reviewing the diff.

The application uses React 19 with Next.js 15.5.9, whose peer dependencies explicitly support React 19. The installed Balsa React foundation uses APIs available in React 19 and remains source-controlled and editable in this workspace.
