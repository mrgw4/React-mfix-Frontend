# Mosaic movie frontend

React + TypeScript movie discovery UI for the MFlix API in `Example-Blog-Backend-NodeJS-`. The app fetches its catalog from the backend; it does not use seeded frontend movies. Keep MongoDB credentials on the server.

## Run locally

1. Start the backend with `npm run dev` from its project directory. By default, it listens on port `5000`.
2. Install frontend dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`; leave `VITE_API_BASE_URL` blank to use the Vite proxy, which forwards `/api` requests to `http://localhost:5000`.
4. Start the frontend with `npm run dev`.

If the backend is unreachable, the page displays the connection error and a retry action instead of sample data. Movie cards include search, genre filters, sorting, details, and a watchlist persisted in this browser's local storage. The watchlist does not sync across browsers or devices.

## API contract

By default the frontend calls `GET /api/movies?limit=30` and `GET /api/comments?movieId=<id>`. Configure the route paths with `VITE_MOVIES_ENDPOINT` and `VITE_COMMENTS_ENDPOINT` if your backend differs. For a deployed frontend, set `VITE_API_BASE_URL` to the API origin and configure the backend to allow that origin; the Vite proxy is for local development only.

The backend returns paginated movies in `data`; the adapter maps MFlix fields such as `_id`, `imdb.rating`, `fullplot`, `genres`, `directors`, `cast`, and `poster` to the UI model. Comment lists are fetched using the backend's `movieId` query parameter. Posting comments requires an authenticated backend session, which is not currently managed by this frontend.

The backend's default port is `5000`. When using a direct API origin instead of the local Vite proxy, the backend must enable CORS for the frontend origin.

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
