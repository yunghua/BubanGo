import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileShell showNav>
      {children}
      <BottomNav role="shop" />
    </MobileShell>
  );
}
