export class PaginatedResponseDto<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  data: T[];

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNextPage = page < this.totalPages;
  }
}
