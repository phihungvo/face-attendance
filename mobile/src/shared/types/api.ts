export type ApiResponse<T> = {
  code: number;
  message: string;
  result: T;
};

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};
