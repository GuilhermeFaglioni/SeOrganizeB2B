import { precacheAndRoute } from "@serwist/precaching";

// __SW_MANIFEST is injected by Serwist's webpack plugin at build time.
// @ts-expect-error — defined at build time by webpack DefinePlugin
precacheAndRoute(self.__SW_MANIFEST);
