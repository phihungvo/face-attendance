export type AuthMe = {
  user_id: number;
  username: string;
  company_id: number | null;
  company_name: string | null;
  company_logo_data_url: string | null;
  role_keys: string[];
  permission_keys: string[];
};

export type AuthSession = AuthMe & {
  roles: string[];
  token: string;
};

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};
