export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "return_requested"
  | "returned";

export type ReturnStatus =
  "pending" | "approved" | "rejected" | "in_transit" | "received" | "refunded";

export type RefundStatus = "pending" | "completed" | "failed";

export interface OrderItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string; // ISO date string
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  productId: string;
  reason: string;
  quantity: number;
  requestedAt: string; // ISO date string
  approvedAt?: string; // ISO date string
  status: ReturnStatus;
}

export interface Refund {
  id: string;
  returnRequestId: string;
  orderId: string;
  productId: string;
  amount: number;
  status: RefundStatus;
  requestedAt: string; // ISO date string
  completedAt: string | null; // ISO date string
}

// Staff & Customers

export type StaffRole = "admin" | "staff";
export interface Staff {
  id: string;
  email: string;
  passwordHash: string;
  role: StaffRole;
}
export interface Customer {
  id: string;
  email: string;
  passwordHash: string;
}
export interface JwtPayload {
  id: string;
  role: "admin" | "staff" | "customer";
}

export interface IdempotencyRecord {
  idempotency_key: string;
  user_id: string;
  request_path: string;
  request_method: string;
  response_code: number | null;
  response_body: Record<string, unknown> | null;
  status: "in_progress" | "completed";
  created_at: Date;
}

export interface PaymentBody {
  amount: number; // kobo
  email: string;
  reference?: string;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  unitPrice: number;
}
