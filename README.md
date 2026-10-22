# Mosaic movie frontend

React + TypeScript movie discovery UI for the MFlix API in `Example-Blog-Backend-NodeJS-`. The app fetches its catalog from the backend; it does not use seeded frontend movies. Keep MongoDB credentials on the server.

## Run locally

1. Start the backend with `npm run dev` from its project directory. By default, it listens on port `5000`.
2. Install frontend dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`; leave `VITE_API_BASE_URL` blank to use the Vite proxy, which forwards `/api` requests to `http://localhost:5000`.
4. Start the frontend with `npm run dev`.

If the backend is unreachable, the page displays the connection error and a retry action instead of sample data. Movie cards include search, genre filters, sorting, details, and a watchlist persisted in this browser's local storage. The watchlist does not sync across browsers or devices.

## API contract

By default the frontend calls paginated `GET /api/movies?page=<page>&limit=30`, `GET /api/movies/genres`, and `GET /api/comments?movieId=<id>`. Search, genre, and sort filters are sent to the backend so they apply to the complete collection, not just the current page. Configure the route paths with `VITE_MOVIES_ENDPOINT` and `VITE_COMMENTS_ENDPOINT` if your backend differs. Account registration and login use `POST /api/users` and `POST /api/users/login`; configure `VITE_USERS_ENDPOINT` if the users route differs. Registration sends the username as the backend's `name` field and requires an email and matching password entries. For a deployed frontend, set `VITE_API_BASE_URL` to the API origin and configure the backend to allow that origin; the Vite proxy is for local development only.

The backend returns paginated movies in `data`; the adapter maps MFlix fields such as `_id`, `imdb.rating`, `fullplot`, `genres`, `directors`, `cast`, and `poster` to the UI model. Genre filters are populated from the backend's distinct genre list, rather than a hard-coded subset. Text search matches titles, directors, and genres across the full collection; pagination, genre filtering, and sorting are also handled by the backend. Comment lists are fetched using the backend's `movieId` query parameter. Posting comments requires an authenticated backend session, which is not currently managed by this frontend.

The backend's default port is `5000`. When using a direct API origin instead of the local Vite proxy, the backend must enable CORS for the frontend origin.

## Validation

- `npm run build`
- `npm run lint`
- `npm test`

Unit and integration tests use Vitest and React Testing Library. Run them in watch mode with `npm run test:watch`.

Test suites are grouped by feature: `src/testing/api.test.ts` covers authentication API requests and responses, `src/testing/AuthMenu.integration.test.tsx` covers login and registration flows, and `src/testing/App.test.tsx` covers movie discovery and watchlist behavior.

## Browser tests

Run `npm run cypress:run` with the Vite development server running. Use `npm run cypress:open` to launch the Cypress interface. Scenarios in `cypress/e2e` cover catalog search, registration, login, and password-confirmation validation; API responses are stubbed.

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
