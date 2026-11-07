import { SetMetadata } from "@nestjs/common";

export const REQUIRE_OPEN_SHIFT_KEY = "requireOpenShift";
export const RequireOpenShift = () => SetMetadata(REQUIRE_OPEN_SHIFT_KEY, true);

