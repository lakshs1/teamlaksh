// Shared TypeScript types for the hackathon template

/* ---- Enums ---- */
export type UserRole   = 'USER' | 'MANAGER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BANNED';

/* ---- User ---- */
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AuthUser = User;

/* ---- API Response Wrapper ---- */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message: string;
}

/* ---- Dashboard Analytics ---- */
export interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  value2?: number;
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  timestamp?: string;
}
