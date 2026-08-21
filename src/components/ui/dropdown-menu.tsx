"use client";

import {
  Children,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { DropdownMenu as BalsaDropdownMenu } from "./DropdownMenu";
import type { MenuItem, MenuSelection } from "./menu";

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
}

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  children?: ReactNode;
}

export interface DropdownMenuItemProps extends HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}

export interface DropdownMenuCheckboxItemProps extends DropdownMenuItemProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export interface DropdownMenuRadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

export interface DropdownMenuRadioItemProps extends DropdownMenuItemProps {
  value: string;
}

export interface DropdownMenuSubProps {
  children?: ReactNode;
}

export type DropdownMenuSubTriggerProps = DropdownMenuItemProps;

export interface DropdownMenuSubContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export interface DropdownMenuLabelProps extends HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  children?: ReactNode;
}

export type DropdownMenuSeparatorProps = HTMLAttributes<HTMLDivElement>;

export type DropdownMenuShortcutProps = HTMLAttributes<HTMLSpanElement>;

export function DropdownMenuTrigger(_props: DropdownMenuTriggerProps): null {
  void _props;
  return null;
}

export function DropdownMenuContent(_props: DropdownMenuContentProps): null {
  void _props;
  return null;
}

export function DropdownMenuItem(_props: DropdownMenuItemProps): null {
  void _props;
  return null;
}

export function DropdownMenuCheckboxItem(_props: DropdownMenuCheckboxItemProps): null {
  void _props;
  return null;
}

export function DropdownMenuRadioGroup(_props: DropdownMenuRadioGroupProps): null {
  void _props;
  return null;
}

export function DropdownMenuRadioItem(_props: DropdownMenuRadioItemProps): null {
  void _props;
  return null;
}

export function DropdownMenuSub(_props: DropdownMenuSubProps): null {
  void _props;
  return null;
}

export function DropdownMenuSubTrigger(_props: DropdownMenuSubTriggerProps): null {
  void _props;
  return null;
}

export function DropdownMenuSubContent(_props: DropdownMenuSubContentProps): null {
  void _props;
  return null;
}

export function DropdownMenuLabel(_props: DropdownMenuLabelProps): null {
  void _props;
  return null;
}

export function DropdownMenuSeparator(_props: DropdownMenuSeparatorProps): null {
  void _props;
  return null;
}

export function DropdownMenuShortcut({ children, ...props }: DropdownMenuShortcutProps) {
  return <span {...props}>{children}</span>;
}

export function DropdownMenuGroup({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function DropdownMenuPortal({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function findDirect<T>(children: ReactNode, type: (props: T) => null): ReactElement<T> | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === type) return child as ReactElement<T>;
    const nested = findDirect(
      (child as ReactElement<{ children?: ReactNode }>).props.children,
      type,
    );
    if (nested) return nested;
  }
  return undefined;
}

function textFromNode(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement(child)) {
        return textFromNode((child as ReactElement<{ children?: ReactNode }>).props.children);
      }
      return "";
    })
    .join("")
    .trim();
}

interface CollectedMenuItem {
  item: MenuItem;
  onSelect?: () => void;
  onCheckedChange?: (checked: boolean) => void;
  onValueChange?: (value: string) => void;
  children?: CollectedMenuItem[];
}

interface RadioGroupContext {
  value?: string;
  onValueChange?: (value: string) => void;
}

function collectItems(
  children: ReactNode,
  nextId: () => string,
  radioGroup?: RadioGroupContext,
): CollectedMenuItem[] {
  const items: CollectedMenuItem[] = [];
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === DropdownMenuLabel) {
      const props = child.props as DropdownMenuLabelProps;
      items.push({
        item: { id: nextId(), label: textFromNode(props.children), type: "label" },
      });
      continue;
    }
    if (child.type === DropdownMenuSeparator) {
      items.push({ item: { id: nextId(), type: "separator" } });
      continue;
    }
    if (child.type === DropdownMenuRadioGroup) {
      const props = child.props as DropdownMenuRadioGroupProps;
      items.push(...collectItems(props.children, nextId, {
        value: props.value,
        onValueChange: props.onValueChange,
      }));
      continue;
    }
    if (child.type === DropdownMenuItem) {
      const props = child.props as DropdownMenuItemProps;
      items.push({
        item: {
          id: nextId(),
          label: textFromNode(props.children),
          type: "action",
          disabled: props.disabled,
          destructive: props.destructive,
        },
        onSelect: props.onSelect,
      });
      continue;
    }
    if (child.type === DropdownMenuCheckboxItem) {
      const props = child.props as DropdownMenuCheckboxItemProps;
      items.push({
        item: {
          id: nextId(),
          label: textFromNode(props.children),
          type: "checkbox",
          disabled: props.disabled,
          checked: props.checked,
        },
        onCheckedChange: props.onCheckedChange,
      });
      continue;
    }
    if (child.type === DropdownMenuRadioItem) {
      const props = child.props as DropdownMenuRadioItemProps;
      items.push({
        item: {
          id: nextId(),
          label: textFromNode(props.children),
          type: "radio",
          disabled: props.disabled,
          value: props.value,
          checked: radioGroup?.value === props.value,
        },
        onValueChange: radioGroup?.onValueChange,
      });
      continue;
    }
    if (child.type === DropdownMenuSub) {
      const subChildren = Children.toArray(
        (child as ReactElement<{ children?: ReactNode }>).props.children,
      );
      const subTrigger = subChildren.find(
        (candidate): candidate is ReactElement<DropdownMenuSubTriggerProps> =>
          isValidElement(candidate) && candidate.type === DropdownMenuSubTrigger,
      );
      const subContent = subChildren.find(
        (candidate): candidate is ReactElement<DropdownMenuSubContentProps> =>
          isValidElement(candidate) && candidate.type === DropdownMenuSubContent,
      );
      if (subTrigger && subContent) {
        const children = collectItems(subContent.props.children, nextId, radioGroup);
        items.push({
          item: {
            id: nextId(),
            label: textFromNode(subTrigger.props.children),
            type: "submenu",
            disabled: subTrigger.props.disabled,
            children: children.map(({ item }) => item),
          },
          children,
        });
      }
      continue;
    }
    if (
      child.type === DropdownMenuGroup
      || child.type === DropdownMenuSubContent
      || child.type === DropdownMenuPortal
    ) {
      items.push(...collectItems((child as ReactElement<{ children?: ReactNode }>).props.children, nextId));
    }
  }
  return items;
}

export function DropdownMenu({ open, defaultOpen, onOpenChange, children }: DropdownMenuProps) {
  const generatedId = useId();
  const trigger = findDirect<DropdownMenuTriggerProps>(children, DropdownMenuTrigger);
  const content = findDirect<DropdownMenuContentProps>(children, DropdownMenuContent);
  if (!content) return null;

  const triggerChild = trigger?.props.children ?? <span>Open menu</span>;
  const triggerElement = isValidElement(triggerChild) ? triggerChild : <span>{triggerChild}</span>;
  const {
    children: _triggerChildren,
    asChild: triggerAsChild,
    ...triggerProps
  } = trigger?.props ?? {};
  void _triggerChildren;
  let counter = 0;
  const collected = collectItems(content.props.children, () => `${generatedId}-${++counter}`);
  const callbacks = new Map<string, {
    onSelect?: () => void;
    onCheckedChange?: (checked: boolean) => void;
    onValueChange?: (value: string) => void;
  }>();
  function registerCallbacks(items: CollectedMenuItem[]): void {
    for (const { item, onSelect, onCheckedChange, onValueChange, children } of items) {
      callbacks.set(item.id, { onSelect, onCheckedChange, onValueChange });
      if (children) registerCallbacks(children);
    }
  }
  registerCallbacks(collected);
  const triggerLabelProps = isValidElement(triggerElement)
    ? triggerElement.props as { "aria-label"?: string; title?: string }
    : {};
  const {
    children: _contentChildren,
    id: contentId,
    sideOffset,
    className: panelClassName,
    style: panelStyle,
    ...panelProps
  } = content.props;
  void _contentChildren;

  return (
    <BalsaDropdownMenu
       id={contentId ?? generatedId}
       label={triggerLabelProps["aria-label"] ?? triggerLabelProps.title ?? (textFromNode(triggerChild) || "Menu")}
      items={collected.map(({ item }) => item)}
      open={open}
      defaultOpen={defaultOpen}
       onOpenChange={onOpenChange}
       trigger={triggerElement}
       triggerAsChild={triggerAsChild}
       triggerProps={trigger ? triggerProps : undefined}
       panelProps={{ ...panelProps, className: panelClassName, style: panelStyle }}
       sideOffset={sideOffset}
       onSelect={(selection: MenuSelection) => {
         const callback = callbacks.get(selection.id);
         callback?.onSelect?.();
         if (selection.type === "checkbox") callback?.onCheckedChange?.(selection.checked ?? false);
         if (selection.type === "radio" && selection.value) callback?.onValueChange?.(selection.value);
       }}
     />
  );
}
