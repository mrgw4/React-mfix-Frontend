# Mosaic movie frontend

React + TypeScript movie discovery UI for an existing MFlix-style HTTP API. The browser talks to the backend only; keep MongoDB credentials on the server.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to your backend origin.
3. Start the frontend with `npm run dev`.

Without a reachable API, the app displays a small preview collection. Movie cards include search, genre filters, sorting, details, and a watchlist persisted in this browser's local storage. The watchlist does not sync across browsers or devices. Comments load and post through the configured API.

## API contract

By default the frontend calls `GET /api/movies?limit=30`, `GET /api/comments?movie_id=<id>`, and `POST /api/comments` with `{ "movie_id": "...", "name": "...", "text": "..." }`. Configure the route paths with `VITE_MOVIES_ENDPOINT` and `VITE_COMMENTS_ENDPOINT` if your backend differs.

Movie responses can be a JSON array or an object containing `movies`, `results`, or `data`. The adapter maps common MFlix fields such as `_id`, `imdb.rating`, `fullplot`, `genres`, `cast`, and `poster` to the UI model. Comment lists can be arrays or an object containing `comments`, `results`, or `data`.

The backend must enable CORS for the frontend origin when the two run on different ports. The API should validate and sanitize submitted comments.

## Checks

- `npm run build`
- `npm run lint`
- `npm test`

Run unit tests in watch mode with `npm run test:watch`. Component tests use Vitest and React Testing Library; test files live beside their source modules.

## Browser tests

Start the Vite server with `npm run dev`, then launch Cypress in another terminal with `npm run cypress:open`. To run the Gherkin scenarios headlessly, use `npm run cypress:run` while the Vite server is running. Feature files live in `cypress/e2e`, with their step definitions alongside them.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
