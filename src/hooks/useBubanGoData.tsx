"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Application, BubanGoData, CreateShiftInput, Shift } from "@/types";
import type { BubanGoRepository } from "@/lib/data/bubango-repository";
import { getRepository } from "@/lib/data/get-repository";

interface BubanGoContextValue {
  ready: boolean;
  data: BubanGoData;
  refresh: () => void;
  createShift: (input: CreateShiftInput) => Shift;
  applyForShift: (shiftId: string) => Application;
  acceptApplication: (applicationId: string) => void;
  rejectApplication: (applicationId: string) => void;
}

const BubanGoContext = createContext<BubanGoContextValue | null>(null);

function createContextValue(
  repository: BubanGoRepository,
  data: BubanGoData,
  ready: boolean,
  refresh: () => void
): BubanGoContextValue {
  return {
    ready,
    data,
    refresh,
    createShift: (input) => {
      const shift = repository.createShift(input);
      refresh();
      return shift;
    },
    applyForShift: (shiftId) => {
      const application = repository.applyToShift(
        shiftId,
        data.session.currentWorkerId
      );
      refresh();
      return application;
    },
    acceptApplication: (applicationId) => {
      repository.acceptApplication(applicationId);
      refresh();
    },
    rejectApplication: (applicationId) => {
      repository.rejectApplication(applicationId);
      refresh();
    },
  };
}

export function BubanGoProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => getRepository(), []);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<BubanGoData | null>(null);

  const refresh = useCallback(() => {
    setData(repository.getData());
  }, [repository]);

  useEffect(() => {
    repository.getData();
    setData(repository.getData());
    setReady(true);
  }, [repository]);

  const value = useMemo<BubanGoContextValue | null>(() => {
    if (!data) return null;
    return createContextValue(repository, data, ready, refresh);
  }, [repository, data, ready, refresh]);

  if (!value) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-text-muted">
        載入中...
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
