# GEN-FREE Backend

This is the server-side part of GEN-FREE. It uses Node.js built-in modules only, so no `npm install` is required.

## Included API

- `GET /api/health` — server health check
- `POST /api/auth/register` — create an account
- `POST /api/auth/login` — log in and receive a session token
- `POST /api/auth/logout` — end the current session
- `GET /api/auth/me` — return the logged-in profile
- `PUT /api/users/me` — save profile/progress data
- `GET /api/progress` — retrieve the logged-in user's progress
- `POST /api/progress/activity` — record an activity
- `POST /api/quiz/attempt` — save a quiz attempt
- `POST /api/feedback` — save feedback

## Run locally

From the project root:

```bash
node backend/server.js
```

Then open:

`http://localhost:5000/index.html`

The backend stores academic-demo data in `backend/data/users.json` and hashes passwords with Node's `scrypt` function. Password hashes are never returned to the browser API.

## Security notes

- Only `index.html`, `css/`, `js/` and `pages/` are served as static files. `backend/`, `.git/` and dotfiles return 404.
- Set `FRONTEND_ORIGIN` (comma-separated origins) instead of leaving CORS open.
- Sessions last 7 days and are kept in memory, so they reset when the server restarts (users are simply asked to log in again).
- On hosts with an ephemeral disk (for example Render's free tier) `data/users.json` is lost on redeploy or restart. Use a persistent disk or a managed database for real data.

## Important deployment note

GitHub Pages can host the frontend but cannot execute `backend/server.js`. For a public deployment, host this Node backend on a server platform and set the frontend API base URL with:

```html
<script>window.GENFREE_API_URL = "https://YOUR-BACKEND-DOMAIN";</script>
```

Place that before `js/main.js` on the pages that use the backend.

This backend is suitable for an academic project/demo. It is not production-grade authentication or database infrastructure; a production release should use a managed database, persistent sessions, HTTPS-only deployment, stronger validation, and additional security controls.
