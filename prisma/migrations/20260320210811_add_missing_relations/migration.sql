-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_meetings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "ownerId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "location" TEXT,
    "attendees" TEXT DEFAULT '[]',
    "notes" TEXT,
    "recordingUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceSystem" TEXT,
    "sourceExternalId" TEXT,
    CONSTRAINT "meetings_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "meetings_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "meetings_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "meetings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_meetings" ("attendees", "contactId", "createdAt", "description", "endTime", "id", "leadId", "location", "notes", "organizationId", "ownerId", "recordingUrl", "sourceExternalId", "sourceSystem", "startTime", "title", "updatedAt") SELECT "attendees", "contactId", "createdAt", "description", "endTime", "id", "leadId", "location", "notes", "organizationId", "ownerId", "recordingUrl", "sourceExternalId", "sourceSystem", "startTime", "title", "updatedAt" FROM "meetings";
DROP TABLE "meetings";
ALTER TABLE "new_meetings" RENAME TO "meetings";
CREATE INDEX "meetings_ownerId_idx" ON "meetings"("ownerId");
CREATE INDEX "meetings_opportunityId_idx" ON "meetings"("opportunityId");
CREATE INDEX "meetings_sourceExternalId_idx" ON "meetings"("sourceExternalId");
CREATE TABLE "new_opportunities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'discovery',
    "stageId" TEXT,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT,
    "primaryContactId" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expectedCloseDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceSystem" TEXT,
    "sourceExternalId" TEXT,
    CONSTRAINT "opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "opportunities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "opportunities_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "opportunities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "opportunities_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_opportunities" ("accountId", "createdAt", "description", "expectedCloseDate", "id", "organizationId", "ownerId", "ownerName", "probability", "sourceExternalId", "sourceSystem", "stage", "stageId", "title", "updatedAt", "value") SELECT "accountId", "createdAt", "description", "expectedCloseDate", "id", "organizationId", "ownerId", "ownerName", "probability", "sourceExternalId", "sourceSystem", "stage", "stageId", "title", "updatedAt", "value" FROM "opportunities";
DROP TABLE "opportunities";
ALTER TABLE "new_opportunities" RENAME TO "opportunities";
CREATE INDEX "opportunities_organizationId_idx" ON "opportunities"("organizationId");
CREATE INDEX "opportunities_accountId_idx" ON "opportunities"("accountId");
CREATE INDEX "opportunities_ownerId_idx" ON "opportunities"("ownerId");
CREATE INDEX "opportunities_primaryContactId_idx" ON "opportunities"("primaryContactId");
CREATE INDEX "opportunities_sourceExternalId_idx" ON "opportunities"("sourceExternalId");
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FOLLOW_UP',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT,
    "opportunityId" TEXT,
    "ownerId" TEXT NOT NULL,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("completedAt", "createdAt", "description", "dueDate", "id", "leadId", "opportunityId", "organizationId", "ownerId", "priority", "status", "title", "type", "updatedAt") SELECT "completedAt", "createdAt", "description", "dueDate", "id", "leadId", "opportunityId", "organizationId", "ownerId", "priority", "status", "title", "type", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE INDEX "tasks_ownerId_idx" ON "tasks"("ownerId");
CREATE INDEX "tasks_leadId_idx" ON "tasks"("leadId");
CREATE INDEX "tasks_opportunityId_idx" ON "tasks"("opportunityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
