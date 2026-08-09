"use client";

import { useCallback, useEffect, useState } from "react";

export const SPECTRA_ADMIN_SESSION_EVENT = "spectra-admin-session-change";

export type AdminController = {
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  login(password: string): Promise<boolean>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
};

const errorMessage = (code: string) => {
  if (code === "INVALID_PASSWORD") return "密码不正确";
  if (code === "LOGIN_THROTTLED") return "尝试次数过多，请 15 分钟后再试";
  if (code === "NETWORK_ERROR") return "网络连接失败，请稍后重试";
  if (code === "SESSION_REQUIRED") return "管理会话已失效，请重新登录";
  return "操作失败，请稍后重试";
};

const readBody = async (response: Response) => {
  try {
    return (await response.json()) as {
      ok?: boolean;
      data?: { authenticated?: boolean };
      error?: { code?: string };
    };
  } catch {
    return null;
  }
};

export function useAdmin(): AdminController {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/session", {
        credentials: "same-origin",
      });
      const body = await readBody(response);
      const next = response.ok && body?.ok === true && body.data?.authenticated === true;
      setAuthenticated(next);
      setError(response.ok ? null : errorMessage(body?.error?.code ?? "REQUEST_FAILED"));
    } catch {
      setAuthenticated(false);
      setError(errorMessage("NETWORK_ERROR"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const onSessionChange = () => void refresh();
    window.addEventListener(SPECTRA_ADMIN_SESSION_EVENT, onSessionChange);
    return () => window.removeEventListener(SPECTRA_ADMIN_SESSION_EVENT, onSessionChange);
  }, [refresh]);

  const login = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await readBody(response);
      const success = response.ok && body?.ok === true && body.data?.authenticated === true;
      setAuthenticated(success);
      if (!success) setError(errorMessage(body?.error?.code ?? "REQUEST_FAILED"));
      return success;
    } catch {
      setAuthenticated(false);
      setError(errorMessage("NETWORK_ERROR"));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await readBody(response);
      if (!response.ok || body?.ok !== true) {
        setError(errorMessage(body?.error?.code ?? "REQUEST_FAILED"));
      }
    } catch {
      setError(errorMessage("NETWORK_ERROR"));
    } finally {
      setAuthenticated(false);
      setLoading(false);
    }
  }, []);

  return { loading, authenticated, error, login, logout, refresh };
}
