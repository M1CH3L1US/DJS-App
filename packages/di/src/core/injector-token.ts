import { InjectionToken } from "@di/providers";
import type { Injector } from "./injector";

export const INJECTOR = new InjectionToken<Injector>(
  "The current module injector for a given module.",
  {
    providedIn: "module",
  }
);

export const ROOT_INJECTOR = new InjectionToken<Injector>(
  "The application root injector"
);