export type AppEnv = "production" | "demo" | "staging";

export const APP_ENV: AppEnv =
  (process.env.NEXT_PUBLIC_APP_ENV as AppEnv | undefined) ?? "production";

export const isDemo = APP_ENV === "demo";
export const isStaging = APP_ENV === "staging";
export const isProduction = APP_ENV === "production";
