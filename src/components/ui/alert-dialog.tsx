"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDialogContext = createContext<AlertDialogContextValue>({
  open: false,
  onOpenChange: () => {},
});

export function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleOpenChange = isControlled ? onOpenChange! : setInternalOpen;

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {children}
      </Dialog>
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogContent({ children, ...props }: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent {...props}>{children}</DialogContent>;
}

export function AlertDialogHeader({ children, ...props }: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader {...props}>{children}</DialogHeader>;
}

export function AlertDialogFooter({ children, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return <DialogFooter {...props}>{children}</DialogFooter>;
}

export function AlertDialogTitle({ children, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle {...props}>{children}</DialogTitle>;
}

export function AlertDialogDescription({ children, ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription {...props}>{children}</DialogDescription>;
}

export function AlertDialogAction({
  children,
  onClick,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { onOpenChange } = useContext(AlertDialogContext);
  return (
    <Button
      {...props}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(false);
      }}
    >
      {children}
    </Button>
  );
}

export function AlertDialogCancel({
  children,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { onOpenChange } = useContext(AlertDialogContext);
  return (
    <Button
      variant="outline"
      {...props}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(false);
      }}
    >
      {children}
    </Button>
  );
}
