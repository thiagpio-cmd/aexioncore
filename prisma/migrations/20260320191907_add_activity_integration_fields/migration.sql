-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teams_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "workspace" TEXT NOT NULL DEFAULT 'SDR',
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "users_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "size" TEXT,
    "website" TEXT,
    "annualRevenue" INTEGER DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "companies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "title" TEXT,
    "isChampion" BOOLEAN NOT NULL DEFAULT false,
    "isDecisionMaker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "title" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "temperature" TEXT NOT NULL DEFAULT 'COLD',
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "lastContact" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceSystem" TEXT,
    "sourceExternalId" TEXT,
    CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pipelines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "opportunities" (
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
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expectedCloseDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceSystem" TEXT,
    "sourceExternalId" TEXT,
    CONSTRAINT "opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "opportunities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "opportunities_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "opportunities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT DEFAULT 'internal',
    "leadId" TEXT,
    "opportunityId" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "creatorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" TEXT,
    "sourceSystem" TEXT,
    "externalId" TEXT,
    "occurredAt" DATETIME,
    "revenueEventId" TEXT,
    CONSTRAINT "activities_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
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
    CONSTRAINT "tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
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
    CONSTRAINT "meetings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "sender" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "snoozeUntil" DATETIME,
    "contactId" TEXT,
    "companyId" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "ownerId" TEXT,
    "sourceSystem" TEXT,
    "sourceExternalId" TEXT,
    "threadExternalId" TEXT,
    "revenueEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "revenue_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceExternalId" TEXT NOT NULL,
    "threadExternalId" TEXT,
    "actorExternalId" TEXT,
    "counterpartyEmail" TEXT,
    "counterpartyPhone" TEXT,
    "resolvedContactId" TEXT,
    "resolvedCompanyId" TEXT,
    "resolvedAccountId" TEXT,
    "resolvedLeadId" TEXT,
    "resolvedOpportunityId" TEXT,
    "resolvedOwnerId" TEXT,
    "resolutionMethod" TEXT,
    "resolutionConfidence" INTEGER NOT NULL DEFAULT 0,
    "normalizedPayload" TEXT,
    "rawPayloadRef" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenue_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidence" INTEGER NOT NULL DEFAULT 80,
    "suggestedAction" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "insights_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "insights_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "leadId" TEXT,
    "opportunityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "forecast_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "quarter" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "commit" INTEGER NOT NULL DEFAULT 0,
    "bestCase" INTEGER NOT NULL DEFAULT 0,
    "pipeline" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "segment" TEXT,
    "stage" TEXT,
    "conversionRate" INTEGER NOT NULL DEFAULT 0,
    "usage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "playbook_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playbookId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resources" TEXT,
    CONSTRAINT "playbook_steps_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbooks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "description" TEXT,
    "providerKey" TEXT,
    "domain" TEXT,
    "authType" TEXT,
    "syncMode" TEXT,
    "scopes" TEXT,
    "healthPercent" INTEGER NOT NULL DEFAULT 0,
    "lastSync" DATETIME,
    "lastSuccessfulSync" DATETIME,
    "eventsReceived" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "syncCursor" TEXT,
    "syncStatus" TEXT,
    "nextSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "apiKey" TEXT,
    "signingSecret" TEXT,
    "expiresAt" DATETIME,
    "scope" TEXT,
    "accountEmail" TEXT,
    "accountName" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "integration_credentials_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "payload" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "dedupeKey" TEXT,
    "processingError" TEXT,
    "processedAt" DATETIME,
    "sourceIp" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT,
    "details" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "teams_organizationId_idx" ON "teams"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "companies_organizationId_idx" ON "companies"("organizationId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "accounts_organizationId_idx" ON "accounts"("organizationId");

-- CreateIndex
CREATE INDEX "accounts_companyId_idx" ON "accounts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_organizationId_idx" ON "leads"("organizationId");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_ownerId_idx" ON "leads"("ownerId");

-- CreateIndex
CREATE INDEX "leads_sourceExternalId_idx" ON "leads"("sourceExternalId");

-- CreateIndex
CREATE INDEX "pipelines_organizationId_idx" ON "pipelines"("organizationId");

-- CreateIndex
CREATE INDEX "stages_pipelineId_idx" ON "stages"("pipelineId");

-- CreateIndex
CREATE INDEX "opportunities_organizationId_idx" ON "opportunities"("organizationId");

-- CreateIndex
CREATE INDEX "opportunities_accountId_idx" ON "opportunities"("accountId");

-- CreateIndex
CREATE INDEX "opportunities_ownerId_idx" ON "opportunities"("ownerId");

-- CreateIndex
CREATE INDEX "opportunities_sourceExternalId_idx" ON "opportunities"("sourceExternalId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activities_leadId_idx" ON "activities"("leadId");

-- CreateIndex
CREATE INDEX "activities_opportunityId_idx" ON "activities"("opportunityId");

-- CreateIndex
CREATE INDEX "activities_creatorId_idx" ON "activities"("creatorId");

-- CreateIndex
CREATE INDEX "activities_externalId_idx" ON "activities"("externalId");

-- CreateIndex
CREATE INDEX "tasks_ownerId_idx" ON "tasks"("ownerId");

-- CreateIndex
CREATE INDEX "tasks_opportunityId_idx" ON "tasks"("opportunityId");

-- CreateIndex
CREATE INDEX "meetings_ownerId_idx" ON "meetings"("ownerId");

-- CreateIndex
CREATE INDEX "meetings_sourceExternalId_idx" ON "meetings"("sourceExternalId");

-- CreateIndex
CREATE INDEX "inbox_messages_channel_idx" ON "inbox_messages"("channel");

-- CreateIndex
CREATE INDEX "inbox_messages_isRead_idx" ON "inbox_messages"("isRead");

-- CreateIndex
CREATE INDEX "inbox_messages_contactId_idx" ON "inbox_messages"("contactId");

-- CreateIndex
CREATE INDEX "inbox_messages_sourceExternalId_idx" ON "inbox_messages"("sourceExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_events_dedupeKey_key" ON "revenue_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "revenue_events_organizationId_idx" ON "revenue_events"("organizationId");

-- CreateIndex
CREATE INDEX "revenue_events_provider_idx" ON "revenue_events"("provider");

-- CreateIndex
CREATE INDEX "revenue_events_eventType_idx" ON "revenue_events"("eventType");

-- CreateIndex
CREATE INDEX "revenue_events_channel_idx" ON "revenue_events"("channel");

-- CreateIndex
CREATE INDEX "revenue_events_occurredAt_idx" ON "revenue_events"("occurredAt");

-- CreateIndex
CREATE INDEX "revenue_events_resolvedContactId_idx" ON "revenue_events"("resolvedContactId");

-- CreateIndex
CREATE INDEX "revenue_events_resolvedLeadId_idx" ON "revenue_events"("resolvedLeadId");

-- CreateIndex
CREATE INDEX "revenue_events_resolvedOpportunityId_idx" ON "revenue_events"("resolvedOpportunityId");

-- CreateIndex
CREATE INDEX "revenue_events_sourceExternalId_idx" ON "revenue_events"("sourceExternalId");

-- CreateIndex
CREATE INDEX "revenue_events_counterpartyEmail_idx" ON "revenue_events"("counterpartyEmail");

-- CreateIndex
CREATE INDEX "insights_category_idx" ON "insights"("category");

-- CreateIndex
CREATE INDEX "insights_leadId_idx" ON "insights"("leadId");

-- CreateIndex
CREATE INDEX "insights_opportunityId_idx" ON "insights"("opportunityId");

-- CreateIndex
CREATE INDEX "playbook_steps_playbookId_idx" ON "playbook_steps"("playbookId");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_slug_key" ON "integrations"("slug");

-- CreateIndex
CREATE INDEX "integrations_organizationId_idx" ON "integrations"("organizationId");

-- CreateIndex
CREATE INDEX "integration_credentials_integrationId_idx" ON "integration_credentials"("integrationId");

-- CreateIndex
CREATE INDEX "webhook_events_integrationId_idx" ON "webhook_events"("integrationId");

-- CreateIndex
CREATE INDEX "webhook_events_eventType_idx" ON "webhook_events"("eventType");

-- CreateIndex
CREATE INDEX "webhook_events_dedupeKey_idx" ON "webhook_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
