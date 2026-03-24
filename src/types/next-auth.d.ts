import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: string;
      workspace: string;
      organizationId: string;
      teamId?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role: string;
    workspace: string;
    organizationId: string;
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    workspace: string;
    organizationId: string;
    teamId?: string | null;
  }
}
