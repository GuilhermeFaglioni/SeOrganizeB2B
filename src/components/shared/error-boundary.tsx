"use client";

import React, { Component, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryFallback
          error={this.state.error}
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorBoundaryFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  const t = useTranslations("shared.errorBoundary");
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-danger mb-4" />
      <h2 className="text-heading-1 text-text-primary mb-2">{t("title")}</h2>
      <p className="text-body-small text-text-secondary mb-4 max-w-md">
        {error?.message || t("unexpectedError")}
      </p>
      <Button onClick={onReset}>
        {t("tryAgain")}
      </Button>
    </div>
  );
}
