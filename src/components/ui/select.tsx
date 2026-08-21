"use client";

import { Check, ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { useBalsaPortalScope } from "./BalsaPortalScope";
import { mergeClasses } from "./classes";
import {
  fieldHintClasses,
  fieldLabelClasses,
  fieldStatusMessages,
  getAnchoredPopupPosition,
  getFieldStateColorClass,
  getTextControlClasses,
  getTextControlPopupClasses,
  textControlOptionClasses,
  type FieldSize,
  type FieldStatus,
  type FieldVariant,
  type Rounded,
} from "./form";
import { Icon } from "./Icon";
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

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export type SelectModelValue = string | readonly string[];

interface BalsaSelectTriggerProps {
  id?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  "aria-busy"?: boolean;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  "aria-describedby"?: string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-activedescendant"?: string;
  "aria-disabled"?: boolean;
  "aria-haspopup"?: "listbox";
  tabIndex?: number;
  role?: string;
  "data-balsa-control"?: string;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
}

export interface SelectSelectedContext {
  option: SelectOption | undefined;
  options: readonly SelectOption[];
  text: string;
}

export interface SelectOptionContext {
  option: SelectOption;
  selected: boolean;
  active: boolean;
}

export interface BalsaSelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children" | "title" | "id" | "value" | "defaultValue"> {
  id: string;
  label: string;
  options: readonly SelectOption[];
  "data-balsa"?: string;
  "data-palette"?: string;
  size?: FieldSize;
  variant?: FieldVariant;
  placeholder?: string;
  hint?: string;
  loading?: boolean;
  status?: FieldStatus;
  statusMessage?: string;
  /* Not a button attribute, so it has to be declared rather than inherited:
   * the trigger only advertises the requirement through `aria-required`. */
  required?: boolean;
  multiple?: boolean;
  rounded?: Rounded;
  shadow?: Shadow;
  contained?: boolean;
  theme?: ThemeInput;
  value?: SelectModelValue;
  defaultValue?: SelectModelValue;
  ref?: Ref<HTMLElement>;
  trigger?: ReactElement<BalsaSelectTriggerProps>;
  triggerAsChild?: boolean;
  onValueChange?: (value: SelectModelValue) => void;
  renderSelected?: (context: SelectSelectedContext) => ReactNode;
  renderOption?: (context: SelectOptionContext) => ReactNode;
  renderOptionBefore?: (context: SelectOptionContext) => ReactNode;
}

/* `:popover-open` is a selector an engine can fail to parse rather than simply
 * not match, and `matches` throws when it does. A list that cannot answer the
 * question is treated as not in the top layer. */
function isPopoverOpen(element: HTMLElement | null): boolean {
  try {
    return element?.matches(":popover-open") ?? false;
  } catch {
    return false;
  }
}

function replaceSelectValue(children: ReactNode, replacement: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === SelectValue) return replacement;
    const element = child as ReactElement<{ children?: ReactNode }>;
    if (!("children" in element.props)) return child;
    return cloneElement(element, {
      children: replaceSelectValue(element.props.children, replacement),
    });
  });
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void | (() => void) {
  if (!ref) return undefined;
  if (typeof ref === "function") {
    return ref(value);
  }
  ref.current = value;
  return undefined;
}

function BalsaSelect(rawProps: BalsaSelectProps) {
  const { props, theme } = useResolvedThemeProps("select", "fields", rawProps, {
    size: "md",
    variant: "surface",
    rounded: "lg",
    shadow: "auto",
  } as const);
  const {
    id,
    label,
    options,
    "data-balsa": _dataBalsa,
    "data-palette": dataPalette,
    size,
    variant,
    placeholder,
    hint,
    disabled = false,
    loading = false,
    status = "default",
    statusMessage,
    required = false,
    multiple = false,
    rounded,
    shadow,
    contained = false,
    theme: _themeInput,
    value,
    defaultValue,
    ref: outerTriggerRef,
    trigger,
    triggerAsChild = false,
    onValueChange,
    renderSelected,
    renderOption,
    renderOptionBefore,
    onClick,
    onKeyDown,
    onFocus,
    onBlur,
    className,
    style,
    ...domProps
  } = props;
  void _dataBalsa;
  void _themeInput;

  const [model, setModel] = useControllableState<SelectModelValue>({
    value,
    defaultValue: defaultValue ?? (multiple ? [] : ""),
    onChange: onValueChange,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [supportsPopover, setSupportsPopover] = useState(false);
  const [popoverFailed, setPopoverFailed] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 0 });
  const [portalSnapshot, setPortalSnapshot] = useState<PortalPresentationSnapshot | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const openRef = useRef(isOpen);
  openRef.current = isOpen;

  const menuId = `${id}-menu`;
  const hintId = hint ? `${id}-hint` : undefined;
  const statusId = status === "unvalidated" ? `${id}-status` : undefined;
  const describedBy = [hintId, statusId].filter(Boolean).join(" ") || undefined;
  const isDisabled = disabled || loading;
  const triggerIsDisabled = isDisabled || Boolean(trigger?.props.disabled);
  const selectedValues: readonly string[] = Array.isArray(model)
    ? model
    : multiple
      ? []
      : [model as string];
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const triggerText = selectedOptions.length
    ? selectedOptions.map((option) => option.label).join(", ")
    : placeholder ?? "Select an option";
  const activeDescendant = activeOptionIndex >= 0
    ? `${id}-option-${activeOptionIndex}`
    : undefined;
  const effectiveStatusMessage = status === "unvalidated"
    ? statusMessage ?? fieldStatusMessages[status]
    : undefined;
  const currentIcon = loading ? LoaderCircle : isOpen ? ChevronUp : ChevronDown;

  /* The list leaves the subtree it was opened in, so it can only float once the
   * portal host exists. Before that -- server render, first paint -- it stays
   * inline and closed, which is also what `contained` asks for permanently. */
  const scope = useBalsaPortalScope();
  const floating = mounted && supportsPopover && !popoverFailed && !contained;
  const portalHost = floating ? (scope?.host ?? document.body) : null;

  function isOptionSelected(option: SelectOption): boolean {
    return selectedValues.includes(option.value);
  }

  function findFirstEnabledOptionIndex(): number {
    return options.findIndex((option) => !option.disabled);
  }

  function findNextEnabledOptionIndex(currentIndex: number, step: 1 | -1): number {
    if (!options.length) return -1;

    for (let offset = 1; offset <= options.length; offset += 1) {
      const nextIndex = (currentIndex + offset * step + options.length) % options.length;
      if (!options[nextIndex]?.disabled) return nextIndex;
    }

    return -1;
  }

  function positionMenu(): void {
    const triggerElement = triggerRef.current;
    const menuElement = menuRef.current;
    if (!openRef.current || !triggerElement || !menuElement) return;

    const next = getAnchoredPopupPosition(triggerElement, menuElement);
    setMenuPosition((current) => (
      current.left === next.left && current.top === next.top && current.width === next.width
        ? current
        : next
    ));
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
      setPortalSnapshot((current) => (
        current
          && current.themeId === snapshot.themeId
          && current.themeBase === snapshot.themeBase
          && current.paletteId === snapshot.paletteId
          && current.adapt === snapshot.adapt
          ? current
          : snapshot
      ));
    } catch {
      setPortalSnapshot((current) => current);
    }
  }

  function openMenu(): void {
    if (triggerIsDisabled || openRef.current) return;

    const selectedIndex = options.findIndex(
      (option) => isOptionSelected(option) && !option.disabled,
    );
    setActiveOptionIndex(selectedIndex >= 0 ? selectedIndex : findFirstEnabledOptionIndex());
    setIsOpen(true);
  }

  function closeMenu(): void {
    setIsOpen(false);
  }

  function selectOption(option: SelectOption): void {
    if (option.disabled) return;

    if (multiple) {
      setModel(
        isOptionSelected(option)
          ? selectedValues.filter((entry) => entry !== option.value)
          : [...selectedValues, option.value],
      );
      return;
    }

    setModel(option.value);
    closeMenu();
    queueMicrotask(() => triggerRef.current?.focus());
  }

  function handleKeydown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();

      if (!isOpen) {
        openMenu();
        return;
      }
    }

    if (event.key === "ArrowDown") {
      setActiveOptionIndex(findNextEnabledOptionIndex(activeOptionIndex, 1));
    }

    if (event.key === "ArrowUp") {
      setActiveOptionIndex(findNextEnabledOptionIndex(activeOptionIndex, -1));
    }

    if (event.key === "Home") {
      setActiveOptionIndex(findFirstEnabledOptionIndex());
    }

    if (event.key === "End") {
      setActiveOptionIndex(findNextEnabledOptionIndex(0, -1));
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (!isOpen) {
        openMenu();
        return;
      }

      const option = options[activeOptionIndex];
      if (option) selectOption(option);
    }

    if (event.key === "Escape" || event.key === "Tab") {
      closeMenu();
    }
  }

  useLayoutEffect(() => {
    setMounted(true);
    setSupportsPopover(
      typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype,
    );
  }, []);

  useLayoutEffect(() => {
    if (triggerIsDisabled && isOpen) closeMenu();
  }, [isOpen, triggerIsDisabled]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    capturePresentation();
    positionMenu();
  }, [isOpen, floating, contained, options.length]);

  /* The top layer is not something React renders into, so the popover has to be
   * opened imperatively once the element for this open state is in the DOM. */
  useLayoutEffect(() => {
    const menuElement = menuRef.current;
    if (!floating || !menuElement) return;

    try {
      if (isOpen && !isPopoverOpen(menuElement)) {
        menuElement.showPopover();
      } else if (!isOpen && isPopoverOpen(menuElement)) {
        menuElement.hidePopover();
      }
    } catch {
      setPopoverFailed(true);
    }
  }, [isOpen, floating]);

  useLayoutEffect(() => {
    if (!mounted) return;

    function handleDocumentPointerDown(event: PointerEvent): void {
      if (!openRef.current) return;
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    window.addEventListener("resize", positionMenu, { passive: true });
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [mounted, contained]);

  const listPresentation = portalSnapshot ?? {
    themeId: theme.presentation.id,
    themeBase: theme.presentation.base,
    paletteId: dataPalette,
    style: Object.fromEntries(
      Object.entries(theme.presentation.style).filter(([property]) => property.startsWith("--balsa-")),
    ) as PortalPresentationSnapshot["style"],
  };
  const menuClasses = mergeClasses(
    getTextControlPopupClasses(rounded, variant),
    "space-y-balsa-3xs",
    floating ? "fixed z-[70] m-0" : "absolute left-0 right-0 z-30 mt-balsa-xs",
    isOpen
      ? ["visible", "translate-y-0", "opacity-100"]
      : ["pointer-events-none", "invisible", "-translate-y-1", "opacity-0"],
  );
  const menuStyle = {
    ...(floating
      ? {
          left: `${menuPosition.left}px`,
          top: `${menuPosition.top}px`,
          width: `${menuPosition.width}px`,
        }
      : undefined),
    ...listPresentation.style,
  } as CSSProperties;

  const list = (
    <div
      id={menuId}
      ref={menuRef}
      data-balsa="select-popover"
      data-theme={listPresentation.themeId}
      data-theme-base={listPresentation.themeBase}
      data-palette={dataPalette ?? listPresentation.paletteId}
      data-shadow={shadow}
      data-state={isOpen ? "open" : "closed"}
      popover={floating ? "auto" : undefined}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      className={menuClasses}
      style={menuStyle}
      onToggle={() => {
        if (!isPopoverOpen(menuRef.current)) closeMenu();
      }}
    >
      {options.map((option, index) => {
        const selected = isOptionSelected(option);
        const active = index === activeOptionIndex;
        const optionContext = { option, selected, active };

        return (
          <Fragment key={option.value}>
            {renderOptionBefore?.(optionContext)}
            <button
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              disabled={option.disabled}
              aria-selected={selected}
              className={mergeClasses(
                textControlOptionClasses,
                option.disabled
                  ? "cursor-not-allowed bg-balsa-disabled text-balsa-disabled-foreground"
                  : selected
                    ? "cursor-pointer bg-balsa-selected/80 text-balsa-selected-foreground"
                    : [
                        "cursor-pointer text-balsa-surface-elevated-foreground",
                        active ? "bg-balsa-muted" : "",
                      ],
              )}
              onPointerEnter={() => {
                if (option.disabled) return;
                setActiveOptionIndex(index);
              }}
              onClick={() => selectOption(option)}
            >
              {renderOption?.(optionContext) ?? <span>{option.label}</span>}
              {selected ? <Icon icon={Check} size="md" className="shrink-0" /> : null}
            </button>
          </Fragment>
        );
      })}
    </div>
  );

  const triggerClasses = mergeClasses(
    getTextControlClasses(status, true, disabled, loading, size, rounded, variant),
    "flex items-center text-left",
    selectedOptions.length ? "" : "text-balsa-muted-foreground",
    className,
  );
  const triggerStyle = {
    ...theme.explicitPresentation?.style,
    ...style,
  } as CSSProperties;
  const selectedContent = renderSelected?.({
    option: selectedOptions[0],
    options: selectedOptions,
    text: triggerText,
  }) ?? triggerText;
  const handleTriggerClick = (event: React.MouseEvent<HTMLElement>): void => {
    if (triggerIsDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event as React.MouseEvent<HTMLButtonElement>);
    if (event.defaultPrevented) return;
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  };
  const triggerContent = triggerAsChild && isValidElement(trigger)
    ? cloneElement(trigger, {
        ...domProps,
        id,
        disabled: triggerIsDisabled,
        "aria-busy": loading ? true : undefined,
        "aria-invalid": status === "unvalidated" ? true : undefined,
        "aria-required": required,
        "aria-describedby": describedBy,
        "aria-expanded": isOpen,
        "aria-controls": menuId,
        "aria-activedescendant": activeDescendant,
        "aria-disabled": triggerIsDisabled ? true : trigger.props["aria-disabled"],
        "aria-haspopup": "listbox",
        tabIndex: triggerIsDisabled ? -1 : trigger.props.tabIndex,
        role: "combobox",
        "data-balsa-control": "",
        className: mergeClasses(triggerClasses, trigger.props.className),
        style: { ...triggerStyle, ...trigger.props.style },
        children: replaceSelectValue(trigger.props.children, selectedContent),
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node as HTMLButtonElement | null;
          const childCleanup = assignRef(trigger.props.ref, node);
          const outerCleanup = assignRef(outerTriggerRef, node);
          return () => {
            triggerRef.current = null;
            if (childCleanup) childCleanup();
            else assignRef(trigger.props.ref, null);
            if (outerCleanup) outerCleanup();
            else assignRef(outerTriggerRef, null);
          };
        },
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          if (triggerIsDisabled) {
            event.preventDefault();
            return;
          }
          trigger.props.onClick?.(event);
          handleTriggerClick(event);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (triggerIsDisabled) {
            if (event.key !== "Tab") event.preventDefault();
            return;
          }
          trigger.props.onKeyDown?.(event);
          onKeyDown?.(event as KeyboardEvent<HTMLButtonElement>);
          if (!event.defaultPrevented) handleKeydown(event as KeyboardEvent<HTMLButtonElement>);
        },
        onFocus: (event: React.FocusEvent<HTMLElement>) => {
          trigger.props.onFocus?.(event);
          onFocus?.(event as React.FocusEvent<HTMLButtonElement>);
        },
        onBlur: (event: React.FocusEvent<HTMLElement>) => {
          trigger.props.onBlur?.(event);
          onBlur?.(event as React.FocusEvent<HTMLButtonElement>);
        },
      })
    : (
        <button
          {...domProps}
          id={id}
          ref={(node) => {
            triggerRef.current = node;
            const cleanup = assignRef(outerTriggerRef, node);
            return () => {
              triggerRef.current = null;
              if (cleanup) cleanup();
              else assignRef(outerTriggerRef, null);
            };
          }}
          type="button"
          disabled={triggerIsDisabled}
          aria-busy={loading ? true : undefined}
          aria-invalid={status === "unvalidated" ? true : undefined}
          aria-required={required}
          aria-describedby={describedBy}
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-activedescendant={activeDescendant}
          aria-haspopup="listbox"
          role="combobox"
          data-balsa-control=""
          className={triggerClasses}
          style={triggerStyle}
          onClick={handleTriggerClick}
          onKeyDown={(event) => {
            if (triggerIsDisabled) {
              event.preventDefault();
              return;
            }
            onKeyDown?.(event);
            if (!event.defaultPrevented) handleKeydown(event);
          }}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {selectedContent}
        </button>
      );

  return (
    <BalsaThemeContext.Provider value={theme}>
      <div
        ref={rootRef}
        data-balsa="select"
        data-theme={theme.explicitPresentation?.id}
        data-theme-base={theme.explicitPresentation?.base}
        data-palette={dataPalette}
        data-rounded={rounded}
        data-variant={variant}
        style={theme.explicitPresentation?.style as CSSProperties | undefined}
      >
        {label ? (
          <label htmlFor={id} className={fieldLabelClasses}>
            {label}
            {required ? <span className="text-balsa-primary" aria-hidden="true">*</span> : null}
          </label>
        ) : null}
        <div className="relative">
          {triggerContent}
          {portalHost ? createPortal(list, portalHost) : list}
          <Icon
            icon={currentIcon}
            size="md"
            className={mergeClasses(
              "pointer-events-none absolute top-1/2 -translate-y-1/2",
              "right-3 text-lg",
              loading ? "text-balsa-info" : getFieldStateColorClass(status),
              loading ? "animate-spin" : "",
            )}
          />
        </div>
        {hint ? <span id={hintId} className={fieldHintClasses}>{hint}</span> : null}
        {effectiveStatusMessage ? (
          <span
            id={statusId}
            role="alert"
            className="mt-balsa-xs block text-sm font-medium text-balsa-destructive"
          >
            {effectiveStatusMessage}
          </span>
        ) : null}
      </div>
    </BalsaThemeContext.Provider>
  );
}

export interface LegacySelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

export interface SelectTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export interface SelectValueProps {
  placeholder?: string;
  children?: ReactNode;
}

export interface SelectContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
  children?: ReactNode;
}

export interface SelectGroupProps {
  children?: ReactNode;
}

export interface SelectLabelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export type SelectSeparatorProps = HTMLAttributes<HTMLDivElement>;

interface LegacySelectItem {
  element: ReactElement<SelectItemProps>;
  before?: ReactNode;
}

export function SelectTrigger(_props: SelectTriggerProps): null {
  void _props;
  return null;
}

export function SelectValue(_props: SelectValueProps): null {
  void _props;
  return null;
}

export function SelectContent(_props: SelectContentProps): null {
  void _props;
  return null;
}

export function SelectItem(_props: SelectItemProps): null {
  void _props;
  return null;
}

export function SelectGroup(_props: SelectGroupProps): null {
  void _props;
  return null;
}

export function SelectLabel(_props: SelectLabelProps): null {
  void _props;
  return null;
}

export function SelectSeparator(_props: SelectSeparatorProps): null {
  void _props;
  return null;
}

function findLegacyElement<T>(
  children: ReactNode,
  type: (props: T) => null,
): ReactElement<T> | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === type) return child as ReactElement<T>;
    const nested = findLegacyElement(
      (child as ReactElement<{ children?: ReactNode }>).props.children,
      type,
    );
    if (nested) return nested;
  }
  return undefined;
}

function renderLegacyMarker(
  element: ReactElement<SelectLabelProps | SelectSeparatorProps>,
  key: string,
): ReactNode {
  if (element.type === SelectLabel) {
    const { children, className, ...props } = element.props as SelectLabelProps;
    return (
      <div
        {...props}
        key={key}
        className={mergeClasses("px-3 py-1.5 text-xs font-semibold text-balsa-muted-foreground", className)}
      >
        {children}
      </div>
    );
  }

  const { className, ...props } = element.props as SelectSeparatorProps;
  return (
    <div
      {...props}
      key={key}
      role="separator"
      className={mergeClasses("my-1 h-px bg-balsa-border", className)}
    />
  );
}

function collectLegacyItems(
  children: ReactNode,
  initialBefore: ReactNode[] = [],
): { items: LegacySelectItem[]; pendingBefore: ReactNode[] } {
  const items: LegacySelectItem[] = [];
  let pendingBefore = [...initialBefore];
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === SelectItem) {
      items.push({
        element: child as ReactElement<SelectItemProps>,
        before: pendingBefore.length ? <>{pendingBefore}</> : undefined,
      });
      pendingBefore = [];
      continue;
    }
    if (child.type === SelectLabel || child.type === SelectSeparator) {
      pendingBefore.push(
        renderLegacyMarker(
          child as ReactElement<SelectLabelProps | SelectSeparatorProps>,
          `${String(child.key ?? "marker")}-${items.length}-${pendingBefore.length}`,
        ),
      );
      continue;
    }

    const nestedChildren = (child as ReactElement<{ children?: ReactNode }>).props.children;
    if (nestedChildren !== undefined) {
      const nested = collectLegacyItems(nestedChildren, pendingBefore);
      items.push(...nested.items);
      pendingBefore = nested.pendingBefore;
    }
  }
  return { items, pendingBefore };
}

function textFromNode(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement(child)) {
        return textFromNode(
          (child as ReactElement<{ children?: ReactNode }>).props.children,
        );
      }
      return "";
    })
    .join("")
    .trim();
}

function LegacySelect(rawProps: LegacySelectProps) {
  const generatedId = useId();
  const trigger = findLegacyElement<SelectTriggerProps>(rawProps.children, SelectTrigger);
  const valueElement = trigger
    ? findLegacyElement<SelectValueProps>(trigger.props.children, SelectValue)
    : undefined;
  const valueChildren = valueElement?.props.children;
  const hasValueChildren = valueChildren !== undefined && valueChildren !== null;
  const content = findLegacyElement<SelectContentProps>(rawProps.children, SelectContent);
  const itemElements = collectLegacyItems(content?.props.children).items;
  const itemContent = new Map(
    itemElements.map(({ element }) => [element.props.value, element.props.children]),
  );
  const itemBefore = new Map(
    itemElements.map(({ element, before }) => [element.props.value, before]),
  );
  const options = itemElements.map(({ element }) => ({
    label: textFromNode(element.props.children),
    value: element.props.value,
    disabled: element.props.disabled,
  }));
  const triggerProps = trigger?.props;
  const {
    children: _triggerChildren,
    asChild: triggerAsChild,
    id: triggerId,
    className,
    style,
    disabled: triggerDisabled,
    ...triggerDomProps
  } = triggerProps ?? {};
  void _triggerChildren;

  return (
    <BalsaSelect
      {...triggerDomProps}
      id={triggerId ?? rawProps.id ?? generatedId}
      label=""
      options={options}
      value={rawProps.value}
      defaultValue={rawProps.defaultValue}
      trigger={
        triggerAsChild && isValidElement(_triggerChildren)
          ? _triggerChildren as ReactElement<BalsaSelectTriggerProps>
          : undefined
      }
      triggerAsChild={triggerAsChild}
      disabled={rawProps.disabled ?? triggerDisabled}
      className={className}
      style={style}
      placeholder={valueElement?.props.placeholder}
      renderSelected={({ option, text }) => (
        option && hasValueChildren
          ? valueChildren
          : option
            ? text
            : valueElement?.props.placeholder ?? text
      )}
      onValueChange={(value) => {
        rawProps.onValueChange?.(Array.isArray(value) ? value[0] ?? "" : value);
      }}
      renderOption={({ option }) => itemContent.get(option.value) ?? option.label}
      renderOptionBefore={({ option }) => itemBefore.get(option.value)}
    />
  );
}

export type SelectProps = BalsaSelectProps | LegacySelectProps;

export function Select(props: BalsaSelectProps): ReactNode;
export function Select(props: LegacySelectProps): ReactNode;
export function Select(props: SelectProps): ReactNode {
  return "options" in props
    ? <BalsaSelect {...props} />
    : <LegacySelect {...props} />;
}
