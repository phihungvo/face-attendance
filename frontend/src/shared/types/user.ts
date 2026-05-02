export type User = {
  id: number;
  code?: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  status: string;
  department_id?: number | null;
  created_at: string;
};
