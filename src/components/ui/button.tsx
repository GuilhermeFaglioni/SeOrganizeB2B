"use client";

import { LoaderCircle } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type Ref,
  type ReactNode,
} from "react";
import { actionColorClasses, type ActionColor } from "./types";
import { type Shadow, type ThemeInput } from "./theme";
import {
  BalsaThemeContext,
  useResolvedThemeProps,
} from "./theme-context";
import { mergeClasses } from "./classes";
import { Icon, type IconComponent, type IconSize } from "./Icon";

export type ButtonVariant =
  | "solid"
  | "soft"
  | "outline"
  | "glass"
  | "text"
  | "default"
  | "destructive"
  | "secondary"
  | "ghost"
  | "link";
type ButtonSize = "sm" | "md" | "lg" | "xl" | "2xl";
type LegacyButtonSize = "default" | "icon";
type ButtonShape = "rounded" | "pill" | "fab";
type ButtonIconPlacement = "none" | "prefix" | "suffix" | "both";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: ActionColor;
  size?: ButtonSize | LegacyButtonSize | null;
  shape?: ButtonShape;
  prefixIcon?: IconComponent;
  suffixIcon?: IconComponent;
  loading?: boolean;
  analyticsEvent?: string;
  shadow?: Shadow;
  theme?: ThemeInput;
  asChild?: boolean;
  children?: ReactNode;
}

type BalsaButtonVariant = "solid" | "soft" | "outline" | "glass" | "text";

function normalizeVariant(variant: ButtonVariant | undefined): BalsaButtonVariant {
  if (!variant) return "solid";
  if (variant === "default") return "solid";
  if (variant === "destructive" || variant === "secondary" || variant === "ghost") {
    return variant === "ghost" ? "soft" : "solid";
  }
  if (variant === "link") return "text";
  return variant;
}

function normalizeColor(
  variant: ButtonVariant | undefined,
  color: ActionColor | undefined,
): ActionColor {
  if (color) return color;
  if (variant === "destructive") return "destructive";
  if (variant === "secondary") return "secondary";
  if (variant === "ghost" || variant === "link") return "neutral";
  return "primary";
}

function normalizeSize(size: ButtonProps["size"]): ButtonSize | null | undefined {
  if (size === "default") return "md";
  if (size === "icon") return "md";
  return size;
}

const sizeClasses: Record<ButtonSize, string[]> = {
  sm: ["h-8", "gap-balsa-2xs", "text-sm"],
  md: ["h-9", "gap-balsa-xs", "text-sm"],
  lg: ["h-10", "gap-balsa-xs", "text-sm"],
  xl: ["h-12", "gap-balsa-sm", "text-base"],
  "2xl": ["h-18", "gap-balsa-md", "text-xl"],
};

/*
 * The inset is not here any more. It follows from the size, and from whether an
 * icon sits beside it; both are published as data for the stylesheet to key on.
 * See the icon-adjacency rule in balsa-theme.css.
 */
const iconSizes: Record<ButtonSize, IconSize> = {
  sm: "sm",
  md: "sm",
  lg: "md",
  xl: "md",
  "2xl": "lg",
};

const shapeClasses: Record<ButtonShape, string[]> = {
  rounded: ["rounded-balsa-control"],
  pill: ["rounded-balsa-pill"],
  fab: ["rounded-balsa-pill", "p-0"],
};

const fabSizeClasses: Record<ButtonSize, string[]> = {
  sm: ["h-8", "w-8"],
  md: ["h-9", "w-9"],
  lg: ["h-10", "w-10"],
  xl: ["h-12", "w-12"],
  "2xl": ["h-18", "w-18"],
};

const fabIconSizes: Record<ButtonSize, IconSize> = {
  sm: "sm",
  md: "md",
  lg: "md",
  xl: "lg",
  "2xl": "xl",
};

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(rawProps, ref) {
  const normalizedProps = {
    ...rawProps,
    variant: normalizeVariant(rawProps.variant),
    color: normalizeColor(rawProps.variant, rawProps.color),
    size: normalizeSize(rawProps.size),
    className: rawProps.size === "icon"
      ? mergeClasses("h-9 w-9 p-0", rawProps.className)
      : rawProps.className,
  } as ButtonProps;
  const { props, theme } = useResolvedThemeProps("button", "controls", normalizedProps, {
    variant: "solid",
    size: "md",
    shape: "rounded",
    shadow: "auto",
  } as const);
  const {
  variant: rawVariant,
  color = "primary",
  size: rawSize,
  shape,
  prefixIcon,
  suffixIcon,
  disabled = false,
  loading = false,
  analyticsEvent,
  type = "button",
  shadow,
  theme: _themeInput,
  asChild = false,
  className,
   style,
   children,
   onClick,
   ...domProps
  } = props;
  void _themeInput;

  const variant = normalizeVariant(rawVariant);
  const size = normalizeSize(rawSize);
  const Comp = asChild ? Slot : "button";

  const leadingIcon = loading ? LoaderCircle : prefixIcon;
  const trailingIcon = loading ? undefined : suffixIcon;

  const iconPlacement: ButtonIconPlacement = leadingIcon && trailingIcon
    ? "both"
    : leadingIcon
      ? "prefix"
      : trailingIcon
        ? "suffix"
        : "none";

  const isDisabled = disabled || loading;
  const guardedClick = asChild && isDisabled
    ? (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
      }
    : onClick;
  const classes = mergeClasses(
    // No `duration-200 ease-in-out`. The shared control rule already sets
    // transition duration and easing from the motion tokens, and a literal
    // utility outranks it -- so every button animated for a fixed 200ms at
    // every motion setting, including the one that asks for none.
     "inline-flex w-fit min-h-[44px] items-center justify-center font-balsa-body transition-colors hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-balsa-focus-ring focus-visible:ring-2 focus-visible:ring-balsa-focus-ring disabled:border-balsa-disabled disabled:bg-balsa-disabled disabled:text-balsa-disabled-foreground md:min-h-9",
    actionColorClasses[color][variant],
    variant === "outline" ? ["bg-transparent"] : [],
    size ? sizeClasses[size] : [],
    shapeClasses[shape],
    shape === "fab" && size
      ? fabSizeClasses[size]
      : [],
    loading ? "disabled:cursor-progress" : "disabled:cursor-not-allowed",
    className,
  );

  const iconSize: IconSize = !size
    ? "md"
    : shape === "fab"
      ? fabIconSizes[size]
      : iconSizes[size];

  return (
    <BalsaThemeContext.Provider value={theme}>
      <Comp
        {...domProps}
        ref={ref as Ref<HTMLButtonElement>}
        data-balsa="button"
        data-balsa-track={analyticsEvent?.trim() || undefined}
        data-theme={theme.explicitPresentation?.id}
        data-theme-base={theme.explicitPresentation?.base}
        data-variant={variant}
        data-shape={shape}
        data-color={color}
        data-shadow={shadow}
        data-size={size ?? undefined}
        data-icon={iconPlacement}
        type={asChild ? undefined : type}
        disabled={asChild ? undefined : isDisabled}
        aria-disabled={asChild && isDisabled ? true : undefined}
        tabIndex={asChild && isDisabled ? -1 : undefined}
         aria-busy={loading ? true : undefined}
         onClick={guardedClick}
        style={
          {
            ...theme.explicitPresentation?.style,
            ...style,
          } as CSSProperties
        }
        className={classes}
      >
        {asChild ? children : (
          <>
            {leadingIcon ? (
              <Icon
                icon={leadingIcon}
                size={iconSize}
                className={loading ? "animate-spin" : undefined}
              />
            ) : null}
            {children}
            {trailingIcon ? <Icon icon={trailingIcon} size={iconSize} /> : null}
          </>
        )}
      </Comp>
    </BalsaThemeContext.Provider>
  );
});

Button.displayName = "Button";
