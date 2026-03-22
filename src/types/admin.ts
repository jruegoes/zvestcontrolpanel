export interface ShopStats {
  shop_id: string;
  shop_name: string;
  shop_status: string;
  revenue_all_time: number;
  revenue_30d: number;
  revenue_7d: number;
  revenue_today: number;
  transactions_all_time: number;
  transactions_today: number;
  loyalty_users: number;
  redemptions_all_time: number;
  redemptions_30d: number;
  redemptions_7d: number;
  redemptions_today: number;
  scans_all_time: number;
  scans_today: number;
}
