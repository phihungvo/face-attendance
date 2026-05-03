export type User = {
  id: number;
  username?: string | null;
  code?: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  status: string;
  auth_status?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
  department_id?: number | null;
  created_at: string;
};
