import type { Shop } from "@/types";

export const mockShops: Shop[] = [
  {
    id: "shop-1",
    userId: "user-shop-1",
    name: "好飲茶飲店",
    address: "台北市大安區復興南路一段 100 號",
    phone: "0912-345-678",
    description: "連鎖手搖飲，環境乾淨，需有飲料店經驗佳",
  },
  {
    id: "shop-2",
    userId: "user-shop-2",
    name: "阿嬤滷味",
    address: "新北市板橋區文化路二段 50 號",
    phone: "0923-456-789",
    description: "夜市滷味攤，晚班為主",
  },
];

export function getShopById(id: string): Shop | undefined {
  return mockShops.find((shop) => shop.id === id);
}
