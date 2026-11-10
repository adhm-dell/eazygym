import { SetMetadata } from "@nestjs/common";

export const NO_GYM_CONTEXT_KEY = "noGymContext";
export const NoGymContext = () => SetMetadata(NO_GYM_CONTEXT_KEY, true);
