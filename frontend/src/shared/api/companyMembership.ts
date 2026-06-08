import { api, type ApiResponse } from "../lib/apiClient";

export type CompanyMini = {
  id: number;
  code: string;
  name: string;
};

export type CompanyInvitation = {
  id: number;
  company_id: number;
  email: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  invited_by_user_id?: number | null;
  responded_by_user_id?: number | null;
  responded_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  company?: CompanyMini | null;
};

export type CompanyJoinRequest = {
  id: number;
  company_id: number;
  user_id: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_by_user_id?: number | null;
  reviewed_at?: string | null;
  created_at: string;
  company?: CompanyMini | null;
  user?: { id: number; name: string; email?: string | null } | null;
};

export type CompanyMembershipMe = {
  company?: CompanyMini | null;
  membership_status?: "ACTIVE" | "REMOVED" | null;
  invitations: CompanyInvitation[];
  pending_request?: CompanyJoinRequest | null;
};

export async function getMyCompanyMembership() {
  const res = await api.get<ApiResponse<CompanyMembershipMe>>("/company-membership/me");
  if (!res.data.result) throw new Error("Không lấy được trạng thái công ty");
  return res.data.result;
}

export async function createCompanyJoinRequest(companyCode: string) {
  const res = await api.post<ApiResponse<CompanyJoinRequest>>("/company-membership/join-requests", { company_code: companyCode });
  if (!res.data.result) throw new Error("Không gửi được yêu cầu tham gia");
  return res.data.result;
}

export async function acceptCompanyInvitation(invitationId: number) {
  const res = await api.post<ApiResponse<CompanyInvitation>>(`/company-membership/invitations/${invitationId}/accept`);
  if (!res.data.result) throw new Error("Không chấp nhận được lời mời");
  return res.data.result;
}

export async function declineCompanyInvitation(invitationId: number) {
  const res = await api.post<ApiResponse<CompanyInvitation>>(`/company-membership/invitations/${invitationId}/decline`);
  if (!res.data.result) throw new Error("Không từ chối được lời mời");
  return res.data.result;
}

export async function createCompanyInvitation(email: string) {
  const res = await api.post<ApiResponse<CompanyInvitation>>("/company-membership/invitations", { email });
  if (!res.data.result) throw new Error("Không tạo được lời mời");
  return res.data.result;
}

export async function listCompanyInvitations(params?: { status?: string }) {
  const res = await api.get<ApiResponse<CompanyInvitation[]>>("/company-membership/invitations", { params });
  return res.data.result ?? [];
}

export async function listCompanyJoinRequests(params?: { status?: string }) {
  const res = await api.get<ApiResponse<CompanyJoinRequest[]>>("/company-membership/join-requests", { params });
  return res.data.result ?? [];
}

export async function approveCompanyJoinRequest(requestId: number) {
  const res = await api.post<ApiResponse<CompanyJoinRequest>>(`/company-membership/join-requests/${requestId}/approve`);
  if (!res.data.result) throw new Error("Không duyệt được yêu cầu");
  return res.data.result;
}

export async function rejectCompanyJoinRequest(requestId: number) {
  const res = await api.post<ApiResponse<CompanyJoinRequest>>(`/company-membership/join-requests/${requestId}/reject`);
  if (!res.data.result) throw new Error("Không từ chối được yêu cầu");
  return res.data.result;
}
