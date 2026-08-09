"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CurationState } from "../curation/curation-core";
import type { AdminController } from "./use-admin";

type AdminPanelProps = {
  open: boolean;
  onClose(): void;
  admin: AdminController;
  legacyState: CurationState | null;
  onMigrate(): Promise<void>;
  migrating: boolean;
  showcaseCount: number;
};

export function AdminPanel({
  open,
  onClose,
  admin,
  legacyState,
  onMigrate,
  migrating,
  showcaseCount,
}: AdminPanelProps) {
  const [password, setPassword] = useState("");
  const [confirmMigration, setConfirmMigration] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => passwordRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    if (await admin.login(password)) setPassword("");
  };

  return (
    <div className="admin-overlay">
      <button className="admin-backdrop" onClick={onClose} aria-label="关闭管理面板" />
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <button className="admin-close" onClick={onClose} aria-label="关闭管理面板">×</button>
        <span className="eyebrow">SPECTRA CONTROL</span>
        <h2 id="admin-title">管理首页</h2>

        {admin.authenticated ? (
          <div className="admin-session">
            <p>管理模式已开启。现在可以添加、删除和导出首页内容。</p>
            <dl>
              <div><dt>首页作品</dt><dd>{showcaseCount}</dd></div>
              <div><dt>会话</dt><dd>本浏览器，最长 12 小时</dd></div>
            </dl>

            {legacyState ? (
              <div className="admin-migration">
                <p>发现本机旧策展：{legacyState.showcase.length} 张卡片、{legacyState.deletedStudyIds.length} 个已删除效果。</p>
                {confirmMigration ? (
                  <div className="admin-confirm">
                    <p>服务器现有内容优先；旧内容会去重后合并。</p>
                    <button className="button button-primary" disabled={migrating} onClick={() => void onMigrate()}>
                      {migrating ? "正在同步…" : "确认同步"}
                    </button>
                    <button className="button button-quiet" onClick={() => setConfirmMigration(false)}>取消</button>
                  </div>
                ) : (
                  <button className="button" onClick={() => setConfirmMigration(true)}>同步本机策展</button>
                )}
              </div>
            ) : null}

            <button className="button button-quiet" disabled={admin.loading} onClick={() => void admin.logout()}>
              退出管理
            </button>
          </div>
        ) : (
          <form className="admin-login" onSubmit={submit}>
            <p>输入管理密码后，才能修改所有访客共同看到的首页。</p>
            <label>
              <span>管理密码</span>
              <input
                ref={passwordRef}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button button-primary" disabled={admin.loading || !password} type="submit">
              {admin.loading ? "验证中…" : "进入管理"}
            </button>
          </form>
        )}

        <p className="admin-status" aria-live="polite">{admin.error}</p>
      </section>
    </div>
  );
}
