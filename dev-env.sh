# Ejecutar desde la raíz del proyecto: source ./dev-env.sh
if [ -x "$PWD/.tools/node/bin/node" ]; then
  export PATH="$PWD/.tools/node/bin:$PATH"
fi
export npm_config_cache="$PWD/.tools/npm-cache"
export WRANGLER_LOG_PATH="$PWD/.wrangler/wrangler.log"
export MINIFLARE_REGISTRY_PATH="$PWD/.wrangler/registry"
