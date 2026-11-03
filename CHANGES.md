# GEN-FREE: changes in this version

## Security and stability (backend/server.js)
- Static files are now whitelisted (`index.html`, `css/`, `js/`, `pages/`). `backend/data/users.json`, `server.js`, `.git/` and dotfiles return 404 (they were publicly downloadable before).
- Malformed URLs no longer crash the server; uncaught errors are logged instead of killing the process.
- Rate limit counts API calls only, uses `X-Forwarded-For` (real client IP behind Render), prunes old entries, and login attempts are throttled per IP + email.
- Points, activities and quiz scores from the browser are validated and capped on the server (no more `points: 999999` or a 500/10 quiz score).
- Sessions expire after 7 days; `users.json` is written atomically; `FRONTEND_ORIGIN` accepts a comma-separated list.

## Functionality
- Feedback page fixed (a stray `</script>` printed the code on the page and the form did nothing). Guests are asked to log in.
- Password rule unified at 6 characters; server messages (weak password, duplicate email, throttling) are now shown instead of silently saving on-device only.
- Quiz counts toward journey progress (it never did before), gives 20 points once and +5 only when the best score is beaten; guests see "Log in to save" and their score is saved after login.
- "Make Informed Choices" is now tracked (10 points) and part of the journey (7 core steps). Levels re-balanced: Aware 25, Informed 55, GEN-FREE Ready 80.
- Signup popup no longer appears automatically on first load.
- Dashboard lists every step (Awareness and Choices were missing); duplicate "Awareness" link in the nav removed.
- Findings page: status line, empty / unavailable states with a retry button, recommendation cards generated from the numbers, clickable survey cards earn points. Home stats show "—" instead of "00%" when the feed is down.
- Survey feed accepts counts-only JSON (`apps-script/Code.gs`) as well as the old raw-rows format.

## Design (same style, no redesign)
- Mobile: home hero and knowledge row no longer overflow the screen; a hamburger menu in the same glass navbar gives phone users access to every page.
- Support page: "Need help now" helpline cards (14446, 14416, 112) in the existing card style, plus a helpline line in every footer.
- Keyboard access and visible focus for clickable cards; meta descriptions, theme colour and a favicon on every page.

## Project
- `js/config.js` holds the backend URL once (was hard-coded in 11 files); localhost uses the local backend.
- `.gitignore`, updated READMEs and `.env.example`.
