import {
  defineTheme,
  type ThemeDefinition,
} from "@/components/ui/theme";
import { seOrganizeMaisDesignSystemTheme } from "@/themes/se-organize-mais-design-system";

export interface DesignThemeStoreOptions {
  themes?: readonly ThemeDefinition[];
}

export function createDesignThemeStore(
  options: DesignThemeStoreOptions = {},
) {
  const definitions = new Map<string, ThemeDefinition>();

  function registerDefinition(theme: ThemeDefinition): void {
    const definition = defineTheme(theme);
    if (definitions.has(definition.id)) {
      throw new TypeError(`Theme id "${definition.id}" is already registered.`);
    }
    definitions.set(definition.id, definition);
  }

  for (const theme of options.themes ?? []) registerDefinition(theme);

  return {
    get themes(): readonly ThemeDefinition[] {
      return Array.from(definitions.values());
    },
    getTheme(id: string): ThemeDefinition | undefined {
      return definitions.get(id);
    },
    hasTheme(id: string): boolean {
      return definitions.has(id);
    },
    registerTheme(theme: ThemeDefinition): void {
      registerDefinition(theme);
    },
  };
}

export const designThemeStore = createDesignThemeStore({
  themes: [seOrganizeMaisDesignSystemTheme],
});
