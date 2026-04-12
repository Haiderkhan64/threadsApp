{
  description = "Threads App — Next.js + WebSocket + Redis + MongoDB";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Helper script: wait for a TCP port to be ready
        waitForPort = pkgs.writeShellScriptBin "wait-for-port" ''
          port=''${1}
          name=''${2:-"service"}
          timeout=''${3:-30}
          
          echo "⏳ Waiting for ''$name on port ''$port..."
          for i in $(seq 1 ''$timeout); do
            if echo > /dev/tcp/127.0.0.1/''$port 2>/dev/null; then
              echo "✔ ''$name ready on port ''$port"
              exit 0
            fi
            sleep 1
          done
          echo "✗ ''$name failed to become ready on port ''$port after ''$timeout seconds" >&2
          exit 1
        '';
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            mongosh
            redis
            git
            docker
            bash
          ];

          shellHook = ''
            echo ""
            echo "🚀  Threads App Development Environment"
            # Nix interpolation (no escape needed):
            echo "   Node: $(node --version) | Nix: ${pkgs.stdenv.hostPlatform.system}"
            echo ""

            # Shell environment variables (escape $ for Nix)
            export MONGODB_URL="''${MONGODB_URL:-mongodb://127.0.0.1:27017/threads_app}"
            export REDIS_URL="''${REDIS_URL:-redis://127.0.0.1:6379}"
            export PORT="''${PORT:-3000}"
            export NODE_ENV="''${NODE_ENV:-development}"
            # export UPLOADTHING_TOKEN="''${UPLOADTHING_TOKEN:-}"
            # export CLERK_SECRET_KEY="''${CLERK_SECRET_KEY:-}"

            # Start MongoDB via Docker if not running
            start_mongo() {
              if docker ps --format '{{.Names}}' | grep -q '^threads-mongo$'; then
                echo "✔ MongoDB container already running"
                return 0
              fi
              echo "📦 Starting MongoDB (threads-mongo:7.0)..."
              docker run -d \
                --name threads-mongo \
                -p 27017:27017 \
                -e MONGO_INITDB_DATABASE=threads_app \
                -v threads-mongo-data:/data/db \
                --restart unless-stopped \
                mongo:7.0 > /dev/null 2>&1
              
              ${waitForPort}/bin/wait-for-port 27017 "MongoDB" 30
            }

            # Start Redis via Docker if not running
            start_redis() {
              if docker ps --format '{{.Names}}' | grep -q '^threads-redis$'; then
                echo "✔ Redis container already running"
                return 0
              fi
              echo "📦 Starting Redis (threads-redis:7-alpine)..."
              docker run -d \
                --name threads-redis \
                -p 6379:6379 \
                -v threads-redis-data:/data \
                --restart unless-stopped \
                redis:7-alpine > /dev/null 2>&1
              
              ${waitForPort}/bin/wait-for-port 6379 "Redis" 30
            }

            # Cleanup helper
            cleanup_services() {
              echo "🧹 Stopping dev containers..."
              docker stop threads-mongo threads-redis 2>/dev/null || true
              docker rm threads-mongo threads-redis 2>/dev/null || true
              echo "✔ Containers cleaned up"
            }

            # Initialize services
            echo "🔌 Initializing backend services..."
            echo ""
            
            if docker info >/dev/null 2>&1; then
              start_mongo
              start_redis
            else
              echo "⚠️  Docker daemon not accessible"
              echo "   Set custom URLs if needed:"
              echo "   export MONGODB_URL='your-mongo-url'"
              echo "   export REDIS_URL='your-redis-url'"
            fi

            echo ""

            if [ ! -d "node_modules" ]; then
              echo "⚠️  Dependencies not installed."
              echo "   → Run: npm install"
              echo ""
            fi

            # Usage info
            echo "✅ Environment ready!"
            echo ""
            echo "📋 Quick Start:"
            echo "   npm run dev              # Start Next.js + WebSocket server"
            echo ""
            echo "🔗 Service Endpoints:"
            echo "   MongoDB:  ''$MONGODB_URL"
            echo "   Redis:    ''$REDIS_URL"
            echo "   App:      http://localhost:''$PORT"
            echo ""
            echo "🔧 WebSocket Endpoints:"
            echo "   ws://localhost:''$PORT/ws/chat/<roomId>/"
            echo "   ws://localhost:''$PORT/ws/video_call/"
            echo ""
            echo "🧹 Utilities:"
            echo "   cleanup_services         # Stop dev containers"
            echo "   wait-for-port <port>     # Check service readiness"
            echo ""
            echo "💡 Tip: Add 'use flake' to .envrc for direnv auto-activation"
            echo ""
          '';
        };

        checks.${system}.flake-eval = pkgs.runCommand "flake-eval-check" {} ''
          echo "✓ Flake evaluates successfully" > $out
        '';
      }
    );
}