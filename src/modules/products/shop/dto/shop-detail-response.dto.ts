export class ShopDetailResponseDto {
  id: number;
  name: string;
  description?: string;
  type: 'product' | 'combo';
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  priceAfterDiscount: number;
  taxes: number;
  hasDiscount: boolean;
  inStock: boolean;
  quantityAvailable: number;
  stockStatus: 'available' | 'low' | 'critical' | 'out_of_stock';
  category?: string;
  images: string[];
  items?: ComboItemShopDto[];
}

export class ComboItemShopDto {
  productId: number;
  productName: string;
  quantity: number;
}
