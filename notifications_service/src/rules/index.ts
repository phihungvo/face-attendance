import type { NotificationRule } from "./NotificationRule.js";
import { EmployeeCheckinSuccessRule } from "./rules_employee_checkin_success.js";
import { EmployeeCheckoutSuccessRule } from "./rules_employee_checkout_success.js";
import { LeaveNewRule } from "./rules_leave_new.js";
import { LeaveApprovedRule } from "./rules_leave_approved.js";
import { LeaveRejectedRule } from "./rules_leave_rejected.js";
import { SystemAlertRule } from "./rules_system_alert.js";

export const rules: NotificationRule[] = [
  new EmployeeCheckinSuccessRule(),
  new EmployeeCheckoutSuccessRule(),
  new LeaveNewRule(),
  new LeaveApprovedRule(),
  new LeaveRejectedRule(),
  new SystemAlertRule()
];
