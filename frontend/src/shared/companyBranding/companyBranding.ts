export const COMPANY_BRANDING_UPDATED_EVENT = "fa:company-branding-updated";

export type CompanyBrandingUpdatedDetail = {
  companyId: number | null;
  name?: string | null;
  logoDataUrl?: string | null;
};

export function emitCompanyBrandingUpdated(detail: CompanyBrandingUpdatedDetail) {
  window.dispatchEvent(new CustomEvent<CompanyBrandingUpdatedDetail>(COMPANY_BRANDING_UPDATED_EVENT, { detail }));
}
