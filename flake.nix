{
  description = "Threads — Next.js 14 · WebSocket · Redis · MongoDB";

  inputs = {
    nixpkgs.url     = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # ── Node version pinned here; bump in one place ─────────────────────
        node = pkgs.nodejs_20;

        # ── Utility: block until a TCP port accepts connections ─────────────
        waitForPort = pkgs.writeShellApplication {
          name = "wait-for-port";
          text = ''
            port="$1"
            label="''${2:-service}"
            timeout="''${3:-30}"

            printf "⏳  Waiting for %s on :%s " "$label" "$port"
            for _ in $(seq 1 "$timeout"); do
              if (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
                echo "✔"
                exit 0
              fi
              sleep 1
              printf "."
            done
            echo " ✗"
            echo "error: $label did not become ready within ${"\${timeout}"}s" >&2
            exit 1
          '';
        };

        # ── Docker-managed services ──────────────────────────────────────────
        mongoService = pkgs.writeShellApplication {
          name = "start-mongo";
          runtimeInputs = [ pkgs.docker waitForPort ];
          text = ''
            if docker ps --format '{{.Names}}' | grep -q '^threads-mongo$'; then
              echo "✔  MongoDB already running"
              exit 0
            fi
            echo "↑  MongoDB 7.0"
            docker run -d \
              --name   threads-mongo          \
              -p       27017:27017            \
              -e       MONGO_INITDB_DATABASE=threads_app \
              -v       threads-mongo-data:/data/db        \
              --restart unless-stopped        \
              mongo:7.0 >/dev/null
            wait-for-port 27017 MongoDB 30
          '';
        };

        redisService = pkgs.writeShellApplication {
          name = "start-redis";
          runtimeInputs = [ pkgs.docker waitForPort ];
          text = ''
            if docker ps --format '{{.Names}}' | grep -q '^threads-redis$'; then
              echo "✔  Redis already running"
              exit 0
            fi
            echo "↑  Redis 7-alpine"
            docker run -d \
              --name   threads-redis          \
              -p       6379:6379              \
              -v       threads-redis-data:/data \
              --restart unless-stopped        \
              redis:7-alpine >/dev/null
            wait-for-port 6379 Redis 30
          '';
        };

        stopServices = pkgs.writeShellApplication {
          name = "stop-services";
          runtimeInputs = [ pkgs.docker ];
          text = ''
            echo "↓  Stopping dev containers…"
            docker stop threads-mongo threads-redis 2>/dev/null || true
            docker rm   threads-mongo threads-redis 2>/dev/null || true
            echo "✔  Done"
          '';
        };

      in {
        # ── Dev shell ────────────────────────────────────────────────────────
        devShells.default = pkgs.mkShell {
          name = "threads";

          packages = [
            node
            pkgs.mongosh
            pkgs.git
            pkgs.docker
            waitForPort
            mongoService
            redisService
            stopServices
          ];

          # Env vars — override any of these in a .env file or direnv .envrc
          MONGODB_URL = "mongodb://127.0.0.1:27017/threads_app";
          REDIS_URL   = "redis://127.0.0.1:6379";
          PORT        = "3000";
          NODE_ENV    = "development";

          shellHook = ''
            # Allow per-project overrides without touching this file
            [[ -f .env ]] && set -a && source .env && set +a

            echo ""
            echo "  Threads  ·  node $(node --version)  ·  ${pkgs.stdenv.hostPlatform.system}"
            echo ""

            # Bring up backing services when Docker is available
            if docker info >/dev/null 2>&1; then
              start-mongo
              start-redis
            else
              echo "⚠  Docker unavailable — set MONGODB_URL / REDIS_URL manually"
            fi

            if [[ ! -d node_modules ]]; then
              echo ""
              echo "⚠  Run 'npm install' before starting the dev server"
            fi

            echo ""
            echo "  npm run dev          start Next.js + WebSocket server"
            echo "  stop-services        tear down Docker containers"
            echo "  wait-for-port <port> block until a service is ready"
            echo ""
          '';
        };

        # ── Sanity check: flake evaluates without errors ─────────────────────
        checks.flake-eval = pkgs.runCommand "flake-eval" {} ''
          echo ok > $out
        '';
      }
    );
}
