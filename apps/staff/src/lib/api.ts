import { mockClient } from "@gym/mock-data";

/**
 * Typed client stub.
 * Until the NestJS API is connected, this reads and writes through @gym/mock-data.
 */
export const apiClient = mockClient;
