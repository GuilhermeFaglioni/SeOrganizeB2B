import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export interface AIConnectionData {
  id: string;
  provider: string;
  authMethod: string;
  ownershipMode: "managed" | "byok";
  defaultModel: string | null;
  status: "active" | "invalid" | "expired" | "revoked" | "disabled";
  createdBy: string;
  validatedAt: string | null;
  lastErrorCode: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIProviderModelData {
  id: string;
  vision: boolean;
  streaming: boolean;
  default: boolean;
}

export interface AIProviderOAuthData {
  status: "unsupported" | "requires_setup" | "supported";
  reasonKey: string;
}

export interface AIProviderData {
  id: string;
  name: string;
  authMethods: string[];
  oauth: AIProviderOAuthData;
  defaultModel: string;
  models: AIProviderModelData[];
}

export function useAIProviders() {
  return useQuery<AIProviderData[]>({
    queryKey: ["ai", "providers"],
    queryFn: () => fetchJson<AIProviderData[]>("/api/ai/providers"),
    staleTime: 60 * 1000,
  });
}

export function useAiConnections() {
  return useQuery<AIConnectionData[]>({
    queryKey: ["ai", "connections"],
    queryFn: () => fetchJson<AIConnectionData[]>("/api/ai/connections"),
  });
}

export function useConnectAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { provider: string; apiKey: string; defaultModel?: string }) =>
      fetchJson<AIConnectionData>("/api/ai/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "connections"] });
    },
  });
}

export function useValidateAiConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      fetchJson<AIConnectionData>(`/api/ai/connections/${provider}/validate`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "connections"] });
    },
  });
}

export function useRevokeAiConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      fetchJson<AIConnectionData>(`/api/ai/connections/${provider}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "connections"] });
    },
  });
}
