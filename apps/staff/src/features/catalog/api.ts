import { http } from "../../lib/api";
import type {
  Service,
  Product,
  CreateServiceDto,
  UpdateServiceDto,
  CreateProductDto,
  UpdateProductDto,
} from "@gym/contracts";

export const catalogApi = {
  // Services
  listServices: async (active?: boolean): Promise<Service[]> => {
    const qs = active !== undefined ? `?active=${active}` : "";
    return http.get<Service[]>(`/services${qs}`);
  },

  createService: async (dto: CreateServiceDto): Promise<Service> => {
    return http.post<Service>("/services", dto);
  },

  updateService: async (id: string, dto: UpdateServiceDto): Promise<Service> => {
    return http.patch<Service>(`/services/${id}`, dto);
  },

  toggleServiceActive: async (id: string, isActive: boolean): Promise<Service> => {
    return http.patch<Service>(`/services/${id}`, { isActive });
  },

  // Products (Bar / Retail)
  listProducts: async (active?: boolean): Promise<Product[]> => {
    const qs = active !== undefined ? `?active=${active}` : "";
    return http.get<Product[]>(`/products${qs}`);
  },

  createProduct: async (dto: CreateProductDto): Promise<Product> => {
    return http.post<Product>("/products", dto);
  },

  updateProduct: async (id: string, dto: UpdateProductDto): Promise<Product> => {
    return http.patch<Product>(`/products/${id}`, dto);
  },

  adjustStock: async (id: string, newStock: number, _note?: string): Promise<Product> => {
    // Note: The backend currently supports updating stock directly via PATCH /products/:id.
    // A dedicated stock audit log / adjustment history endpoint can be added in Phase 12.
    return http.patch<Product>(`/products/${id}`, { stock: newStock });
  },

  toggleProductActive: async (id: string, isActive: boolean): Promise<Product> => {
    return http.patch<Product>(`/products/${id}`, { isActive });
  },
};

