/**
 * @deprecated Use `getRepository()` from `@/lib/data/get-repository` instead.
 * Re-exports kept for backward compatibility.
 */
export { STORAGE_KEYS, localStorageRepository } from "@/lib/data/local-storage-repository";
export { getRepository } from "@/lib/data/get-repository";

import { localStorageRepository } from "@/lib/data/local-storage-repository";

export const initStorage = () => localStorageRepository.getData();
export const loadData = () => localStorageRepository.getData();
export const getSession = () => localStorageRepository.getCurrentSession();
export const getShiftById = (id: string) => localStorageRepository.getShiftById(id);
export const getShiftsByShopId = (shopId: string) =>
  localStorageRepository.getShifts().filter((shift) => shift.shopId === shopId);
export const getOpenShifts = () =>
  localStorageRepository.getShifts().filter((shift) => shift.status === "open");
export const getApplicationsByShiftId = (shiftId: string) =>
  localStorageRepository.getApplicationsByShift(shiftId);
export const getApplicationsByWorkerId = (workerId: string) =>
  localStorageRepository.getApplicationsByWorker(workerId);
export const createShift = (
  input: Parameters<typeof localStorageRepository.createShift>[0]
) => localStorageRepository.createShift(input);
export const applyForShift = (shiftId: string, workerId: string) =>
  localStorageRepository.applyToShift(shiftId, workerId);
export const acceptApplication = (id: string) =>
  localStorageRepository.acceptApplication(id);
export const rejectApplication = (id: string) =>
  localStorageRepository.rejectApplication(id);
export const resetStorage = () => localStorageRepository.reset();
