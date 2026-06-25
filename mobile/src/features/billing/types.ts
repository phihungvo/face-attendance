export type BillStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'OVERDUE' | string;

export type BillSummary = {
  amount?: number | null;
  dueDate?: string | null;
  id: number;
  month?: number | null;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  roomName?: string | null;
  status?: BillStatus | null;
  totalAmount?: number | null;
  year?: number | null;
};
