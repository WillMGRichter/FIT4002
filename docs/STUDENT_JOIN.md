# Student join (shareable link) & LAN access

Students take a simulation anonymously via a shareable link — no account, no login.
This is the same view teachers see in preview. Student progress is saved so they can
resume, and submissions appear in the teacher's results.

## How it works

- Teacher copies a join link for a project: `http://<host>:3000/join/<projectId>`.
- A student opens the link, enters a **name** and **email**, and starts.
- Behind the scenes the join creates a lightweight `student` user + a participant
  enrolment (using the project's **Max attempts** setting) and returns a token. From
  then on the student uses the normal simulation routes, and their per-page input
  state is saved for resume.

## Setup checklist

### 1. Database migration (one-time)

The join flow and the per-project attempts setting need the `default_max_attempts`
column. Apply `backend/migrations/004_student_join.sql`:

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_max_attempts INT NOT NULL DEFAULT 1;
```

- **Hosted Supabase:** paste the above into the Supabase dashboard → SQL Editor → Run.
- **Local Supabase (Docker):** `cd backend && npm run db:migrate:local`.

It is idempotent (`IF NOT EXISTS`) and backfills existing projects with 1 attempt.

### 2. Run both servers

```bash
# backend (port 5001)
cd backend && npm run dev

# frontend (port 3000) — bind all interfaces so other devices can reach it
cd frontend && HOST=0.0.0.0 npm start
```

### 3. Set attempts & copy the link

- Teacher: create/edit a project and set **Max attempts**.
- Dashboard → project **⋮** menu → **Copy join link**.

## Testing on another device (phone/tablet) over the LAN

Both devices must be on the **same** network, and you must use the computer's **LAN IP**,
not `localhost` (on the phone, `localhost` means the phone itself).

1. **Find the host's LAN IP** (macOS):
   ```bash
   ipconfig getifaddr en0
   ```
   e.g. `192.168.0.136`.

2. **Open the teacher UI by IP**, not localhost: `http://<ip>:3000`. The join link is
   built from the address bar (`window.location.origin`), so if you load the app by IP,
   the copied link contains the IP too. The frontend then auto-targets the backend at
   `http://<ip>:5001` (see `frontend/src/config.ts`).

3. **On the phone**, open `http://<ip>:3000/join/<projectId>`.

### If the phone can't connect

- **macOS firewall** often blocks incoming connections to `node`. Allow it:
  - System Settings → Network → Firewall → Options… → add `node` / "Allow incoming
    connections" (or temporarily turn the firewall off to confirm this is the cause).
  - Terminal equivalent:
    ```bash
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$(which node)"
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$(which node)"
    ```
- **Guest / isolated Wi‑Fi:** guest networks usually enable client (AP) isolation, which
  blocks device-to-device traffic. Put both devices on the same non-guest network.
- **Wrong URL:** make sure you used the IP (`http://192.168.x.x:3000/...`), not
  `localhost`.
- **Quick reachability check from the host:**
  ```bash
  curl -m 5 http://<ip>:5001/        # should return the API health JSON
  curl -m 5 -o /dev/null -w "%{http_code}\n" http://<ip>:3000/   # should be 200
  ```

## Notes

- `REACT_APP_API_URL` overrides the auto-derived backend URL if you need a custom setup
  (otherwise it defaults to `http://<current-hostname>:5001`).
- HTTPS/clipboard: "Copy join link" uses the clipboard API, which browsers only allow on
  `localhost` or HTTPS. On a plain-HTTP LAN address it falls back to a prompt showing the
  link to copy manually.
