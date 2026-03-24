import { UserRole, type Organization, type Team, type User } from "@/types";

// ─── Organization ────────────────────────────────────────────────────────────

export const MOCK_ORGANIZATION: Organization = {
  id: "org_aexion",
  name: "Aexion Technologies",
  slug: "aexion",
  plan: "enterprise",
  createdAt: "2024-06-01T00:00:00Z",
};

// ─── Teams ───────────────────────────────────────────────────────────────────

export const MOCK_TEAMS: Team[] = [
  {
    id: "team_sdr_alpha",
    name: "SDR Team Alpha",
    managerId: "usr_patricia",
    organizationId: MOCK_ORGANIZATION.id,
    members: [], // populated below
  },
  {
    id: "team_enterprise",
    name: "Enterprise Closers",
    managerId: "usr_bruno",
    organizationId: MOCK_ORGANIZATION.id,
    members: [], // populated below
  },
];

// ─── Users (with passwords for mock auth) ────────────────────────────────────

export const MOCK_USERS = [
  {
    id: "usr_ana",
    name: "Ana Beatriz Costa",
    email: "ana@aexion.io",
    role: UserRole.SDR,
    teamId: "team_sdr_alpha",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
  {
    id: "usr_rafael",
    name: "Rafael Mendes",
    email: "rafael@aexion.io",
    role: UserRole.SDR,
    teamId: "team_sdr_alpha",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
  {
    id: "usr_camila",
    name: "Camila Ferreira",
    email: "camila@aexion.io",
    role: UserRole.CLOSER,
    teamId: "team_enterprise",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
  {
    id: "usr_lucas",
    name: "Lucas Oliveira",
    email: "lucas@aexion.io",
    role: UserRole.CLOSER,
    teamId: "team_enterprise",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
  {
    id: "usr_patricia",
    name: "Patricia Santos",
    email: "patricia@aexion.io",
    role: UserRole.MANAGER,
    teamId: "team_sdr_alpha",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
  {
    id: "usr_bruno",
    name: "Bruno Almeida",
    email: "bruno@aexion.io",
    role: UserRole.MANAGER,
    teamId: "team_enterprise",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
  {
    id: "usr_fernanda",
    name: "Fernanda Lima",
    email: "fernanda@aexion.io",
    role: UserRole.DIRECTOR,
    teamId: "team_enterprise",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
  {
    id: "usr_carlos",
    name: "Carlos Duarte",
    email: "carlos@aexion.io",
    role: UserRole.ADMIN,
    teamId: "team_sdr_alpha",
    organizationId: MOCK_ORGANIZATION.id,
    password: "aexion123",
  },
] as const;

// ─── Populate team members ───────────────────────────────────────────────────

function toUser(mock: (typeof MOCK_USERS)[number]): User {
  return {
    id: mock.id,
    name: mock.name,
    email: mock.email,
    role: mock.role,
    teamId: mock.teamId,
    organizationId: mock.organizationId,
    createdAt: "2025-01-15T00:00:00Z",
  };
}

MOCK_TEAMS[0].members = MOCK_USERS.filter(
  (u) => u.teamId === "team_sdr_alpha"
).map(toUser);

MOCK_TEAMS[1].members = MOCK_USERS.filter(
  (u) => u.teamId === "team_enterprise"
).map(toUser);
