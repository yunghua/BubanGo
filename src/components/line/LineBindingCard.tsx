"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { initLiff, getLineIdToken, isLiffConfigured } from "@/lib/line/liff";
import {
  getMyLineAccount,
  linkLineAccount,
  unlinkLineAccount,
  isLocalBackend,
  LineLinkError,
  type LineAccount,
  type LineLinkErrorCode,
} from "@/lib/line/line-service";

type View =
  | { kind: "loading" }
  | { kind: "local" } // local dev backend — no real session to bind
  | { kind: "not_in_line" } // plain browser / LIFF unset / not opened in LINE
  | { kind: "ready_to_link" } // opened in LINE, not yet linked
  | { kind: "linked"; account: LineAccount };

const ERROR_MESSAGES: Record<LineLinkErrorCode, string> = {
  not_authenticated: "請先登入 BubanGo 再綁定 LINE。",
  missing_id_token: "無法取得 LINE 授權，請在 LINE 中重新開啟後再試。",
  invalid_line_token: "LINE 驗證失敗，請重新整理後再試一次。",
  line_account_already_linked: "這個 LINE 帳號已綁定其他 BubanGo 帳號。",
  line_config_missing: "系統尚未完成 LINE 連動設定，請稍後再試。",
  link_failed: "綁定失敗，請稍後再試。",
  unlink_failed: "解除綁定失敗，請稍後再試。",
  network_error: "網路連線異常，請稍後再試。",
};

function messageFor(err: unknown): string {
  const code = err instanceof LineLinkError ? err.code : "link_failed";
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.link_failed;
}

export function LineBindingCard() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      if (isLocalBackend()) {
        if (active) setView({ kind: "local" });
        return;
      }

      // Already linked? Show that first (own row only, via RLS).
      try {
        const account = await getMyLineAccount();
        if (account && active) {
          setView({ kind: "linked", account });
          return;
        }
      } catch {
        // Couldn't read the binding (e.g. no session). Fall through; the link
        // action itself returns a precise error if the user tries.
      }

      if (!active) return;

      if (!isLiffConfigured()) {
        setView({ kind: "not_in_line" });
        return;
      }

      const state = await initLiff();
      if (!active) return;
      setView(
        state.kind === "ready" && state.isInClient
          ? { kind: "ready_to_link" }
          : { kind: "not_in_line" }
      );
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleLink() {
    setError("");
    setBusy(true);
    try {
      const idToken = await getLineIdToken();
      if (!idToken) throw new LineLinkError("missing_id_token");
      const account = await linkLineAccount(idToken);
      setView({ kind: "linked", account });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setError("");
    setBusy(true);
    try {
      await unlinkLineAccount();
      const state = isLiffConfigured() ? await initLiff() : null;
      setView(
        state?.kind === "ready" && state.isInClient
          ? { kind: "ready_to_link" }
          : { kind: "not_in_line" }
      );
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#06C755]/10 text-[#06C755]">
          <Icon name="chat" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-text">LINE 通知綁定</p>
            {view.kind === "linked" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                <Icon name="check" size={12} />
                已綁定
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-text-muted">
            綁定後，未來可在 LINE 收到媒合與班表通知（與登入方式無關）。
            綁定為選用，不影響現在使用。
          </p>

          <div className="mt-3">
            {view.kind === "loading" && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Spinner className="h-4 w-4 text-text-muted" />
                檢查綁定狀態…
              </div>
            )}

            {view.kind === "local" && (
              <p className="rounded-lg bg-background px-3 py-2 text-sm text-text-muted">
                目前為本機測試模式，登入正式帳號後即可綁定 LINE。
              </p>
            )}

            {view.kind === "not_in_line" && (
              <div>
                <p className="mb-2 text-sm text-text-muted">
                  請在 LINE App 內開啟 BubanGo，才能完成綁定。
                </p>
                <Button variant="outline" fullWidth disabled>
                  <Icon name="chat" size={18} />
                  綁定 LINE 接收通知
                </Button>
              </div>
            )}

            {view.kind === "ready_to_link" && (
              <Button fullWidth disabled={busy} onClick={handleLink}>
                {busy ? (
                  "綁定中…"
                ) : (
                  <>
                    <Icon name="chat" size={18} />
                    綁定 LINE 接收通知
                  </>
                )}
              </Button>
            )}

            {view.kind === "linked" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-background px-3 py-2">
                  <Icon name="checkCircle" size={18} className="shrink-0 text-success" />
                  <p className="min-w-0 text-sm">
                    <span className="font-medium text-text">已綁定 LINE</span>
                    {view.account.displayName && (
                      <span className="text-text-muted">
                        {" "}
                        · {view.account.displayName}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  fullWidth
                  disabled={busy}
                  onClick={handleUnlink}
                >
                  {busy ? "解除中…" : "解除綁定"}
                </Button>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600">
              <Icon name="alertCircle" size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
