# Deploy Astreoid free on Render (no computer needed)
1. GitHub: new repo, upload the project WITHOUT node_modules, data, .env.
2. Neon.tech: free Postgres -> copy connection string (DATABASE_URL).
3. Brevo.com: free account -> SMTP & API -> API keys -> create key; Senders -> add + verify your Gmail.
4. Render.com: New > Web Service > your repo. Build `npm install`, Start `npm start`, Free plan.
5. Env vars: NODE_ENV=production, TRUST_PROXY=true, DATABASE_URL, BREVO_API_KEY, MAIL_FROM="Astreoid <your@gmail.com>", APP_URL=https://<name>.onrender.com
6. Open the URL. Optional: uptimerobot.com HTTP monitor on /healthz every 5 min keeps it awake so reminders fire.
