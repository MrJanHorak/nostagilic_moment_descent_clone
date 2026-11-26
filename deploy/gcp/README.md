# Hosting the game server on Google Cloud (free tier)

The online modes (Anarchy and co-op) need `npm run server` running somewhere public. The cheapest good fit on GCP is one **e2-micro VM on the Compute Engine free tier**.

- The free tier includes one e2-micro running all month in us-west1, us-central1 or us-east1.
- It includes 30 GB of standard disk and its external IP address.
- It includes 1 GB a month of outbound traffic from North America (China and Australia excluded). Traffic beyond that is billed per GB.

`startup.sh` sets everything up: Node 24, the code from GitHub, a systemd service, and Caddy for `wss://` with a free automatic certificate on `<your-ip>.sslip.io`. No domain purchase is needed.

## Why a VM and not Cloud Run

Each room lives in one server's memory and runs a 60 Hz simulation, so every pilot in a room must reach the same process for the whole match. Cloud Run has two problems for that:
- It closes every WebSocket at its request timeout, which is at most 60 minutes.
- Its session affinity is best-effort, so two friends could land on different instances and never see each other's room.

A small VM has neither problem, and on the free tier it costs nothing.

## What it can handle

Measured with the real simulation, on a 2-core VM (November 25, 2026):

| Room | CPU per tick (16.7 ms budget) | Snapshot |
| --- | --- | --- |
| Anarchy, Foundry Ring, 8 pilots | 1.7 ms (10% of a core) | ~1.9 KB |
| Co-op, Asterion Deepworks, 4 pilots | 2.5 ms (15%) | ~1.7 KB |
| Co-op, Fabricator, 4 pilots | 1.1 ms (6%) | ~1.6 KB |

- **CPU:** an e2-micro has a sustained 0.25 vCPU that can burst higher. That is fine for one or two rooms at a time, which suits inviting friends to test. If the game stutters with more rooms, switch to **e2-small** or **e2-medium**; that is a paid machine type, so check the current price first.
- **Traffic:** each pilot receives about 20 snapshots a second, roughly 35 KB/s or about 120 MB an hour. The free 1 GB covers roughly 8 pilot-hours a month; after that you pay per GB.
- **Budget alert:** set one in Billing → Budgets & alerts (for example $5) so nothing surprises you.

## One-time setup (about 10 minutes)

You need a GCP project with billing enabled (required even for the free tier) and the `gcloud` CLI, or use Cloud Shell in the console, which already has it.

```bash
# 1. Pick the project and region (us-east1 is closest to the US east coast).
gcloud config set project YOUR_PROJECT_ID
gcloud services enable compute.googleapis.com

# 2. Open the web ports (Caddy answers on 80 for the certificate, 443 for wss://).
gcloud compute firewall-rules create descended-web \
  --allow=tcp:80,tcp:443 --target-tags=descended --description="DESCENDED game server"

# 3. Create the free-tier VM. The startup script installs and starts everything.
gcloud compute instances create descended-server \
  --zone=us-east1-b --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-standard \
  --tags=descended \
  --metadata-from-file=startup-script=deploy/gcp/startup.sh \
  --metadata=allow-origins=https://aishootergame.netlify.app

# 4. Keep the external IP from changing on restarts by promoting the VM's
#    current address to a static one. Google says the free tier does not charge
#    for the VM's external IP; check your first billing report to confirm.
IP=$(gcloud compute instances describe descended-server --zone=us-east1-b \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
gcloud compute addresses create descended-ip --region=us-east1 --addresses="$IP"
echo "Your server: wss://${IP//./-}.sslip.io/play"
```

Give it 2–3 minutes for the first boot, then open `https://<ip-with-dashes>.sslip.io/health` in a browser. It should answer `{"ok":true,"game":"descended",...}`.

**Tell the website where the server is.** In Netlify, go to Site configuration → Environment variables and add:

```
VITE_GAME_SERVER = wss://<ip-with-dashes>.sslip.io/play
```

Then trigger a redeploy (Deploys → Trigger deploy). The lobby's *Game server* field now fills itself in. Players can still type another address.

## Updating the server after you push

The startup script fetches the latest `main` each time it runs:

```bash
gcloud compute ssh descended-server --zone=us-east1-b --command='sudo google_metadata_script_runner startup'
```

Restarting the VM does the same (`gcloud compute instances reset descended-server --zone=us-east1-b`). Rooms in progress end when the server restarts.

## Useful extras

- **Logs:** `gcloud compute ssh descended-server --zone=us-east1-b --command='sudo journalctl -u descended -n 100 --no-pager'`
- **Status:** `https://<ip-with-dashes>.sslip.io/health` shows the open rooms and connected players.
- **Also allow local testing:** add more sites to `allow-origins`, separated by commas, for example `https://aishootergame.netlify.app,http://localhost:5173`. Then update the metadata and rerun the startup script:
  ```bash
  gcloud compute instances add-metadata descended-server --zone=us-east1-b \
    --metadata=allow-origins=https://aishootergame.netlify.app,http://localhost:5173
  ```
- **Leaderboards and shared levels:** the server keeps them in `/var/lib/descended` (`scores.json` and `levels/`), which survives updates and restarts. Back it up with `gcloud compute ssh descended-server --zone=us-east1-b --command='sudo tar czf - /var/lib/descended' > descended-data.tgz`.
- **Removing a shared level:** set an admin token once (`sudo systemctl edit descended`, add `Environment=ADMIN_TOKEN=<long random text>` under `[Service]`, then `sudo systemctl restart descended`). Then run `curl -X DELETE -H "Authorization: Bearer <token>" https://<ip-with-dashes>.sslip.io/levels/<id>`. The level id is in the address of `/levels`.
- **Your own domain:** point an A record at the static IP, run `add-metadata ... --metadata=domain=play.example.com`, and rerun the startup script. Caddy fetches a certificate for it.
- **Stop paying for anything:** `gcloud compute instances delete descended-server --zone=us-east1-b && gcloud compute addresses delete descended-ip --region=us-east1`. Do this if you leave the free tier, because a static IP left without a VM is billed.
