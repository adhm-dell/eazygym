import { apiClient } from "../../lib/api";

export const scanApi = {
  evaluateDoorScan: (code: string, now?: Date) => apiClient.evaluateDoorScan(code, now),
  listAccessLogs: () => apiClient.listAccessLogs(),
  recordAccessLog: (entry: Parameters<typeof apiClient.recordAccessLog>[0]) =>
    apiClient.recordAccessLog(entry),
};
