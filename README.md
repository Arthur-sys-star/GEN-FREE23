# GEN-FREE

An academic awareness website focused on building a drug-free generation.

## Project flow

Home → Awareness → Explore (Risks, Myths, Peer Pressure, Choices) → Quiz → Findings → Support → My Progress

## Included

- Shared `js/main.js` controls login/profile, activity tracking, points, progress, page transitions, and page interactions.
- `pages/awareness.html` provides the healthy-life awareness session and animated hints panel.
- `pages/choices.html` provides an informed-decision experience with interactive scenarios.
- `pages/quiz.html` uses rotating question sets with randomized question/answer order.
- `pages/progress.html` displays quiz attempts, best score, points, activities, and journey progress.
- `pages/findings.html` reads the connected Google Apps Script survey feed and displays response-based findings.
- `backend/server.js` provides the Node.js backend for accounts, sessions, profile/progress storage, quiz attempts, feedback, health checks, and basic request limiting.
- `backend/data/users.json` is the current lightweight data store for the academic/demo version.

## Run locally

From the project root:

```bash
node backend/server.js
```

Then open:

`http://localhost:5000/index.html`

No external npm packages are required for the current backend.

## Backend API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/users/me`
- `GET /api/progress`
- `POST /api/progress/activity`
- `POST /api/quiz/attempt`
- `POST /api/feedback`

Passwords are hashed on the server with Node.js `scrypt`. Password hashes are never returned by the API.

## Frontend + backend connection

When the site is served by the Node backend, `js/main.js` automatically uses the same origin for `/api/...` requests. The frontend also keeps a localStorage fallback so the academic demo remains usable if the backend is temporarily unavailable.

For a separately hosted backend, define this before `js/main.js`:

```html
<script>window.GENFREE_API_URL = "https://YOUR-BACKEND-DOMAIN";</script>
```

## GitHub Pages hosting

GitHub Pages hosts the frontend as static files and does **not** run `backend/server.js`.

For a complete public deployment, host the frontend on GitHub Pages and deploy the Node backend separately. The backend should then be connected through `window.GENFREE_API_URL`.

The Google Apps Script survey URL remains separate and continues to power the live findings section when its deployment is publicly accessible.

## Configuration

- `js/config.js` holds the backend URL in one place. On `localhost` it uses the same-origin API (`node backend/server.js`); everywhere else it uses the hosted Render backend. Edit `HOSTED_BACKEND` there if the backend moves.
- Set `FRONTEND_ORIGIN` on the backend host to your website origin (see `backend/.env.example`) so only your site can call the API.
- `backend/data/users.json` is runtime data and is git-ignored. If it was committed earlier, run `git rm --cached backend/data/users.json` once.

## Survey feed (Google Sheet + Apps Script)

`apps-script/Code.gs` is a ready-to-paste feed that returns **counts only** (`{ success, summary:{ total, awareness, risk, support } }`), so no names or emails from the form are exposed. The site also still accepts the older `{ success, responses }` format. See the comments at the top of `Code.gs` for redeploy steps.

## Points and levels

Points are awarded once per activity (Awareness 15, Risks 10, Myths 10, Peer Pressure 10, Choices 10, Quiz 20, Support 10, Findings 5, Feedback 5). A repeated quiz gives +5 only when the best score is beaten. Levels: Beginner, Aware (25), Informed (55), GEN-FREE Ready (80). The server validates and caps points sent by the browser.

## Help lines shown on the site (India)

National de-addiction helpline 14446, Tele-MANAS 14416, emergency 112. Verify them on official government sites from time to time.

## Important note

This backend is designed for an academic project/demo. It is not production-grade authentication or database infrastructure. A production release should use HTTPS, a managed database, persistent session storage, stronger validation/security controls, environment-based secrets, backups, and monitoring. Do not use this project to collect sensitive personal information.
