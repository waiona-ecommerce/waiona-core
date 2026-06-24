export class PriceBreakdownDto {
  unitPrice: number; // costo (guardado en BD)
  salePrice: number; // precio de venta (guardado en BD)
  margin: number; // salePrice - unitPrice (calculado, informativo)
  discount: number; // descuento sobre salePrice (pre-impuestos)
  priceAfterDiscount: number; // salePrice - discount = base imponible
  taxes: number; // impuestos sobre base imponible (priceAfterDiscount)
  finalPrice: number; // priceAfterDiscount + taxes (precio sin cupón)
  fullPrice: number; // salePrice + taxes_on_salePrice (para mostrar tachado)
  coupon: number; // bonificación comercial post-impuestos
  orderTotal: number; // finalPrice - coupon
}
