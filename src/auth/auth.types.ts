import type { Request } from 'express';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  status: string;
  isAdmin: boolean;
  menuKeys: string[];
  menuIds: number[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionToken?: string;
  learningCategoryIds?: number[];
}
