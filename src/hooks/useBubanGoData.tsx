"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Application,
  BubanGoData,
  CreateShiftInput,
  Session,
  Shift,
} from "@/types";
import { getRepository } from "@/lib/data/get-repository";
import { PageLoading } from "@/components/ui/Spinner";

const EMPTY_SESSION: Session = {
  userId: "",
  role: null,
  currentShopId: "",
  currentWorkerId: "",
};

const EMPTY_DATA: BubanGoData = {
  shops: [],
  workers: [],
  shifts: [],
  applications: [],
  session: EMPTY_SESSION,
};

interface BubanGoContextValue {
  ready: boolean;
  error: string | null;
  data: BubanGoData;
  refresh: () => Promise<void>;
  createShift: (input: CreateShiftInput) => Promise<Shift>;
  applyForShift: (shiftId: string) => Promise<Application>;
  acceptApplication: (applicationId: string) => Promise<void>;
  rejectApplication: (applicationId: string) => Promise<void>;
}

const BubanGoContext = createContext<BubanGoContextValue | null>(null);

export function BubanGoProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => getRepository(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BubanGoData>(EMPTY_DATA);

  const refresh = useCallback(async () => {
    try {
      const next = await repository.getData();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "資料載入失敗");
    }
  }, [repository]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const next = await repository.getData();
        if (active) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "資料載入失敗");
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [repository]);

  const value = useMemo<BubanGoContextValue>(
    () => ({
      ready,
      error,
      data,
      refresh,
      createShift: async (input) => {
        const shift = await repository.createShift(input);
        await refresh();
        return shift;
      },
      applyForShift: async (shiftId) => {
        const workerId = data.session.currentWorkerId;
        if (!workerId) {
          throw new Error("尚未建立打工者資料，請先完成註冊或登入");
        }
        const application = await repository.applyToShift(shiftId, workerId);
        await refresh();
        return application;
      },
      acceptApplication: async (applicationId) => {
        await repository.acceptApplication(applicationId);
        await refresh();
      },
      rejectApplication: async (applicationId) => {
        await repository.rejectApplication(applicationId);
        await refresh();
      },
    }),
    [repository, data, ready, error, refresh]
  );

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center">
        <PageLoading />
      </div>
    );
  }

  return (
    <BubanGoContext.Provider value={value}>{children}</BubanGoContext.Provider>
  );
}

export function useBubanGoData(): BubanGoContextValue {
  const context = useContext(BubanGoContext);
  if (!context) {
    throw new Error("useBubanGoData must be used within BubanGoProvider");
  }
  return context;
}
