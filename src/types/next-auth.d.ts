declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      displayName: string;
    };
  }

  interface User {
    displayName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    displayName: string;
  }
}

export {};
