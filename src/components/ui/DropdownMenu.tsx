"use client";

import {
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import {
  getAnchoredLayerPosition,
  type AnchoredAlign,
  type AnchoredSide,
} from "./anchored-layer";
import { useBalsaPortalScope } from "./BalsaPortalScope";
import { Button } from "./button";
import { mergeClasses } from "./classes";
import { roundedClasses, type Rounded } from "./form";
import { MenuList, type MenuListHandle } from "./MenuList";
import type { MenuItem, MenuSelection, MenuVariant } from "./menu";
import {
  capturePortalPresentation,
  type PortalPresentationSnapshot,
} from "./portal-core";
import type { Shadow, ThemeInput, ThemePresentation } from "./theme";
import {
  BalsaThemeContext,
  useControllableState,
  useResolvedThemeProps,
} from "./theme-context";
import type { ActionColor } from "./types";

export interface DropdownMenuProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "id" | "onSelect"
> {
  id: string;
  label: string;
  items: readonly MenuItem[];
  side?: AnchoredSide;
  align?: AnchoredAlign;
  sideOffset?: number;
  variant?: MenuVariant;
  color?: ActionColor;
  rounded?: Rounded;
  shadow?: Shadow;
  contained?: boolean;
  disabled?: boolean;
  theme?: ThemeInput;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (selection: MenuSelection) => void;
  trigger?: ReactNode;
  triggerAsChild?: boolean;
  triggerProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    ref?: Ref<HTMLElement>;
  };
  panelProps?: Omit<HTMLAttributes<HTMLDivElement>, "children">;
  "data-balsa"?: string;
  "data-palette"?: string;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void | (() => void) {
  if (!ref) return undefined;
  if (typeof ref === "function") return ref(value);
  ref.current = value;
  return undefined;
}

export function DropdownMenu(rawProps: DropdownMenuProps) {
  const { props, theme } = useResolvedThemeProps("dropdown-menu", "overlays", rawProps, {
    variant: "surface",
    rounded: "lg",
    shadow: "auto",
  } as const);
  const {
    id,
    label,
    items,
    side = "bottom",
    align = "start",
    sideOffset = 8,
    variant,
    color = "primary",
    rounded,
    shadow,
    contained = false,
    disabled = false,
    theme: _themeInput,
    open,
    defaultOpen = false,
    onOpenChange,
    onSelect,
    trigger,
    triggerAsChild = false,
    triggerProps,
    panelProps,
    "data-balsa": _dataBalsa,
    "data-palette": dataPalette,
    className,
    style,
    onKeyDown,
    ...domProps
  } = props;
  void _themeInput;
  void _dataBalsa;

  const [current, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const scope = useBalsaPortalScope();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<MenuListHandle | null>(null);
  const [mounted, setMounted] = useState(false);
  const [resolvedSide, setResolvedSide] = useState<AnchoredSide>(side);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 0 });
  const [portalSnapshot, setPortalSnapshot] = useState<PortalPresentationSnapshot | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const openRef = useRef(current);
  openRef.current = current;

  const showPanel = mounted && current;
  const portalHost = contained ? null : (scope?.host ?? (mounted ? document.body : null));

  function triggerElement(): HTMLElement | null {
    return rootRef.current?.querySelector<HTMLElement>(":scope > button, :scope > [role='button'], :scope > a") ?? null;
  }

  function close(restoreFocus = true): void {
    setOpen(false);
    if (restoreFocus) queueMicrotask(() => triggerElement()?.focus());
  }

  function capturePresentation(): void {
    const root = rootRef.current;
    if (!root?.isConnected) return;
    const currentTheme = themeRef.current;
    const presentation: ThemePresentation | undefined =
      currentTheme.inherited || currentTheme.explicitPresentation
        ? currentTheme.presentation
        : undefined;
    try {
      const snapshot = capturePortalPresentation(root, presentation);
      setPortalSnapshot((currentSnapshot) => (
        currentSnapshot
          && currentSnapshot.themeId === snapshot.themeId
          && currentSnapshot.themeBase === snapshot.themeBase
          && currentSnapshot.paletteId === snapshot.paletteId
          && currentSnapshot.adapt === snapshot.adapt
          ? currentSnapshot
          : snapshot
      ));
    } catch {
      setPortalSnapshot((currentSnapshot) => currentSnapshot);
    }
  }

  function updatePosition(): void {
    const triggerNode = triggerElement();
    const panelNode = panelRef.current;
    if (!triggerNode || !panelNode || !openRef.current) return;
    const next = getAnchoredLayerPosition(triggerNode, panelNode, {
      side,
      align,
      sideOffset,
      alignOffset: 0,
    });
    const rootRect = rootRef.current?.getBoundingClientRect();
    const left = next.left - (contained ? rootRect?.left ?? 0 : 0);
    const top = next.top - (contained ? rootRect?.top ?? 0 : 0);
    setPosition((currentPosition) => (
      currentPosition.left === left
        && currentPosition.top === top
        && currentPosition.maxHeight === next.maxHeight
        ? currentPosition
        : { left, top, maxHeight: next.maxHeight }
    ));
    setResolvedSide((currentSide) => currentSide === next.side ? currentSide : next.side);
  }

  function handleSelection(selection: MenuSelection): void {
    onSelect?.(selection);
    close();
  }

  function handleTriggerKeydown(event: KeyboardEvent<HTMLButtonElement>, enabled = true): void {
    onKeyDown?.(event as KeyboardEvent<HTMLElement>);
    if (event.defaultPrevented || !enabled) return;
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      queueMicrotask(() => {
        const buttons = panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]');
        buttons?.item(buttons.length - 1)?.focus();
      });
    }
  }

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!showPanel) return;
    capturePresentation();
    updatePosition();
    listRef.current?.focusFirst();
  }, [showPanel, side, align, sideOffset, contained]);

  useLayoutEffect(() => {
    if (!mounted) return;

    function handleDocumentPointer(event: PointerEvent): void {
      if (!openRef.current) return;
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointer, true);
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointer, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [mounted, contained, side, align, sideOffset]);

  const panelPresentation = portalSnapshot ?? {
    themeId: theme.presentation.id,
    themeBase: theme.presentation.base,
    paletteId: dataPalette,
    style: Object.fromEntries(
      Object.entries(theme.presentation.style).filter(([property]) => property.startsWith("--balsa-")),
    ) as PortalPresentationSnapshot["style"],
  };
  const triggerClasses = mergeClasses(
    "border-balsa-border-strong bg-balsa-surface px-balsa-md py-balsa-2xs text-balsa-surface-foreground hover:bg-balsa-muted",
    rawProps.rounded === undefined ? "rounded-balsa-control" : roundedClasses[rounded],
    triggerProps?.className,
    className,
  );
  const {
    style: triggerStyle,
    ref: outerTriggerRef,
    onClick: triggerOnClick,
    onKeyDown: triggerOnKeyDown,
    onFocus: triggerOnFocus,
    onBlur: triggerOnBlur,
    ...triggerDomProps
  } = triggerProps ?? {};
  const triggerDisabled = disabled || Boolean(triggerProps?.disabled);
  useLayoutEffect(() => {
    if (triggerDisabled && current) setOpen(false);
  }, [current, triggerDisabled]);
  const {
    className: panelClassName,
    style: panelStyleOverride,
    ...panelDomProps
  } = panelProps ?? {};
  const panelStyle = {
    left: `${position.left}px`,
    top: `${position.top}px`,
    maxHeight: `${position.maxHeight}px`,
    ...panelPresentation.style,
  } as CSSProperties;
  const panel = showPanel ? (
    <div
      {...panelDomProps}
      ref={panelRef}
      data-balsa="dropdown-menu-panel"
      data-theme={panelPresentation.themeId}
      data-theme-base={panelPresentation.themeBase}
      data-palette={dataPalette ?? panelPresentation.paletteId}
      data-side={resolvedSide}
      data-shadow={shadow}
      className={mergeClasses("z-[65]", contained ? "absolute" : "fixed", panelClassName)}
      style={{ ...panelStyleOverride, ...panelStyle }}
    >
      <MenuList
        id={id}
        ref={listRef}
        label={label}
        items={items}
        variant={variant}
        color={color}
        rounded={rounded}
        shadow={shadow}
        data-palette={dataPalette ?? panelPresentation.paletteId}
        onSelect={handleSelection}
        onDismiss={() => close()}
      />
    </div>
  ) : null;

  return (
    <BalsaThemeContext.Provider value={theme}>
      <span
        {...domProps}
        ref={rootRef}
        data-balsa="dropdown-menu"
        data-theme={theme.explicitPresentation?.id}
        data-theme-base={theme.explicitPresentation?.base}
        data-palette={dataPalette}
        data-color={color}
        data-rounded={rounded}
        data-state={current ? "open" : "closed"}
        className="relative inline-flex"
        style={{
          ...theme.explicitPresentation?.style,
          ...style,
        } as CSSProperties}
      >
        {triggerAsChild && isValidElement(trigger) ? (
          (() => {
            const child = trigger as ReactElement<{
              id?: string;
              ref?: Ref<HTMLElement>;
              className?: string;
              style?: CSSProperties;
              disabled?: boolean;
              "aria-disabled"?: boolean;
              tabIndex?: number;
              "aria-expanded"?: boolean;
              "aria-controls"?: string;
              "aria-haspopup"?: "menu";
              onClick?: (event: MouseEvent<HTMLElement>) => void;
              onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
              onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
              onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
            }>;
            const childDisabled = triggerDisabled || Boolean(child.props.disabled);
            return cloneElement(child, {
              ...triggerDomProps,
              id: `${id}-trigger`,
              disabled: childDisabled,
              "aria-disabled": childDisabled ? true : child.props["aria-disabled"],
              tabIndex: childDisabled ? -1 : child.props.tabIndex,
              "aria-expanded": current,
              "aria-controls": id,
              "aria-haspopup": "menu",
              className: mergeClasses(child.props.className, triggerClasses),
              style: { ...triggerStyle, ...child.props.style },
              ref: (node: HTMLElement | null) => {
                const childCleanup = assignRef(child.props.ref, node);
                const outerCleanup = assignRef(outerTriggerRef, node);
                return () => {
                  if (childCleanup) childCleanup();
                  else assignRef(child.props.ref, null);
                  if (outerCleanup) outerCleanup();
                  else assignRef(outerTriggerRef, null);
                };
              },
              onClick: (event: MouseEvent<HTMLElement>) => {
                if (childDisabled) {
                  event.preventDefault();
                  return;
                }
                triggerOnClick?.(event as MouseEvent<HTMLButtonElement>);
                child.props.onClick?.(event);
                if (!event.defaultPrevented && !childDisabled) setOpen(!current);
              },
              onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                if (childDisabled) {
                  if (event.key !== "Tab") event.preventDefault();
                  return;
                }
                triggerOnKeyDown?.(event as KeyboardEvent<HTMLButtonElement>);
                child.props.onKeyDown?.(event);
                handleTriggerKeydown(event as KeyboardEvent<HTMLButtonElement>, !childDisabled);
              },
              onFocus: (event: React.FocusEvent<HTMLElement>) => {
                child.props.onFocus?.(event);
                triggerOnFocus?.(event as React.FocusEvent<HTMLButtonElement>);
              },
              onBlur: (event: React.FocusEvent<HTMLElement>) => {
                child.props.onBlur?.(event);
                triggerOnBlur?.(event as React.FocusEvent<HTMLButtonElement>);
              },
            });
          })()
        ) : (
          <Button
            {...triggerDomProps}
            id={`${id}-trigger`}
            variant="outline"
            color="neutral"
            size="md"
            disabled={triggerDisabled}
            aria-expanded={current}
            aria-controls={id}
            aria-haspopup="menu"
            className={triggerClasses}
            style={triggerStyle}
            ref={(node) => {
              const cleanup = assignRef(outerTriggerRef, node);
              return () => {
                if (cleanup) cleanup();
                else assignRef(outerTriggerRef, null);
              };
            }}
            onClick={(event) => {
              if (triggerDisabled) {
                event.preventDefault();
                return;
              }
              triggerOnClick?.(event);
              if (!event.defaultPrevented) setOpen(!current);
            }}
            onKeyDown={(event) => {
              if (triggerDisabled) {
                event.preventDefault();
                return;
              }
              triggerOnKeyDown?.(event);
              if (!event.defaultPrevented) handleTriggerKeydown(event);
            }}
            onFocus={triggerOnFocus}
            onBlur={triggerOnBlur}
          >
            {trigger ?? "Open menu"}
          </Button>
        )}
        {contained ? panel : (portalHost && panel ? createPortal(panel, portalHost) : null)}
      </span>
    </BalsaThemeContext.Provider>
  );
}
