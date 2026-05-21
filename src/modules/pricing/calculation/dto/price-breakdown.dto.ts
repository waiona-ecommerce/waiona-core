export class PriceBreakdownDto {
  unitPrice: number;
  discount: number;
  priceAfterDiscount: number;
  margin: number;
  priceAfterMargin: number;
  taxes: number;
  finalPrice: number; // precio final CON descuento — lo que paga el cliente
  fullPrice: number; // precio final SIN descuento — para mostrar tachado en el front
  // = unitPrice + margen(sobre unitPrice) + impuestos(sobre eso)
  coupon: number;
  orderTotal: number;
}
