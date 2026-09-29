export type Role = 'Admin' | 'NhanVien';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  full_name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
