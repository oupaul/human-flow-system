export interface PunchStats {
  period: { from: string; to: string };
  rejectionsSince: string | null;
  defaultShift: string;
  summary: {
    systemEmployees: number; punchers: number; webPunches: number; hrCorrections: number; voided: number;
    ipBlocked: number; deviceBlocked: number; securityRejections: number;
    ipBlockedRate: number | null; deviceBlockedRate: number | null; operationalRejections: number;
    lateDays: number; workedDays: number; lateRate: number | null;
  };
  rejectionsByCode: { code: string; count: number; employees: number }[];
  weekly: { weekStart: string; webPunches: number; ipBlocked: number; deviceBlocked: number; exceptions: number; correctionRequests: number; hrCorrections: number }[];
  topIps: { ip: string | null; count: number; employees: number; lastSeen: string }[];
  topEmployees: { employeeId: string | null; name: string | null; department: string | null; total: number; ipBlocked: number; deviceBlocked: number }[];
  devices: { newDevices: number; status: { status: string; count: number }[]; employeesWithMultipleDevices: number; flags: Record<string, number> };
  exceptions: { total: number; open: number; byKind: { kind: string; count: number }[] };
  requests: { corrections: { status: string; count: number }[]; outings: { status: string; count: number }[] };
}
