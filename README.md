# เล่มแลกเล่ม (LemLaekLem)

A book-swapping site for one school. Students list books they have finished,
offer swaps to each other, and meet at the school library to hand them over.
Built with Next.js and Turso (libSQL), deployed on Vercel.

---

## Testing without disturbing the students

**This is the important part.** Anything you do on the live site is visible to
students immediately — test books land on the browse page, test trades post to
the community chat, the counts on the front page move. Use a preview instead.

Vercel builds a preview site for every branch automatically. The catch is that
a preview uses whatever environment variables you scoped to **Preview** — and
if the database variables are set for *all* environments, your preview writes
straight into the students' live database. That is worse than testing on
production, because it looks safe.

So give Preview its own database. **All of this can be done from a phone** —
no terminal, no clone, nothing to install.

1. **Create a second Turso database**, e.g. `lemlaeklem-preview`, and copy its
   URL and a token.

2. **In Vercel → Settings → Environment Variables**, check the scope of each:

   | Variable | Production | Preview |
   |---|---|---|
   | `TURSO_DATABASE_URL` | live database | **preview database** |
   | `TURSO_AUTH_TOKEN` | live token | **preview token** |
   | `SESSION_SECRET` | live secret | **a different secret** |
   | `ALLOWED_EMAIL_DOMAIN` | `student.nssc.ac.th` | leave unset, so you can register test accounts |

   Vercel allows the same key twice as long as the environments do not overlap,
   so edit the live ones to **Production only** first, then add Preview ones.
   A different `SESSION_SECRET` means a login on the test site is not a valid
   session on the real one.

3. **Push a commit to a branch** — via GitHub's pencil icon if you have no
   terminal. A branch that merely points at the same commit as `main` will not
   produce a preview: Vercel deploys commits, not branch names, and it has
   already built that one. There has to be something new.

4. **Open the preview.** Vercel → Deployments → the row labelled **Preview**
   with your branch name → **Visit**. If you opened a pull request, the Vercel
   bot comments the link on it. The URL is stable per branch, so bookmark it.

   The database sets itself up on first use, so there is nothing to run.

5. **Check you are on the right site.** A preview shows an orange strip across
   the top:

   > 🧪 เว็บทดสอบ — ไม่ใช่เว็บจริง · TEST SITE — not the real เล่มแลกเล่ม

   The live site never shows it. If you do not see it, you are on production.

6. **Verify the isolation, once.** On the preview, add a book called
   `TEST DELETE ME`, then check your live site. It must not be there. If it is,
   step 2 did not take — fix it and **redeploy the preview**, because Vercel
   bakes environment variables in at build time.

7. **Merge to `main`** when you are happy with it.

The daily harvest cron only runs on production, and is guarded by
`CRON_SECRET`, so a preview will not burn your Google Books quota or write to
the catalogue.

### Even faster: run it on your own computer

```bash
npm install
printf 'TURSO_DATABASE_URL=file:local.db\nSESSION_SECRET=anything-long\n' > .env.local
npm run dev
```

`file:local.db` is a plain file on your machine — nothing reaches the cloud and
nothing can reach the students. The tables create themselves; `npm run db:seed`
adds sample data if you want it.

---

## Sample accounts

Optional — a database fills itself in as you use it, so you can just register
an account. But if you have a terminal, `npm run db:seed` creates five students
with books, trades in every state, and a few chat messages, so the site is
worth clicking around in straight away:

| Sign in as | Password |
|---|---|
| `somchai@student.nssc.ac.th` | `test1234` |
| `malee@student.nssc.ac.th` | `test1234` |
| `nid@student.nssc.ac.th` | `test1234` |
| `pond@student.nssc.ac.th` | `test1234` |
| `fahsai@student.nssc.ac.th` | `test1234` |

`somchai` is account #1, which makes it the admin unless `ADMIN_EMAIL` says
otherwise. The seed refuses to run against a database that already has accounts
in it, so it cannot quietly overwrite the real one.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | Required | What it does |
|---|---|---|
| `TURSO_DATABASE_URL` | yes | Database. `file:local.db` for a local file. |
| `TURSO_AUTH_TOKEN` | for Turso | Not needed for a local file. |
| `SESSION_SECRET` | yes | Signs login cookies. Long and random. |
| `GOOGLE_BOOKS_API_KEY` | strongly recommended | Without it, barcode scans and title lookups return nothing — Google gives anonymous callers a daily quota of zero. Enable the **Books API** on the project, not just a key. |
| `ADMIN_EMAIL` | no | Who sees the admin dashboard. Accepts several addresses separated by commas, e.g. `a@student.nssc.ac.th, b@student.nssc.ac.th`. Defaults to account #1. |
| `ALLOWED_EMAIL_DOMAIN` | no | Restricts sign-ups, e.g. `student.nssc.ac.th`. |
| `CRON_SECRET` | no | Vercel Cron sends it as a bearer token to the harvest route. |
| `GOOGLE_CLIENT_ID` | no | Enables "Sign in with Google". Leave both Google vars unset to hide the button entirely. |
| `GOOGLE_CLIENT_SECRET` | no | Paired with `GOOGLE_CLIENT_ID`. |

### Setting up "Sign in with Google"

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type **Web application**.
2. Under **Authorized redirect URIs**, add one entry per origin the app is served from — production, and each stable preview URL you use — as `https://<that-origin>/api/auth/google/callback`. Google rejects the callback with `redirect_uri_mismatch` for any origin not listed here.
3. Copy the generated **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. If `ALLOWED_EMAIL_DOMAIN` is set, it also applies to Google sign-ins — a Google account outside that domain is turned away with the same message a password sign-up would get.

A student who signs up with Google never sets a password; they can add one later from their profile if they want a second way in.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` | Production build. |
| `npm test` | Integration tests for the trade rules — spawns its own server against a throwaway database. |
| `npm run db:init` | Create the tables by hand. Rarely needed — the app does this itself on first use. |
| `npm run db:seed` | Fill a **test** database with sample data. Refuses a populated one; `-- --force` wipes and reseeds. |
| `npm run harvest:thai` | Pull Thai book titles into the suggestion catalogue. |

---

## Admin

Sign in as the admin account and open `/admin`: students, books, trades,
reports, suggestions and bug reports, donations, and the harvested catalogue.
There is a JSON export of everything, a cover-curation view listing books with
no cover ordered by how many students list that title, and a button to clear
covers that turned out to be the API's "Image not available" placeholder.
