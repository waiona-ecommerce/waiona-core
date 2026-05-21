export const MAIL_QUEUE = 'mail';

export enum MailJobType {
  SEND_ACTIVATION = 'send-activation',
  SEND_PASSWORD_RESET = 'send-password-reset',
  SEND_ORDER_CONFIRMED = 'send-order-confirmed',
  SEND_ORDER_DISPATCHED = 'send-order-dispatched',
  SEND_ORDER_CANCELLED = 'send-order-cancelled',
  SEND_ORDER_DELIVERED = 'send-order-delivered',
  SEND_STOCK_ALERT = 'send-stock-alert',
}

export interface ActivationJobData {
  to: string;
  name: string;
  activationUrl: string;
}

export interface PasswordResetJobData {
  to: string;
  name: string;
  resetUrl: string;
}

export interface OrderEmailJobData {
  to: string;
  name: string;
  orderId: number;
  orderUrl: string;
}

export interface OrderCancelledJobData {
  to: string;
  name: string;
  orderId: number;
}

export interface StockAlertJobData {
  productName: string;
  locationName: string;
  quantityAvailable: number;
  threshold: number;
  adminEmail: string;
}
