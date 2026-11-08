import type { Config } from "tailwindcss";
import preset from "@gym/config/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx,js,jsx}",
    "../../packages/ui/src/**/*.{ts,tsx,js,jsx}",
    "../../packages/ui/dist/**/*.{js,mjs}",
  ],
};

export default config;

