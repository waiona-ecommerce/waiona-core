import { Test, TestingModule } from '@nestjs/testing';
import { ShopController } from '../../../products/shop/controllers/shop.controller';
import { ShopService } from '../../../products/shop/services/shop.service';

describe('ShopController', () => {
  let controller: ShopController;
  let service: jest.Mocked<ShopService>;

  const mockService = () => ({ search: jest.fn(), findById: jest.fn() });

  const mockPaginatedResponse = (overrides = {}) => ({
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    data: [
      { id: 1, name: 'Coca Cola 500ml', type: 'product', finalPrice: 653.4 },
    ],
    ...overrides,
  });

  const mockDetailResponse = (overrides = {}) => ({
    id: 1,
    name: 'Coca Cola 500ml',
    description: 'Gaseosa',
    type: 'product',
    originalPrice: 726,
    finalPrice: 653.4,
    discountAmount: 50,
    hasDiscount: true,
    inStock: true,
    quantityAvailable: 10,
    stockStatus: 'available',
    images: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopController],
      providers: [{ provide: ShopService, useFactory: mockService }],
    }).compile();

    controller = module.get<ShopController>(ShopController);
    service = module.get(ShopService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  // ==========================
  // search
  // ==========================

  describe('search', () => {
    it('should return paginated results', async () => {
      service.search.mockResolvedValue(mockPaginatedResponse() as any);

      const result = await controller.search({});

      expect(service.search).toHaveBeenCalledWith({});
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should pass query params to service', async () => {
      const query = {
        type: 'product',
        search: 'coca',
        categoryId: 1,
        page: 2,
        limit: 10,
      };
      service.search.mockResolvedValue(mockPaginatedResponse() as any);

      await controller.search(query as any);

      expect(service.search).toHaveBeenCalledWith(query);
    });

    it('should return empty data if no results', async () => {
      service.search.mockResolvedValue(
        mockPaginatedResponse({ total: 0, data: [] }) as any,
      );

      const result = await controller.search({});

      expect(result.data).toHaveLength(0);
    });
  });

  // ==========================
  // findById
  // ==========================

  describe('findById', () => {
    it('should return product detail', async () => {
      service.findById.mockResolvedValue(mockDetailResponse() as any);

      const result = await controller.findById(1, 'product');

      expect(service.findById).toHaveBeenCalledWith(1, 'product');
      expect(result.type).toBe('product');
      expect(result.finalPrice).toBe(653.4);
    });

    it('should return combo detail', async () => {
      const comboDetail = mockDetailResponse({
        type: 'combo',
        items: [{ productId: 1, productName: 'Coca Cola', quantity: 3 }],
      });
      service.findById.mockResolvedValue(comboDetail as any);

      const result = await controller.findById(1, 'combo');

      expect(service.findById).toHaveBeenCalledWith(1, 'combo');
      expect(result.type).toBe('combo');
    });

    it('should pass type query param to service', async () => {
      service.findById.mockResolvedValue(mockDetailResponse() as any);

      await controller.findById(1, 'product');

      expect(service.findById).toHaveBeenCalledWith(1, 'product');
    });
  });
});
