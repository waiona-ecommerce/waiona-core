export class ShopItemResponseDto {
  id: number;
  name: string;
  type: 'product' | 'combo';
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  hasDiscount: boolean;
  inStock: boolean;
  quantityAvailable: number;
  category?: string;
  image?: string;
}
