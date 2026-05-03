export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRequest = {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_code?: string | null;
  department_id?: number | null;
  type: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  reason?: string | null;
  status: LeaveStatus;
  created_at: string;
  updated_at: string;
};

export type LeaveListResponse = { items: LeaveRequest[]; total: number };

