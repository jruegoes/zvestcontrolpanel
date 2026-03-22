export interface DashboardWidgets {
  revenue: {
    today: number;
    yesterday: number;
    change_percent: number;
  };
  customers: {
    active_today: number;
    new_today: number;
    returning_today: number;
  };
  transactions: {
    avg_amount: number;
    points_awarded: number;
  };
  qr_scans: {
    total_scans: number;
    total_transactions: number;
    engagement_rate: number;
  };
  revenue_goals: {
    daily_goal: number;
    daily_current: number;
    daily_percent: number;
    monthly_goal: number;
    monthly_current: number;
    monthly_percent: number;
  };
  top_coupons: {
    id: string;
    name: string;
    redemptions_today: number;
    type: string;
  }[];
  recent_transactions: {
    id: string;
    pos_invoice_id: string;
    total_amount: number;
    status: string;
    created_at: string;
    customer_name: string | null;
  }[];
  alerts: {
    type: "success" | "warning" | "info" | "error";
    title: string;
    message: string;
  }[];
  insights: {
    title: string;
    description: string;
    action?: string;
  }[];
}

export interface DashboardWidgetsResponse {
  success: boolean;
  data: DashboardWidgets;
}
