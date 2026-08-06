# BookTrade

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

So give Preview its own database:

1. **Create a second Turso database**, e.g. `booktrade-preview`.

2. **In Vercel → Settings → Environment Variables**, check the scope of each:

   | Variable | Production | Preview |
   |---|---|---|
   | `TURSO_DATABASE_URL` | live database | **preview database** |
   | `TURSO_AUTH_TOKEN` | live token | **preview token** |
   | `SESSION_SECRET` | live secret | **a different secret** |
   | `ALLOWED_EMAIL_DOMAIN` | `student.nssc.ac.th` | leave unset, so you can register test accounts |

   A different `SESSION_SECRET` means a login on the test site is not a valid
   session on the real one.

3. **Push to a branch** rather than `main`. Vercel comments the preview URL on
   the pull request, or you can find it under Deployments.

4. **Set the preview database up once**, pointing `.env.local` at it:

   ```bash
   npm run db:init    # create the tables
   npm run db:seed    # fill it with sample students and books
   ```

5. **Merge to `main`** when you are happy with it.

The daily harvest cron only runs on production, and is guarded by
`CRON_SECRET`, so a preview will not burn your Google Books quota or write to
the catalogue.

### Even faster: run it on your own computer

```bash
npm install
printf 'TURSO_DATABASE_URL=file:local.db\nSESSION_SECRET=anything-long\n' > .env.local
npm run db:init
npm run db:seed
npm run dev
```

`file:local.db` is a plain file on your machine — nothing reaches the cloud and
nothing can reach the students.

---

## Sample accounts

`npm run db:seed` creates five students with books, trades in every state, and
a few chat messages, so the site is worth clicking around in:

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
| `ADMIN_EMAIL` | no | Who sees the admin dashboard. Defaults to account #1. |
| `ALLOWED_EMAIL_DOMAIN` | no | Restricts sign-ups, e.g. `student.nssc.ac.th`. |
| `CRON_SECRET` | no | Vercel Cron sends it as a bearer token to the harvest route. |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` | Production build. |
| `npm test` | Integration tests for the trade rules — spawns its own server against a throwaway database. |
| `npm run db:init` | Create the tables. |
| `npm run db:seed` | Fill a **test** database with sample data. Refuses a populated one; `-- --force` wipes and reseeds. |
| `npm run harvest:thai` | Pull Thai book titles into the suggestion catalogue. |

---

## Admin

Sign in as the admin account and open `/admin`: students, books, trades,
reports, suggestions and bug reports, donations, and the harvested catalogue.
There is a JSON export of everything, a cover-curation view listing books with
no cover ordered by how many students list that title, and a button to clear
covers that turned out to be the API's "Image not available" placeholder.
