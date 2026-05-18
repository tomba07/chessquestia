# Chessquestia on a DigitalOcean VM

This setup runs Chessquestia with Docker Compose and Caddy. Caddy terminates HTTPS automatically and proxies WebSockets to the Node app.

## 1. Create the droplet

Use Ubuntu LTS. A 1 GB droplet is the comfortable minimum; the 512 MB droplet can work, but add swap.

Open ports:

- `22/tcp` for SSH
- `80/tcp` for HTTP certificate challenges
- `443/tcp` for HTTPS

## 2. Point DNS at the droplet

Create an `A` record:

```txt
chessquestia.mteschke.com -> <droplet-ip>
```

Wait until DNS resolves before starting Caddy.

## 3. Install Docker on the droplet

```sh
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and back in so the Docker group takes effect.

Optional but recommended on a 512 MB VM:

```sh
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 4. Deploy

```sh
sudo mkdir -p /opt/apps
sudo chown "$USER":"$USER" /opt/apps
cd /opt/apps
git clone <repo-url> chessquestia
cd chessquestia/deploy
cp .env.example .env
```

Edit `.env`:

```txt
CHESSQUESTIA_DOMAIN=chessquestia.mteschke.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Google login is enabled when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. In Google Cloud Console, create an OAuth web client and add this authorized redirect URI:

```txt
https://chessquestia.mteschke.com/auth/google/callback
```

Start:

```sh
docker compose up -d --build
```

Check status:

```sh
docker compose ps
docker compose logs -f
```

## Updating

From your local checkout, run:

```sh
./deploy/update-vm.sh
```

The script syncs the current working tree to the VM, rebuilds the Docker stack, restarts changed containers, and checks the app health endpoint.

You can override the target if needed:

```sh
VM_HOST=root@165.227.2.163 \
CHESSQUESTIA_DOMAIN=chessquestia.mteschke.com \
./deploy/update-vm.sh
```

Or update manually on the VM:

```sh
cd /opt/apps/chessquestia
git pull
cd deploy
docker compose up -d --build
```

## Persistent data

Room state is stored in the `chessquestia_data` Docker volume at `/data/chessquestia-rooms.json`.
User and session state is stored in the same Docker volume at `/data/chessquestia-auth.json`.

Back it up with:

```sh
docker run --rm -v deploy_chessquestia_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/chessquestia-data.tgz -C /data .
```
