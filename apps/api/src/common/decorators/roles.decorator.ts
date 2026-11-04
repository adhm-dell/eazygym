import { SetMetadata } from "@nestjs/common";
import type { StaffRole } from "@gym/contracts";

export const ROLES_KEY = "roles";
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

