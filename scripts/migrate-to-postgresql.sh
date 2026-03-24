#!/bin/bash
# =============================================================================
# Aexion Core - SQLite to PostgreSQL Migration Script
# =============================================================================
# Prerequisites:
#   1. PostgreSQL running with target database created
#   2. .env.production.local with correct DATABASE_URL
#   3. Node.js and pnpm installed
#
# Usage:
#   chmod +x scripts/migrate-to-postgresql.sh
#   ./scripts/migrate-to-postgresql.sh
# =============================================================================

set -e

echo "=== Aexion Core: SQLite → PostgreSQL Migration ==="
echo ""

# Step 1: Swap schema
echo "[1/4] Switching to PostgreSQL schema..."
cp prisma/schema.prisma prisma/schema.sqlite.backup.prisma
cp prisma/schema.postgresql.prisma prisma/schema.prisma
echo "  Done. PostgreSQL schema is now active."

# Step 2: Generate client
echo "[2/4] Generating Prisma Client for PostgreSQL..."
npx prisma generate
echo "  Done."

# Step 3: Push schema to database
echo "[3/4] Pushing schema to PostgreSQL database..."
echo "  Make sure DATABASE_URL in .env.production.local points to your PostgreSQL instance."
npx prisma db push --accept-data-loss
echo "  Done. Schema created in PostgreSQL."

# Step 4: Seed data (optional)
read -p "[4/4] Seed database with sample data? (y/N): " SEED
if [ "$SEED" = "y" ] || [ "$SEED" = "Y" ]; then
  echo "  Seeding database..."
  npx tsx prisma/seed.ts
  echo "  Done. Database seeded."
else
  echo "  Skipped seeding."
fi

echo ""
echo "=== Migration Complete ==="
echo "Your Aexion Core is now running on PostgreSQL."
echo ""
echo "To revert to SQLite for development:"
echo "  cp prisma/schema.sqlite.backup.prisma prisma/schema.prisma"
echo "  npx prisma generate"
