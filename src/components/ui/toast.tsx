"use client";

import { createPortal } from "react-dom";
import {
  CircleAlert,
  CircleCheckBig,
  Info,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "./button";
import { mergeClasses } from "./classes";
import { roundedClasses, type Rounded } from "./form";
import { Icon, type IconComponent, type IconSize } from "./Icon";
import type { Shadow, ThemeInput } from "./theme";
import { BalsaThemeContext, useResolvedThemeProps } from "./theme-context";
import type { ActionColor, SemanticColor } from "./types";

/* The fixed ToastViewport applies pb-[max(1rem,env(safe-area-inset-bottom))]. */

export type ToastVariant = "surface" | "soft" | "outline" | "glass";
export type ToastSize = "sm" | "md" | "lg";

export interface ToastProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "title" | "children" | "color" | "onPause"
> {
  id?: string;
  open?: boolean;
  defaultOpen?: boolean;
  forceMount?: boolean;
  duration?: number;
  title?: ReactNode;
  "data-balsa"?: string;
  "data-palette"?: string;
  description?: ReactNode;
  color?: SemanticColor;
  variant?: ToastVariant | "default" | "destructive" | "success";
  size?: ToastSize;
  rounded?: Rounded;
  shadow?: Shadow;
  icon?: IconComponent;
  actionLabel?: string;
  dismissible?: boolean;
  closeLabel?: string;
  theme?: ThemeInput;
  onAction?: () => void;
  onDismiss?: () => void;
  onOpenChange?: (open: boolean) => void;
  onPause?: () => void;
  onResume?: () => void;
  action?: ReactNode | ((dismiss: () => void) => ReactNode);
  children?: ReactNode;
}

const defaultIcons: Readonly<Record<SemanticColor, IconComponent>> = {
  primary: Info,
  secondary: Info,
  accent: Star,
  destructive: CircleAlert,
  success: CircleCheckBig,
  warning: TriangleAlert,
  info: Info,
};
const colorVariantClasses: Readonly<
  Record<SemanticColor, Record<ToastVariant, string[]>>
> = {
  primary: {
    surface: ["border-balsa-primary/40", "bg-balsa-surface-elevated", "text-balsa-surface-elevated-foreground"],
    soft: ["border-balsa-primary/25", "bg-balsa-primary/15", "text-balsa-primary"],
    outline: ["border-balsa-primary", "bg-balsa-background", "text-balsa-foreground"],
    glass: ["border-balsa-primary/40", "bg-balsa-primary/10", "text-balsa-primary", "backdrop-balsa"],
  },
  secondary: {
    surface: ["border-balsa-secondary/40", "bg-balsa-surface-elevated", "text-balsa-surface-elevated-foreground"],
    soft: ["border-balsa-secondary/25", "bg-balsa-secondary/15", "text-balsa-secondary"],
    outline: ["border-balsa-secondary", "bg-balsa-background", "text-balsa-foreground"],
    glass: ["border-balsa-secondary/40", "bg-balsa-secondary/10", "text-balsa-secondary", "backdrop-balsa"],
  },
  accent: {
    surface: ["border-balsa-accent/40", "bg-balsa-surface-elevated", "text-balsa-surface-elevated-foreground"],
    soft: ["border-balsa-accent/25", "bg-balsa-accent/15", "text-balsa-accent"],
    outline: ["border-balsa-accent", "bg-balsa-background", "text-balsa-foreground"],
    glass: ["border-balsa-accent/40", "bg-balsa-accent/10", "text-balsa-accent", "backdrop-balsa"],
  },
  destructive: {
    surface: ["border-balsa-destructive/40", "bg-balsa-surface-elevated", "text-balsa-surface-elevated-foreground"],
    soft: ["border-balsa-destructive/25", "bg-balsa-destructive/15", "text-balsa-destructive"],
    outline: ["border-balsa-destructive", "bg-balsa-background", "text-balsa-foreground"],
    glass: ["border-balsa-destructive/40", "bg-balsa-destructive/10", "text-balsa-destructive", "backdrop-balsa"],
  },
  success: {
    surface: ["border-balsa-success/40", "bg-balsa-surface-elevated", "text-balsa-surface-elevated-foreground"],
    soft: ["border-balsa-success/25", "bg-balsa-success/15", "text-balsa-success"],
    outline: ["border-balsa-success", "bg-balsa-background", "text-balsa-foreground"],
    glass: ["border-balsa-success/40", "bg-balsa-success/10", "text-balsa-success", "backdrop-balsa"],
  },
  warning: {
    surface: ["border-balsa-warning/40", "bg-balsa-surface-elevated", "text-balsa-surface-elevated-foreground"],
    soft: ["border-balsa-warning/25", "bg-balsa-warning/15", "text-balsa-warning"],
    outline: ["border-balsa-warning", "bg-balsa-background", "text-balsa-foreground"],
    glass: ["border-balsa-warning/40", "bg-balsa-warning/10", "text-balsa-warning", "backdrop-balsa"],
  },
  info: {
    surface: ["border-balsa-info/40", "bg-balsa-surface-elevated", "text-balsa-surface-elevated-foreground"],
    soft: ["border-balsa-info/25", "bg-balsa-info/15", "text-balsa-info"],
    outline: ["border-balsa-info", "bg-balsa-background", "text-balsa-foreground"],
    glass: ["border-balsa-info/40", "bg-balsa-info/10", "text-balsa-info", "backdrop-balsa"],
  },
};
const iconColorClasses: Readonly<Record<SemanticColor, string>> = {
  primary: "text-balsa-primary",
  secondary: "text-balsa-secondary",
  accent: "text-balsa-accent",
  destructive: "text-balsa-destructive",
  success: "text-balsa-success",
  warning: "text-balsa-warning",
  info: "text-balsa-info",
};
const actionColorMap: Readonly<Record<SemanticColor, ActionColor>> = {
  primary: "primary",
  secondary: "secondary",
  accent: "accent",
  destructive: "destructive",
  success: "primary",
  warning: "accent",
  info: "primary",
};
const sizeClasses: Readonly<Record<ToastSize, string>> = {
  sm: "p-balsa-md text-sm",
  md: "p-balsa-lg text-sm",
  lg: "p-balsa-xl text-base",
};
const contentGapClasses: Readonly<Record<ToastSize, string>> = {
  sm: "gap-balsa-md",
  md: "gap-balsa-lg",
  lg: "gap-balsa-xl",
};
const iconSizes: Readonly<Record<ToastSize, IconSize>> = {
  sm: "md",
  md: "lg",
  lg: "xl",
};
const titleSizeClasses: Readonly<Record<ToastSize, string>> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export interface ToastProviderProps {
  children?: ReactNode;
  duration?: number;
  label?: string;
  swipeDirection?: string;
}

interface ToastProviderContextValue {
  duration?: number;
  label?: string;
  viewportHost?: HTMLElement | null;
  setViewportHost?: (host: HTMLElement | null) => void;
}

const ToastProviderContext = createContext<ToastProviderContextValue>({});

export function useToastProviderSettings(): ToastProviderContextValue {
  return useContext(ToastProviderContext);
}

export function ToastProvider({ children, duration, label }: ToastProviderProps) {
  const [viewportHost, setViewportHost] = useState<HTMLElement | null>(null);
  return (
    <ToastProviderContext.Provider value={{ duration, label, viewportHost, setViewportHost }}>
      {children}
    </ToastProviderContext.Provider>
  );
}

export const ToastTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(function ToastTitle(
  { className, ...props },
  ref,
) {
  return <h3 {...props} ref={ref} className={mergeClasses("font-semibold", className)} />;
});

export const ToastDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(function ToastDescription(
  { className, ...props },
  ref,
) {
  return <p {...props} ref={ref} className={mergeClasses("text-sm opacity-90", className)} />;
});

export interface ToastActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  altText?: string;
  children?: ReactNode;
}

export const ToastAction = forwardRef<HTMLButtonElement, ToastActionProps>(function ToastAction(
  { altText, children, className, color: _color, ...props },
  ref,
) {
  void _color;
  return (
    <Button
      {...props}
      ref={ref}
      size="sm"
      variant="outline"
      aria-label={props["aria-label"] ?? altText}
      className={mergeClasses("shrink-0", className)}
    >
      {children}
    </Button>
  );
});

export const ToastClose = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function ToastClose(
  { children, className, color: _color, ...props },
  ref,
) {
  void _color;
  return (
    <Button
      {...props}
      ref={ref}
      size={null}
      shape="fab"
      variant="outline"
      prefixIcon={X}
      aria-label={props["aria-label"] ?? "Close"}
      className={mergeClasses("size-8 min-h-0 min-w-0 border-0 p-0", className)}
    >
      {children}
    </Button>
  );
});

export type ToastActionElement = ReactElement<typeof ToastAction>;

export { ToastViewport } from "./ToastViewport";
export type { ToastViewportProps } from "./ToastViewport";

function findToastPart<T>(children: ReactNode, type: (props: T) => ReactNode): ReactElement<T> | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === type) return child as ReactElement<T>;
    const nested = findToastPart(
      (child as ReactElement<{ children?: ReactNode }>).props.children,
      type,
    );
    if (nested) return nested;
  }
  return undefined;
}

function isToastPart(type: unknown): boolean {
  return type === ToastTitle
    || type === ToastDescription
    || type === ToastAction
    || type === ToastClose;
}

function removeToastParts(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (isToastPart(child.type)) return null;
    const element = child as ReactElement<{ children?: ReactNode }>;
    if (!("children" in element.props)) return child;
    return cloneElement(element, {
      children: removeToastParts(element.props.children),
    });
  });
}

function normalizeToastVariant(variant: ToastProps["variant"]): ToastVariant {
  return variant === "default" || variant === "destructive" || variant === "success"
    ? "surface"
    : variant ?? "surface";
}

function normalizeToastColor(
  color: SemanticColor | undefined,
  variant: ToastProps["variant"],
): SemanticColor {
  if (variant === "destructive") return "destructive";
  if (variant === "success") return "success";
  return color ?? "primary";
}

export const Toast = forwardRef<HTMLElement, ToastProps>(function Toast(rawProps, ref) {
  const generatedId = useId();
  const providerSettings = useToastProviderSettings();
  const normalizedProps = {
    ...rawProps,
    ...(rawProps.variant === undefined
      ? {}
      : { variant: normalizeToastVariant(rawProps.variant) }),
    ...(rawProps.color !== undefined
      || rawProps.variant === "destructive"
      || rawProps.variant === "success"
      ? { color: normalizeToastColor(rawProps.color, rawProps.variant) }
      : {}),
  };
  const { props, theme } = useResolvedThemeProps("toast", "overlays", normalizedProps, {
    variant: "surface",
    size: "md",
    rounded: "lg",
    shadow: "auto",
  } as const);
  const {
    id,
    open,
    defaultOpen = true,
    forceMount = false,
    duration,
    title,
    "data-balsa": _dataBalsa,
    "data-palette": dataPalette,
    description,
    color = "primary",
    variant: rawVariant,
    size,
    rounded,
    shadow,
    icon,
    actionLabel,
    dismissible = true,
    closeLabel = "Dismiss notification",
    theme: _themeInput,
    onAction,
    onDismiss,
    onOpenChange,
    onPause,
    onResume,
    action,
    className,
    style,
    children,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...domProps
  } = props;
  void _dataBalsa;
  void _themeInput;

  const variant = normalizeToastVariant(rawVariant);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [pauseReasons, setPauseReasons] = useState({ focus: false, hover: false });
  const paused = pauseReasons.focus || pauseReasons.hover;
  const isOpen = open ?? uncontrolledOpen;
  const toastDuration = duration ?? providerSettings.duration ?? 5000;
  const timerRef = useRef<{
    duration: number;
    remaining: number;
    startedAt: number;
    handle?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const openRef = useRef(open);
  const callbacksRef = useRef({ onDismiss, onOpenChange });
  openRef.current = open;
  callbacksRef.current = { onDismiss, onOpenChange };

  useEffect(() => {
    if (!isOpen || !Number.isFinite(toastDuration) || toastDuration <= 0) {
      if (timerRef.current?.handle !== undefined) clearTimeout(timerRef.current.handle);
      timerRef.current = null;
      return;
    }
    if (!timerRef.current || timerRef.current.duration !== toastDuration) {
      timerRef.current = {
        duration: toastDuration,
        remaining: toastDuration,
        startedAt: 0,
      };
    }
    const timer = timerRef.current;
    if (paused) return;
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => {
      timerRef.current = null;
      if (openRef.current === undefined) setUncontrolledOpen(false);
      callbacksRef.current.onOpenChange?.(false);
      callbacksRef.current.onDismiss?.();
    }, timer.remaining);
    return () => {
      if (timer.handle === undefined) return;
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
      clearTimeout(timer.handle);
      timer.handle = undefined;
    };
  }, [isOpen, paused, toastDuration]);

  function dismissToast(): void {
    if (open === undefined) setUncontrolledOpen(false);
    onOpenChange?.(false);
    onDismiss?.();
  }

  if (!isOpen && !forceMount) return null;

  const titleElement = findToastPart<HTMLAttributes<HTMLHeadingElement>>(children, ToastTitle);
  const descriptionElement = findToastPart<HTMLAttributes<HTMLParagraphElement>>(children, ToastDescription);
  const legacyActionElement = findToastPart<ToastActionProps>(children, ToastAction);
  const closeElement = findToastPart<ButtonHTMLAttributes<HTMLButtonElement>>(children, ToastClose);
  const resolvedId = id ?? generatedId;
  const resolvedTitle = title ?? titleElement?.props.children ?? "Notification";
  const resolvedDescription = description ?? descriptionElement?.props.children;
  const hasDescription = resolvedDescription !== undefined && resolvedDescription !== null;
  const titleProps = titleElement?.props;
  const descriptionProps = descriptionElement?.props;
  const bodyChildren = removeToastParts(children);
  const currentIcon = icon ?? defaultIcons[color];
  const isTintedVariant = variant === "soft" || variant === "glass";
  const titleId = `${resolvedId}-title`;
  const descriptionId = hasDescription ? `${resolvedId}-description` : undefined;
  const legacyAction = legacyActionElement
    ? cloneElement(legacyActionElement, {
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          legacyActionElement.props.onClick?.(event);
          if (event.defaultPrevented) return;
          onAction?.();
          dismissToast();
        },
      })
    : undefined;
  const actionContent = typeof action === "function"
    ? action(dismissToast)
    : action ?? legacyAction;
  const closeClick = (event: MouseEvent<HTMLButtonElement>): void => {
    closeElement?.props.onClick?.(event);
    if (!event.defaultPrevented) dismissToast();
  };
  const resolvedCloseLabel = closeElement?.props["aria-label"] ?? closeLabel;
  const closeChildren = closeElement?.props.children;

  const classes = mergeClasses(
    "pointer-events-auto relative w-full min-w-0 border font-balsa-body shadow-balsa-surface outline-none",
    sizeClasses[size],
    roundedClasses[rounded],
    colorVariantClasses[color][variant],
    className,
  );

  function pause(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>): void {
    const reason = event.type === "mouseenter" ? "hover" : "focus";
    setPauseReasons((current) => ({ ...current, [reason]: true }));
    if (event.type === "mouseenter") onMouseEnter?.(event as MouseEvent<HTMLElement>);
    else onFocus?.(event as FocusEvent<HTMLElement>);
    onPause?.();
  }

  function resume(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>): void {
    const reason = event.type === "mouseleave" ? "hover" : "focus";
    setPauseReasons((current) => ({ ...current, [reason]: false }));
    if (event.type === "mouseleave") onMouseLeave?.(event as MouseEvent<HTMLElement>);
    else onBlur?.(event as FocusEvent<HTMLElement>);
    onResume?.();
  }

  const toastMarkup = (
    <BalsaThemeContext.Provider value={theme}>
      <article
        {...domProps}
        ref={ref}
        id={resolvedId}
        data-balsa="toast"
        data-theme={theme.explicitPresentation?.id}
        data-theme-base={theme.explicitPresentation?.base}
        data-palette={dataPalette}
        data-color={color}
        data-variant={variant}
        data-size={size}
        data-rounded={rounded}
        data-shadow={shadow}
        data-state={isOpen ? "open" : "closed"}
        role={color === "destructive" ? "alert" : "status"}
        aria-live={color === "destructive" ? "assertive" : "polite"}
        aria-atomic="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={classes}
        style={
          {
            ...theme.explicitPresentation?.style,
            ...style,
          } as CSSProperties
        }
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={resume}
      >
        <div className={mergeClasses("flex min-w-0 items-start", contentGapClasses[size])}>
          <Icon
            icon={currentIcon}
            size={iconSizes[size]}
            className={mergeClasses(
              "shrink-0",
              isTintedVariant ? "text-current" : iconColorClasses[color],
            )}
          />
          <div className={mergeClasses("min-w-0 flex-1", dismissible ? "pr-9" : "")}>
            <h3
              {...titleProps}
              id={titleId}
              className={mergeClasses(
                "m-0 font-semibold leading-tight",
                titleSizeClasses[size],
                titleProps?.className,
              )}
            >
              {resolvedTitle}
            </h3>
            {hasDescription ? (
              <p
                {...descriptionProps}
                id={descriptionId}
                className={mergeClasses(
                  "mt-balsa-3xs leading-relaxed",
                  isTintedVariant ? "text-current" : "text-balsa-muted-foreground",
                  descriptionProps?.className,
                )}
              >
                {resolvedDescription}
              </p>
            ) : null}
            {bodyChildren}
          </div>
        </div>

        {dismissible ? (
          <Button
            {...closeElement?.props}
            data-balsa-toast-close=""
            size={null}
            shape="fab"
            variant="outline"
            color="secondary"
            prefixIcon={X}
            aria-label={resolvedCloseLabel}
            className={mergeClasses(
              "absolute right-2 top-2 size-8 min-h-0 min-w-0 border-0 bg-transparent p-0 text-lg shadow-none",
              isTintedVariant
                ? "text-current hover:bg-current/15 active:bg-current/25"
                : "text-balsa-muted-foreground hover:bg-balsa-muted hover:text-balsa-foreground active:bg-balsa-muted",
              closeElement?.props.className,
            )}
            onClick={closeClick}
          >
            {closeChildren}
          </Button>
        ) : null}

        {actionLabel || actionContent ? (
          <div
            data-balsa-toast-action=""
            className="mt-balsa-md flex min-w-0 justify-end gap-balsa-xs"
          >
            {actionContent ?? (
              <Button
                variant="outline"
                color={actionColorMap[color]}
                size="sm"
                onClick={() => {
                  onAction?.();
                }}
              >
                {actionLabel}
              </Button>
            )}
          </div>
        ) : null}
      </article>
    </BalsaThemeContext.Provider>
  );

  return providerSettings.viewportHost
    ? createPortal(toastMarkup, providerSettings.viewportHost)
    : toastMarkup;
});
