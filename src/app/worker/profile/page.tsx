import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { mockWorkers } from "@/lib/mock/workers";

const currentWorker = mockWorkers[0];

export default function WorkerProfilePage() {
  return (
    <>
      <PageHeader title="個人資料" subtitle="讓店家更了解你" />

      <Card className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl">
          👤
        </div>
        <p className="text-lg font-semibold">{currentWorker.name}</p>
        <p className="text-sm text-text-muted">{currentWorker.phone}</p>
      </Card>

      <form className="flex flex-col gap-4">
        <Input label="姓名" defaultValue={currentWorker.name} required />
        <Input label="手機" type="tel" defaultValue={currentWorker.phone} required />
        <Input
          label="可工作地區"
          defaultValue={currentWorker.areas.join("、")}
          placeholder="例：台北市大安區、信義區"
          required
        />
        <Textarea
          label="工作經驗"
          defaultValue={currentWorker.experience}
          rows={4}
          required
        />

        <Button type="submit" fullWidth size="lg" className="mt-2">
          儲存資料
        </Button>
      </form>
    </>
  );
}
