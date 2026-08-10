declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    INVENTORY_ADMIN_EMAIL: string;
    INVENTORY_ENCRYPTION_KEY: string;
  }
}
