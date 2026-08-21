"use client";

import { Children, isValidElement, useId, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { Popup } from "./Popup";

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export interface PopoverTriggerProps {
  asChild?: boolean;
  children?: ReactNode;
}

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  children?: ReactNode;
}

export function PopoverTrigger(_props: PopoverTriggerProps): null {
  void _props;
  return null;
}

export function PopoverContent(_props: PopoverContentProps): null {
  void _props;
  return null;
}

function findDirect<T>(children: ReactNode, type: (props: T) => null): ReactElement<T> | undefined {
  return Children.toArray(children).find(
    (child): child is ReactElement<T> => isValidElement(child) && child.type === type,
  );
}

export function Popover({ open, defaultOpen, onOpenChange, children }: PopoverProps) {
  const generatedId = useId();
  const trigger = findDirect<PopoverTriggerProps>(children, PopoverTrigger);
  const content = findDirect<PopoverContentProps>(children, PopoverContent);
  if (!content) return null;

  const triggerChild = trigger?.props.children ?? <span>Open popover</span>;
  const triggerElement = isValidElement(triggerChild)
    ? triggerChild
    : <span>{triggerChild}</span>;
  const triggerProps = isValidElement(triggerElement)
    ? triggerElement.props as { "aria-label"?: string; title?: string }
    : {};
  const {
    align = "center",
    side = "bottom",
    sideOffset = 4,
    className,
    style,
    id,
    children: contentChildren,
    ...contentProps
  } = content.props;

  return (
    <Popup
      {...contentProps}
      id={id ?? generatedId}
      label={triggerProps["aria-label"] ?? triggerProps.title ?? "Popover"}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      side={side}
      align={align}
      sideOffset={sideOffset}
      trigger={triggerElement}
      triggerAsChild={Boolean(trigger?.props.asChild && isValidElement(triggerElement))}
      className={className}
      style={style}
    >
      {contentChildren}
    </Popup>
  );
}
