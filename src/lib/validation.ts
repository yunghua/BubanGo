export interface FieldErrors {
  [key: string]: string;
}

export interface NewShiftFormValues {
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: string;
  location: string;
  description: string;
  requiredWorkers: string;
}

export function validateNewShiftForm(values: NewShiftFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.date) {
    errors.date = "請選擇日期";
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(values.date + "T00:00:00");
    if (selected < today) {
      errors.date = "日期不能早於今天";
    }
  }

  if (!values.startTime) {
    errors.startTime = "請選擇開始時間";
  }

  if (!values.endTime) {
    errors.endTime = "請選擇結束時間";
  }

  if (values.startTime && values.endTime && values.startTime >= values.endTime) {
    errors.endTime = "結束時間必須晚於開始時間";
  }

  const rate = Number(values.hourlyRate);
  if (!values.hourlyRate || Number.isNaN(rate) || rate <= 0) {
    errors.hourlyRate = "請輸入有效的時薪（大於 0）";
  }

  if (!values.location.trim()) {
    errors.location = "請輸入工作地點";
  }

  if (!values.description.trim()) {
    errors.description = "請輸入工作內容";
  } else if (values.description.trim().length < 5) {
    errors.description = "工作內容至少 5 個字";
  }

  const requiredWorkers = Number(values.requiredWorkers);
  if (
    !values.requiredWorkers ||
    Number.isNaN(requiredWorkers) ||
    requiredWorkers < 1
  ) {
    errors.requiredWorkers = "需求人數至少為 1";
  }

  return errors;
}
