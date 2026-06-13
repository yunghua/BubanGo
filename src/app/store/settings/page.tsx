import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { mockShops } from "@/lib/mock/shops";

const currentShop = mockShops[0];

export default function StoreSettingsPage() {
  return (
    <>
      <PageHeader
        title="店家資料"
        subtitle="編輯你的店家資訊"
        backHref="/store"
      />

      <form className="flex flex-col gap-4" action="/store">
        <Input label="店家名稱" defaultValue={currentShop.name} required />
        <Input label="電話" type="tel" defaultValue={currentShop.phone} required />
        <Input label="地址" defaultValue={currentShop.address} required />
        <Textarea
          label="店家簡介"
          defaultValue={currentShop.description}
          rows={3}
        />

        <Button type="submit" fullWidth size="lg" className="mt-2">
          儲存
        </Button>
      </form>
    </>
  );
}
