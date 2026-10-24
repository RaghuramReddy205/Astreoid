# Astreoid

A 3D personal assistant built from your implementation plan: tasks, manual daily planning, chat-based task entry,
academics, projects, habits, daily review and email reminders. Day/night toggle, Three.js asteroid scenery, and an
**Orbit** page where your open tasks circle as clickable asteroids.

## Run it
```bash
npm install
cp .env.example .env      # optional: add Gmail SMTP details (see below)
npm start                 # http://localhost:3000
npm test                  # 24 API checks (auth, isolation, reminders, chat parser)
```
Edit CSS/JS classes? Rebuild Tailwind with `npm run build:css`.

## Real emails to the user's Gmail
Register/login use the Gmail address + password. Welcome email, task reminders, deadline alerts (1 h before / overdue),
a morning briefing and the daily review are all sent **to the address the user registered with**, by a server-side
scheduler (works with the browser closed, honours quiet hours, never double-sends).
The server needs a *sending* mailbox: set `SMTP_USER` and `SMTP_PASS` (Gmail App Password) in `.env`.
Until then it runs in preview mode and shows the emails inside Settings.

## How it maps to your plan
| Plan | Here |
|---|---|
| React/Vite + Firebase Auth/Firestore | Vanilla ES modules + Express + JSON-file store (no accounts/keys needed). Same data model (`tasks`, `subjects`, `projects`, `reminders`, `reviews`…). Ownership is enforced server-side per user. |
| Milestone 1 task manager | Register/sign in, create/edit/complete, persistence, per-user privacy |
| Milestone 2 manual planner | Calendar with hourly day planner, fixed (weekly) commitments, drag-and-drop scheduling; “Plan my day” only *proposes* |
| Milestone 3 chat entry | Rule-based parser → editable preview → confirm → validated save (swap in an LLM later; same output shape) |
| Milestone 4 academics/coding | Subjects with exams + revision topics; projects with milestones |
| Milestone 5 push | Email reminders via server scheduler. Browser pop-ups while the app is open. **FCM background push is not included** (needs a Firebase project). |
| Milestone 6 reviews/AI | Daily review (+carry-forward, email). Deterministic priority engine; no AI API yet |

## Security notes
bcrypt password hashes, httpOnly SameSite cookie, login throttling, input validation that drops unknown fields,
Origin check on writes. Data lives in `data/db.json` — fine for personal/small use; move to a real database before
wide deployment, and serve over HTTPS.

Uiverse components are credited at the top of `public/css/components.css`.

## Deploy free on Render
See DEPLOY.md (Render web service + free Postgres + Brevo email API). Env vars: `DATABASE_URL`, `BREVO_API_KEY`, `MAIL_FROM`, `APP_URL`, `NODE_ENV=production`, `TRUST_PROXY=true`.
