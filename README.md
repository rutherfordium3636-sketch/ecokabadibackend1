# Urban Mining Connect — Complete GitHub-Ready Prototype

Urban Mining / Secondary Raw Materials platform connecting collectors with buyers/recyclers across e-waste, ferrous metals, non-ferrous metals, critical-mineral-bearing streams and mixed scrap.

## Included
- Collector signup/login/logout
- Buyer/recycler signup/login/logout
- Admin login + live admin dashboard
- Material capture with photo evidence and weight
- Indicative valuation
- Buyer/facility matching
- Handover and transaction records
- Earnings and recovery statistics
- Traceability/custody CSV export
- Hindi/Marathi speech support in the field workflow
- Node.js backend using only Node core modules
- JSON persistence for the prototype

## Local run (recommended for testing the complete system)
1. Open this folder in VS Code.
2. Open Terminal.
3. Run `node server\server.js`.
4. Open `http://localhost:8000`.

Do not open the HTML files directly with `file:///`; use the Node server so login sessions and API/database operations work.

## Demo admin
Email: `admin@urbanmining.local`
Password: `Admin@12345`

The server creates the demo admin automatically when the database has no admin account. Change/remove this credential before public deployment.

## User flows
- Collector → `index.html` → Capture → Valuation → Buyers → Traceability → Ledger/Recovery
- Buyer/recycler → `console.html`
- Admin → `admin.html`

## GitHub Pages note
GitHub Pages can host the HTML/CSS/JS frontend but cannot execute `server/server.js` or persist `server/data/db.json`. For a real public deployment, deploy the Node backend separately, set `window.UM_API_BASE` in `config.js` to the backend API URL, configure CORS/HTTPS, and replace JSON storage with a hosted database/object storage.

## API highlights
`POST /api/auth/signup`
`POST /api/auth/login`
`POST /api/auth/logout`
`GET /api/auth/me`
`GET /api/bootstrap`
`POST /api/lots`
`POST /api/handovers`
`GET /api/earnings`
`GET /api/recovery`
`GET /api/console`
`GET /api/admin/dashboard`
`GET /api/export/custody.csv`
