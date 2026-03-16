import { create } from 'zustand';
import { productApi } from '../../../lib/tauri-ipc';
import type {
  ProductData,
  ProductIssue,
  ProductFeature,
  ProductDomain,
} from '../../../lib/tauri-ipc';

interface ProductStore {
  product: ProductData | null;
  issues: ProductIssue[];
  loading: boolean;
  saving: boolean;
  notFound: boolean;

  load: (workspaceId: string) => Promise<void>;
  loadIssues: (workspaceId: string) => Promise<void>;
  initProduct: (workspaceId: string, name: string, description: string) => Promise<void>;
  saveProduct: (workspaceId: string, patch: Partial<ProductData>) => Promise<void>;

  createIssue: (workspaceId: string, req: Partial<ProductIssue>) => Promise<ProductIssue>;
  updateIssue: (workspaceId: string, id: string, req: Partial<ProductIssue>) => Promise<void>;
  deleteIssue: (workspaceId: string, id: string) => Promise<void>;

  createFeature: (workspaceId: string, domain: string, req: Partial<ProductFeature>) => Promise<void>;
  updateFeature: (workspaceId: string, domain: string, feature: string, req: Partial<ProductFeature>) => Promise<void>;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  product: null,
  issues: [],
  loading: false,
  saving: false,
  notFound: false,

  load: async (workspaceId) => {
    set({ loading: true, notFound: false });
    try {
      const p = await productApi.get(workspaceId);
      set({ product: p, loading: false });
    } catch (e: any) {
      const msg = String(e);
      if (msg.includes('404') || msg.includes('no PRODUCT.md')) {
        set({ notFound: true, product: null, loading: false });
      } else {
        set({ loading: false });
        throw e;
      }
    }
  },

  loadIssues: async (workspaceId) => {
    try {
      const issues = await productApi.listIssues(workspaceId);
      set({ issues: Array.isArray(issues) ? issues : [] });
    } catch {
      set({ issues: [] });
    }
  },

  initProduct: async (workspaceId, name, description) => {
    set({ saving: true });
    try {
      const p = await productApi.init(workspaceId, name, description);
      set({ product: p, notFound: false, saving: false });
    } finally {
      set({ saving: false });
    }
  },

  saveProduct: async (workspaceId, patch) => {
    const current = get().product;
    if (!current) return;
    const merged = { ...current, ...patch };
    set({ saving: true, product: merged }); // optimistic
    try {
      const updated = await productApi.save(workspaceId, merged);
      set({ product: updated, saving: false });
    } catch (e) {
      set({ product: current, saving: false }); // revert
      throw e;
    }
  },

  createIssue: async (workspaceId, req) => {
    const iss = await productApi.createIssue(workspaceId, req);
    set((s) => ({ issues: [...s.issues, iss] }));
    return iss;
  },

  updateIssue: async (workspaceId, id, req) => {
    const updated = await productApi.updateIssue(workspaceId, id, req);
    set((s) => ({ issues: s.issues.map((i) => (i.id === id ? { ...i, ...updated } : i)) }));
  },

  deleteIssue: async (workspaceId, id) => {
    await productApi.deleteIssue(workspaceId, id);
    set((s) => ({ issues: s.issues.filter((i) => i.id !== id) }));
  },

  createFeature: async (workspaceId, domain, req) => {
    const feat = await productApi.createFeature(workspaceId, domain, req);
    set((s) => {
      if (!s.product) return s;
      const domains = s.product.domains.map((d) => {
        if (d.name.toLowerCase() !== domain.toLowerCase()) return d;
        return { ...d, features: [...d.features, feat] };
      });
      return { product: { ...s.product, domains } };
    });
  },

  updateFeature: async (workspaceId, domain, feature, req) => {
    const updated = await productApi.updateFeature(workspaceId, domain, feature, req);
    set((s) => {
      if (!s.product) return s;
      const domains = s.product.domains.map((d) => {
        if (d.name.toLowerCase() !== domain.toLowerCase()) return d;
        return {
          ...d,
          features: d.features.map((f) =>
            f.name.toLowerCase() === feature.toLowerCase() ? { ...f, ...updated } : f
          ),
        };
      });
      return { product: { ...s.product, domains } };
    });
  },
}));

export type { ProductData, ProductIssue, ProductFeature, ProductDomain };
export type { ProductGoal, ProductTechRow, ProductScope } from '../../../lib/tauri-ipc';
