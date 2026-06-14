import { MobileShell } from "@/components/layout/MobileShell";
import { LinkButton } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LineLoginButton } from "@/components/auth/LineLoginButton";

const features: { icon: IconName; title: string; desc: string }[] = [
  { icon: "bolt", title: "快速補人", desc: "幾分鐘發布缺班，馬上開始招募" },
  { icon: "mapPin", title: "在地媒合", desc: "找附近的打工者，省去通勤時間" },
  { icon: "shield", title: "安心可靠", desc: "用 LINE 登入，免記密碼又安心" },
];

export default function HomePage() {
  return (
    <MobileShell>
      <div className="flex min-h-[88dvh] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center pt-6 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-sm shadow-primary/30">
            <Icon name="bolt" size={32} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary">BubanGo</h1>
          <p className="mt-2 text-lg font-medium text-secondary">補班，就現在</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-muted">
            飲料店、小吃店快速發布 2–3 小時缺班，打工者輕鬆找到附近臨時工作機會。
          </p>

          <div className="mt-8 w-full space-y-3 text-left">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={f.icon} size={20} />
                </div>
                <div>
                  <p className="font-semibold text-text">{f.title}</p>
                  <p className="text-sm text-text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-8">
          <LineLoginButton />
          <LinkButton href="/auth/login" variant="outline" size="lg" fullWidth>
            使用 Email 登入
          </LinkButton>
          <p className="text-center text-xs leading-relaxed text-text-muted">
            店家、打工者皆可使用；登入後再選擇身分
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
