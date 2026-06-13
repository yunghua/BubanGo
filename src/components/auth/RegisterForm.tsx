"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button, LinkButton } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { registerShopOwner, registerWorker } from "@/lib/auth/auth-service";

interface RegisterFormProps {
  role: "shop" | "worker";
}

export function RegisterForm({ role }: RegisterFormProps) {
  const isShop = role === "shop";
  const router = useRouter();
  const { refresh } = useBubanGoData();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [experience, setExperience] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 6) {
      setError("密碼至少需要 6 個字元");
      return;
    }
    if (password !== confirm) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    if (!name.trim()) {
      setError(isShop ? "請輸入店家名稱" : "請輸入姓名");
      return;
    }
    if (isShop && !address.trim()) {
      setError("請輸入店家地址");
      return;
    }

    setSubmitting(true);
    try {
      const result = isShop
        ? await registerShopOwner({
            email: email.trim(),
            password,
            storeName: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
          })
        : await registerWorker({
            email: email.trim(),
            password,
            name: name.trim(),
            phone: phone.trim(),
            experience: experience.trim(),
          });

      if (result.status === "confirm_email") {
        setInfo("註冊成功！我們已寄出確認信，請至信箱完成驗證後再回來登入。");
        setSubmitting(false);
        return;
      }

      await refresh();
      router.push(isShop ? "/store" : "/shifts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "註冊失敗，請稍後再試");
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      {info && <Alert variant="success">{info}</Alert>}

      <Input
        label="Email"
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        label="密碼"
        type="password"
        placeholder="至少 6 個字元"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Input
        label="確認密碼"
        type="password"
        placeholder="再次輸入密碼"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />

      {isShop ? (
        <>
          <Input
            label="店家名稱"
            placeholder="例：好飲茶飲店"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="店家電話"
            type="tel"
            placeholder="0912-345-678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="店家地址"
            placeholder="例：台北市大安區復興南路一段 100 號"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </>
      ) : (
        <>
          <Input
            label="姓名"
            placeholder="你的姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="手機"
            type="tel"
            placeholder="0987-654-321"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Textarea
            label="工作經驗（選填）"
            placeholder="簡述你的相關打工經驗"
            rows={3}
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
          />
        </>
      )}

      <Button type="submit" fullWidth size="lg" className="mt-2" disabled={submitting}>
        {submitting ? "處理中…" : "建立帳號"}
      </Button>

      <p className="mt-2 text-center text-sm text-text-muted">
        已有帳號？{" "}
        <LinkButton
          href="/auth/login"
          variant="ghost"
          size="sm"
          className="inline p-0 font-semibold text-primary"
        >
          登入
        </LinkButton>
      </p>
    </form>
  );
}
