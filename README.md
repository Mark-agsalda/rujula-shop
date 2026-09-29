# Rujula Shop — GitHub + Online Deployment

Rujula Shop is a full-stack ecommerce project with a responsive web storefront, FastAPI backend, PostgreSQL production database, and Android source project.

## Recommended production architecture

- **GitHub:** source code, version control, CI checks.
- **Render Web Service:** FastAPI backend/API.
- **Render PostgreSQL:** production database.
- **Render Static Site:** customer/seller website.
- **Android APK:** connects to the same public HTTPS API as the website.

Render can connect directly to a GitHub repository and redeploy when the linked branch changes. The included `render.yaml` defines the API, static website, and PostgreSQL resources as one Blueprint. GitHub Pages is intentionally not used for the backend because this project needs a server-side FastAPI API and a database.

## 1. Push this project to GitHub

Create a new GitHub repository, then from this project folder run:

```bash
git init
git add .
git commit -m "Initial Rujula Shop deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rujula-shop.git
git push -u origin main
```

Do **not** commit `backend/.env`, database files, passwords, JWT secrets, signing keys, or other credentials. The included `.gitignore` excludes common local secrets and build output. GitHub recommends storing sensitive workflow values as encrypted secrets rather than putting them in repository files.

## 2. Deploy online with Render

1. Open Render and choose **New → Blueprint**.
2. Connect your GitHub repository.
3. Select the `main` branch.
4. Render reads `render.yaml` and creates:
   - `rujula-api` — FastAPI API
   - `rujula-web` — static website
   - `rujula-db` — PostgreSQL
5. When prompted for `SELLER_EMAIL` and `SELLER_PASSWORD`, enter the real seller credentials you want to use.
6. Wait for the API and website deployments to finish.

### Important about the free plan

Render currently documents that free web services can spin down after 15 minutes of inactivity and start again when a request arrives. If you need the shop API to stay continuously running for a 24/7 customer experience, upgrade the API service to an always-on paid compute plan in Render. The static site remains separately hosted.

The API health endpoint is:

`https://YOUR-RUJULA-API.onrender.com/api/health`

It should return JSON similar to:

```json
{"ok": true}
```

### Important: connect the website to the API

The static site uses `web/config.js`. Before the first production deploy, replace its local URL with the actual HTTPS API URL, for example:

```js
window.RUJULA_API_BASE = "https://rujula-api.onrender.com";
```

Commit and push that change. Render will redeploy the static site.

If your Render-generated API hostname differs, use the exact URL shown in the Render dashboard.

## 3. Seller account

The seller account is seeded automatically on the first API startup from:

- `SELLER_EMAIL`
- `SELLER_PASSWORD`

Change the default local credentials before production. Never publish the real seller password in this repository.

## 4. Shipping rules

- **Diffun:** automatically free shipping.
- **Other municipalities:** checkout requires a matching municipality + province shipping rule.
- The seller can configure shipping fees through the seller area/API.

This avoids silently charging ₱0 when an outside-Diffun shipping fee has not been configured.

## 5. Android APK

Open the `android/` folder in Android Studio.

For production, change `android/app/src/main/java/com/rujula/shop/ApiConfig.kt` from the local emulator URL to the public HTTPS API URL:

```kotlin
object ApiConfig {
    const val BASE_URL = "https://YOUR-RUJULA-API.onrender.com/"
}
```

Then build the APK from Android Studio. The Android app and website use the same online API/database.

## 6. Local development

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: `http://127.0.0.1:8000/docs`

### Website

In a second terminal:

```bash
cd web
python -m http.server 5173
```

Open `http://127.0.0.1:5173`.

## 7. GitHub Actions

The repository includes `.github/workflows/ci.yml`. It runs on pushes and pull requests to `main`, installs the backend dependencies, compiles the Python package, and imports the FastAPI application. GitHub Actions can also be extended later for automated deployment workflows.

## Production checklist

- [ ] Use a strong seller password.
- [ ] Use the Render-generated `JWT_SECRET`.
- [ ] Confirm the API is HTTPS.
- [ ] Confirm the website points to the production API URL.
- [ ] Confirm Android points to the production API URL.
- [ ] Configure shipping rules for every municipality you will serve outside Diffun.
- [ ] Test customer registration/login.
- [ ] Test seller product management.
- [ ] Test checkout and stock reduction.
- [ ] Test order status updates.
- [ ] Keep credentials out of GitHub.
- [ ] Back up the production PostgreSQL database.

## Project structure

```text
.
├── android/                 # Android Studio project / APK source
├── backend/                 # FastAPI API + SQLAlchemy models
├── database/                # Database notes
├── deploy/                  # Local Docker/PostgreSQL example
├── web/                     # Responsive storefront + seller UI
├── .github/workflows/       # GitHub Actions CI
├── render.yaml              # Render production infrastructure
├── .gitignore
└── README.md
```
