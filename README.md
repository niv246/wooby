# וובי — משחק הקלפים הכי מבאס 🃏

משחק קלפים מרובה שחקנים בזמן אמת. פותחים חדר, שולחים קוד לחברים, ומתחילים לשחק!

## איך מריצים

```bash
npm install     # מתקין dependencies + בונה client
npm start       # מפעיל שרת על פורט 3001
```

## פיתוח

```bash
# טרמינל 1 — שרת
node server.js

# טרמינל 2 — קליינט (עם hot reload)
cd client && npm run dev
```

## סטאק

- **Frontend:** React + Vite + CSS (mobile-first)
- **Backend:** Node.js + Express + Socket.io
- **State:** Server-authoritative, in-memory

## חוקי המשחק

- 52 קלפים + 2 ג'וקרים
- 2-6 שחקנים
- סולם: 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → J → Q → K → A
- קלף 2 = איפוס | קלף 7 = היפוך | ג'וקר = מראה/איפוס
- רביעייה = פריצה מכל מקום בכל זמן 💥
- אחרון = שועה 🍑

## Deploy

Railway / Render — תומכים ב-WebSocket.

```bash
git push  # Railway auto-deploys
```
