# Container Engine Setup (Docker + Podman)

This project can run on either Docker or Podman. You can switch between them as long as only one engine is active at a time for this stack.

---

**Choose an engine**

1. Use Docker if you already have Docker Desktop running.
2. Use Podman if you prefer a daemonless engine or are on Linux.

---

**Docker setup**

1. Install Docker Desktop and make sure it is running.
2. From the project root, run:

```bash
docker compose up -d
```

3. Stop the stack with:

```bash
docker compose down
```

---

**Podman setup (Windows/macOS/Linux)**

1. Install Podman and Podman Compose.
2. Start the Podman machine (required on Windows/macOS):

```bash
podman machine init
podman machine start
```

3. From the project root, run:

```bash
podman compose up -d
```

4. Stop the stack with:

```bash
podman compose down
```

---

**Switching engines safely**

1. If Docker is running the stack, stop it first:

```bash
docker compose down
```

2. Then start Podman:

```bash
podman compose up -d
```

3. To switch back, stop Podman first:

```bash
podman compose down
```

4. Then start Docker:

```bash
docker compose up -d
```

---

**Notes**

1. Do not run Docker and Podman for this project at the same time.
2. If you use `podman-docker`, you can keep the same `docker compose` commands, but the engine will be Podman.
3. If port conflicts appear, one engine still has containers running. Stop it first.
