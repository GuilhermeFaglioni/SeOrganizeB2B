"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Modal, ModalCloseContext } from "./Modal";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  [key: `data-${string}`]: string | undefined;
  children?: ReactNode;
}

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children?: ReactNode;
}

export interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children?: ReactNode;
}

export interface DialogCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children?: ReactNode;
}

export interface DialogTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children?: ReactNode;
}

export function DialogContent(_props: DialogContentProps): null {
  void _props;
  return null;
}

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <div className={className} {...props} />;
}

export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return <div className={className} {...props} />;
}

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <h2 className={className} {...props} />;
}

export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return <p className={className} {...props} />;
}

export function DialogPortal({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function DialogOverlay(_props: HTMLAttributes<HTMLDivElement>): null {
  void _props;
  return null;
}

export function DialogTrigger(_props: DialogTriggerProps): null {
  void _props;
  return null;
}

export function DialogClose({ asChild = false, children, onClick, ...props }: DialogCloseProps) {
  const close = useContext(ModalCloseContext);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) close?.();
  };

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
    return cloneElement(child, {
      ...props,
      onClick: (event: React.MouseEvent) => {
        onClick?.(event as React.MouseEvent<HTMLButtonElement>);
        child.props.onClick?.(event);
        if (!event.defaultPrevented) close?.();
      },
    });
  }

  return (
    <button type="button" {...props} onClick={handleClick}>
      {children}
    </button>
  );
}

function findElement<T>(children: ReactNode, type: (props: T) => ReactNode): ReactElement<T> | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === type) return child as ReactElement<T>;
    const nested = findElement(
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
        return textFromNode(
          (child as ReactElement<{ children?: ReactNode }>).props.children,
        );
      }
      return "";
    })
    .join("")
    .trim();
}

export function Dialog({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  const generatedId = useId();
  const trigger = findElement<DialogTriggerProps>(children, DialogTrigger);
  const {
    children: triggerChildren,
    asChild: triggerAsChild,
    ...triggerProps
  } = trigger?.props ?? {};
  const content = findElement<DialogContentProps>(children, DialogContent);
  if (!content) return <>{children}</>;

  const titleElement = findElement<DialogTitleProps>(content.props.children, DialogTitle);
  const descriptionElement = findElement<DialogDescriptionProps>(content.props.children, DialogDescription);
  const headerElement = findElement<DialogHeaderProps>(content.props.children, DialogHeader);
  const title = textFromNode(titleElement?.props.children) || "Dialog";
  const description = textFromNode(descriptionElement?.props.children) || undefined;
  const body = Children.toArray(content.props.children).filter((child) => {
    if (!isValidElement(child)) return true;
    return child.type !== DialogHeader && child.type !== DialogTitle && child.type !== DialogDescription;
  });

  const {
    children: _contentChildren,
    id: contentId,
    color: _contentColor,
    title: _contentTitle,
    className,
    style,
    ...contentProps
  } = content.props;
  void _contentChildren;
  void _contentColor;
  void _contentTitle;

  return (
    <Modal
      {...contentProps}
      id={contentId ?? generatedId}
      title={title}
      description={description}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className={className}
      style={style}
      headerClassName={headerElement?.props.className}
      trigger={triggerChildren}
      triggerAsChild={triggerAsChild}
      triggerProps={trigger ? triggerProps : undefined}
    >
      {body}
    </Modal>
  );
}
