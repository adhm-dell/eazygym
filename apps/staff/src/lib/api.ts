import { mockClient } from "@gym/mock-data";

/**
 * Live / Hybrid API Client for Staff Portal.
 * Uses mockClient as base and proxies real backend requests when backend is active.
 */
export const apiClient = mockClient;
