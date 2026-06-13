"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import { useBubanGoData } from "@/hooks/useBubanGoData";
import { calculateHours, formatCurrency, formatHours } from "@/lib/utils";
import {
  validateNewShiftForm,
  type NewShiftFormValues,
} from "@/lib/validation";

const initialValues: NewShiftFormValues = {
  date: "",
  startTime: "",
  endTime: "",
  hourlyRate: "",
  location: "",
  description: "",
  requiredWorkers: "1",
};

export function NewShiftForm() {
  const router = useRouter();
  const { data, createShift } = useBubanGoData();
  const currentShop = data.shops.find(
    (shop) => shop.id === data.session.currentShopId
  );

  const [values, setValues] = useState<NewShiftFormValues>({
    ...initialValues,
    location: currentShop?.address ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof NewShiftFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    const validationErrors = validateNewShiftForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!currentShop) {
      setSubmitError("找不到店家資料，請重新整理頁面");
      return;
    }

    setIsSubmitting(true);

    try {
      const shift = await createShift({
        shopId: currentShop.id,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        hourlyRate: Number(values.hourlyRate),
        location: values.location.trim(),
        description: values.description.trim(),
        requiredWorkers: Number(values.requiredWorkers),
      });

      router.push(`/store?success=shift-created&shiftId=${shift.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "發布失敗，請稍後再試"
      );
      setIsSubmitting(false);
    }
  }

  // Live earnings preview — display only, helps owners price the shift.
  const rate = Number(values.hourlyRate);
  const showEstimate =
    Boolean(values.startTime) &&
    Boolean(values.endTime) &&
    values.startTime < values.endTime &&
    rate > 0;
  const estimateHours = showEstimate
    ? calculateHours(values.startTime, values.endTime)
    : 0;

  return (
    <>
      <PageHeader
        title="發布缺班"
        subtitle="填寫缺班資訊，讓附近打工者馬上看到"
        backHref="/store"
      />

      {submitError && <Alert variant="error">{submitError}</Alert>}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="日期"
          type="date"
          value={values.date}
          onChange={(e) => updateField("date", e.target.value)}
          error={errors.date}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="開始時間"
            type="time"
            value={values.startTime}
            onChange={(e) => updateField("startTime", e.target.value)}
            error={errors.startTime}
            required
          />
          <Input
            label="結束時間"
            type="time"
            value={values.endTime}
            onChange={(e) => updateField("endTime", e.target.value)}
            error={errors.endTime}
            required
          />
        </div>
        <Input
          label="時薪（NT$）"
          type="number"
          placeholder="200"
          min={1}
          hint="參考同業行情，越有競爭力越快補到人"
          value={values.hourlyRate}
          onChange={(e) => updateField("hourlyRate", e.target.value)}
          error={errors.hourlyRate}
          required
        />

        {showEstimate && (
          <div className="rounded-xl bg-primary-light p-3 text-sm">
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <Icon name="wage" size={15} />
              預估
            </p>
            <p className="mt-1 text-text">
              這個班共 <span className="font-semibold">{formatHours(estimateHours)}</span>
              ，每位約可拿{" "}
              <span className="font-bold text-primary">
                {formatCurrency(rate * estimateHours)}
              </span>
            </p>
          </div>
        )}

        <Input
          label="工作地點"
          placeholder="店家地址或工作地點"
          value={values.location}
          onChange={(e) => updateField("location", e.target.value)}
          error={errors.location}
          required
        />
        <Textarea
          label="工作內容"
          placeholder="描述工作內容、需要的能力…"
          rows={4}
          hint="寫清楚工作項目與注意事項，減少溝通成本"
          value={values.description}
          onChange={(e) => updateField("description", e.target.value)}
          error={errors.description}
          required
        />
        <Input
          label="需求人數"
          type="number"
          placeholder="1"
          min={1}
          value={values.requiredWorkers}
          onChange={(e) => updateField("requiredWorkers", e.target.value)}
          error={errors.requiredWorkers}
          required
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          className="mt-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            "發布中…"
          ) : (
            <>
              <Icon name="plus" size={18} />
              發布缺班
            </>
          )}
        </Button>
      </form>
    </>
  );
}
