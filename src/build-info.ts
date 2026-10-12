export interface AppBuildInfo {
  version: string;
  sourceHash: string | null;
  builtAt: string | null;
}
declare const __APP_BUILD__: AppBuildInfo;
export const APP_BUILD: AppBuildInfo = typeof __APP_BUILD__ === 'undefined'
  ? { version: 'development', sourceHash: null, builtAt: null }
  : __APP_BUILD__;
