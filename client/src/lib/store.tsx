
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  supabaseConfigured,
  supabaseRequest,
} from "@/lib/supabase";

// ==========================================
// Types
// ==========================================

export type Category = {
  id: string;
  name: string;
  eyebrow: string;
  icon: string;
  accent: string;
};

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  price: number;
  oldPrice?: number;
  image: string;
  images?: string[];
  tag?: string;
  stock: number;
  sku: string;
  rating: number;
  visible: boolean;
};

export type StoreSettings = {
  id: number;
  store_name: string;
  store_tagline: string;
  announcement: string;
  phone_number: string;
  whatsapp_number: string;
  currency: string;
  free_shipping_threshold: number | null;
  logo_url: string;
  banner_url: string;
  categories: string[];
};

export type OrderStatus =
  | "جديد"
  | "قيد التجهيز"
  | "تم الشحن"
  | "مكتمل"
  | "ملغي";

export type Order = {
  id: string;
  customer: string;
  total: number;
  items: number;
  status: OrderStatus;
  date: string;
};

// ==========================================
// Supabase Database Types
// ==========================================

type DbProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  original_price: number | null;
  description: string | null;
  features: string[] | null;
  image: string | null;
  in_stock: boolean;
  rating: number | null;
  reviews_count: number | null;
  badge: string | null;
};

type DbCategory = {
  id: number;
  name: string;
  display_order: number | null;
};

type DbStoreSettings = StoreSettings;

// ==========================================
// Defaults
// ==========================================

const accentList = [
  "cyan",
  "orange",
  "violet",
  "green",
];

const cartStorage = "elsawy-cart";

const defaultSettings: StoreSettings = {
  id: 1,
  store_name: "الصاوى ستور",
  store_tagline: "",
  announcement: "",
  phone_number: "",
  whatsapp_number: "",
  currency: "ج.م",
  free_shipping_threshold: null,
  logo_url: "",
  banner_url: "",
  categories: [],
};

const settingsColumns =
  "id,store_name,store_tagline,announcement,phone_number,whatsapp_number,currency,free_shipping_threshold,logo_url,banner_url,categories";

// ==========================================
// Cart Compatibility
// ==========================================

const readCart = (): Record<string, number> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(
      window.localStorage.getItem(cartStorage) || "{}"
    );
  } catch {
    return {};
  }
};

const writeCart = (
  cart: Record<string, number>
) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      cartStorage,
      JSON.stringify(cart)
    );
  }
};

// ==========================================
// Database Mapping
// ==========================================

function mapCategory(
  row: DbCategory,
  index: number
): Category {
  return {
    id: String(row.id),
    name: row.name,
    eyebrow: "تسوق حسب القسم",
    icon: "package",
    accent: accentList[index % accentList.length],
  };
}

function mapProduct(
  row: DbProduct,
  categories: Category[]
): Product {
  const category = categories.find(
    (item) => item.name === row.category
  );

  return {
    id: row.id,
    name: row.name,
    categoryId: category?.id ?? "",
    description: row.description ?? "",
    price: Number(row.price),
    oldPrice:
      row.original_price == null
        ? undefined
        : Number(row.original_price),
    image: row.image ?? "",
    images: row.image ? [row.image] : [],
    tag: row.badge ?? undefined,

    // قاعدة البيانات الحالية تحفظ حالة التوفر فقط،
    // ولا تحتوي على عدد القطع الفعلي.
    stock: row.in_stock ? 99 : 0,

    sku: row.id,
    rating: Number(row.rating ?? 5),

    // لا يوجد عمود visible في جدول المنتجات الحالي.
    visible: true,
  };
}

// ==========================================
// Store Context
// ==========================================

type StoreContextValue = {
  categories: Category[];
  products: Product[];
  orders: Order[];
  storeSettings: StoreSettings;

  cart: Record<string, number>;
  cartCount: number;

  cartItems: Array<{
    product: Product;
    quantity: number;
  }>;

  loading: boolean;
  connectionError: string | null;

  addToCart: (id: string) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  addProduct: (
    product: Omit<Product, "id">
  ) => Promise<void>;

  updateProduct: (
    id: string,
    product: Partial<Product>
  ) => Promise<void>;

  deleteProduct: (id: string) => Promise<void>;

  addCategory: (
    category: Omit<Category, "id">
  ) => Promise<void>;

  updateCategory: (
    id: string,
    category: Partial<Category>
  ) => Promise<void>;

  deleteCategory: (id: string) => Promise<void>;

  updateStoreSettings: (
    settings: Partial<StoreSettings>
  ) => Promise<void>;

  placeOrder: (data: {
    customer_name: string;
    phone: string;
    address: string;
    city: string;
    notes?: string;
  }) => Promise<string>;

  refresh: () => Promise<void>;

  updateOrderStatus: (
    id: string,
    status: OrderStatus
  ) => Promise<void>;
};

const StoreContext =
  createContext<StoreContextValue | null>(null);

// ==========================================
// Store Provider
// ==========================================

export function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  // الطلبات لا تُستخدم في نظام الطلب عبر واتساب.
  const [orders] = useState<Order[]>([]);

  const [storeSettings, setStoreSettings] =
    useState<StoreSettings>(defaultSettings);

  const [cart, setCart] =
    useState<Record<string, number>>(readCart);

  const [loading, setLoading] = useState(true);

  const [connectionError, setConnectionError] =
    useState<string | null>(null);

  // ========================================
  // Refresh Supabase Data
  // ========================================

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setConnectionError(
        "إعدادات Supabase غير موجودة. راجع ملف .env"
      );

      setLoading(false);
      return;
    }

    setLoading(true);
    setConnectionError(null);

    try {
      const [
        categoriesResult,
        productsResult,
        settingsResult,
      ] = await Promise.allSettled([
        supabaseRequest<DbCategory[]>(
          "categories",
          {
            query:
              "select=id,name,display_order&order=display_order.asc",
          }
        ),

        supabaseRequest<DbProduct[]>(
          "products",
          {
            query:
              "select=id,name,category,price,original_price,description,features,image,in_stock,rating,reviews_count,badge&order=created_at.desc",
          }
        ),

        supabaseRequest<DbStoreSettings[]>(
          "store_settings",
          {
            query:
              `select=${settingsColumns}&id=eq.1&limit=1`,
          }
        ),
      ]);

      if (categoriesResult.status === "rejected") {
        throw categoriesResult.reason;
      }

      if (productsResult.status === "rejected") {
        throw productsResult.reason;
      }

      const mappedCategories =
        categoriesResult.value.map(mapCategory);

      const mappedProducts =
        productsResult.value.map((product) =>
          mapProduct(product, mappedCategories)
        );

      setCategories(mappedCategories);
      setProducts(mappedProducts);

      if (
        settingsResult.status === "fulfilled" &&
        settingsResult.value.length > 0
      ) {
        setStoreSettings({
          ...defaultSettings,
          ...settingsResult.value[0],
        });
      } else if (settingsResult.status === "rejected") {
        console.warn(
          "Could not load store settings:",
          settingsResult.reason
        );
      } else {
        setStoreSettings(defaultSettings);
      }
    } catch (error) {
      console.error(
        "Supabase refresh error:",
        error
      );

      setConnectionError(
        error instanceof Error
          ? error.message
          : "تعذر الاتصال بقاعدة البيانات"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ========================================
  // Cart Functions - Legacy Compatibility
  // ========================================

  const persistCart = useCallback(
    (next: Record<string, number>) => {
      setCart(next);
      writeCart(next);
    },
    []
  );

  const addToCart = useCallback(
    (id: string) => {
      setCart((old) => {
        const next = {
          ...old,
          [id]: (old[id] || 0) + 1,
        };

        writeCart(next);
        return next;
      });
    },
    []
  );

  const removeFromCart = useCallback(
    (id: string) => {
      setCart((old) => {
        const next = { ...old };

        if ((next[id] || 0) > 1) {
          next[id]--;
        } else {
          delete next[id];
        }

        writeCart(next);
        return next;
      });
    },
    []
  );

  const clearCart = useCallback(() => {
    persistCart({});
  }, [persistCart]);

  // ========================================
  // Category Helpers
  // ========================================

  const categoryName = useCallback(
    (id: string) =>
      categories.find(
        (category) => category.id === id
      )?.name ?? "غير مصنف",
    [categories]
  );

  // ========================================
  // Add Product
  // ========================================

  const addProduct = useCallback(
    async (product: Omit<Product, "id">) => {
      try {
        const image =
          product.image ||
          product.images?.[0] ||
          "";

        await supabaseRequest(
          "products",
          {
            method: "POST",
            query: "select=*",
            prefer: "return=representation",
            body: {
              name: product.name.trim(),

              category: categoryName(
                product.categoryId
              ),

              price: Number(product.price),

              original_price:
                product.oldPrice ?? null,

              description:
                product.description ?? "",

              features: [],

              image,

              in_stock: Number(product.stock) > 0,

              rating: Number(product.rating || 5),

              reviews_count: 0,

              badge: product.tag || null,
            },
          }
        );

        await refresh();
      } catch (error) {
        console.error(
          "Add product error:",
          error
        );

        setConnectionError(
          error instanceof Error
            ? error.message
            : String(error)
        );

        throw error;
      }
    },
    [categoryName, refresh]
  );

  // ========================================
  // Update Product
  // ========================================

  const updateProduct = useCallback(
    async (
      id: string,
      changes: Partial<Product>
    ) => {
      try {
        const oldProduct = products.find(
          (product) => product.id === id
        );

        if (!oldProduct) {
          throw new Error("المنتج غير موجود");
        }

        // لا يوجد عمود visible في قاعدة البيانات.
        // نرفض تغيير الظهور حتى لا نخلطه بتوفر المنتج.
        if (
          changes.visible !== undefined &&
          changes.visible !== oldProduct.visible
        ) {
          throw new Error(
            "خاصية إخفاء وإظهار المنتجات تحتاج إلى عمود visible في قاعدة البيانات. لم يتم تغيير حالة توفر المنتج."
          );
        }

        const next = {
          ...oldProduct,
          ...changes,
        };

        const image =
          next.image ||
          next.images?.[0] ||
          "";

        await supabaseRequest(
          "products",
          {
            method: "PATCH",

            query:
              `id=eq.${encodeURIComponent(id)}`,

            body: {
              name: next.name.trim(),

              category: categoryName(
                next.categoryId
              ),

              price: Number(next.price),

              original_price:
                next.oldPrice ?? null,

              description:
                next.description ?? "",

              image,

              in_stock: Number(next.stock) > 0,

              rating: Number(next.rating || 5),

              badge: next.tag || null,
            },
          }
        );

        await refresh();
      } catch (error) {
        console.error(
          "Update product error:",
          error
        );

        setConnectionError(
          error instanceof Error
            ? error.message
            : String(error)
        );

        throw error;
      }
    },
    [products, categoryName, refresh]
  );

  // ========================================
  // Delete Product
  // ========================================

  const deleteProduct = useCallback(
    async (id: string) => {
      try {
        await supabaseRequest(
          "products",
          {
            method: "DELETE",

            query:
              `id=eq.${encodeURIComponent(id)}`,
          }
        );

        await refresh();
      } catch (error) {
        console.error(
          "Delete product error:",
          error
        );

        setConnectionError(
          error instanceof Error
            ? error.message
            : String(error)
        );

        throw error;
      }
    },
    [refresh]
  );

  // ========================================
  // Add Category
  // ========================================

  const addCategory = useCallback(
    async (category: Omit<Category, "id">) => {
      try {
        const name = category.name.trim();

        if (!name) {
          throw new Error("اسم التصنيف مطلوب");
        }

        await supabaseRequest(
          "categories",
          {
            method: "POST",

            query: "select=*",

            prefer: "return=representation",

            body: {
              name,

              display_order: categories.length,
            },
          }
        );

        await refresh();
      } catch (error) {
        console.error(
          "Add category error:",
          error
        );

        setConnectionError(
          error instanceof Error
            ? error.message
            : String(error)
        );

        throw error;
      }
    },
    [categories.length, refresh]
  );

  // ========================================
  // Update Category
  // ========================================

  const updateCategory = useCallback(
    async (
      id: string,
      changes: Partial<Category>
    ) => {
      try {
        const oldCategory = categories.find(
          (category) => category.id === id
        );

        if (!oldCategory) {
          throw new Error("التصنيف غير موجود");
        }

        if (
          !changes.name ||
          changes.name.trim() === oldCategory.name
        ) {
          return;
        }

        const newName = changes.name.trim();

        // تحديث اسم التصنيف.
        await supabaseRequest(
          "categories",
          {
            method: "PATCH",

            query:
              `id=eq.${encodeURIComponent(id)}`,

            body: {
              name: newName,
            },
          }
        );

        // تحديث اسم التصنيف داخل المنتجات المرتبطة به.
        await supabaseRequest(
          "products",
          {
            method: "PATCH",

            query:
              `category=eq.${encodeURIComponent(
                oldCategory.name
              )}`,

            body: {
              category: newName,
            },
          }
        );

        await refresh();
      } catch (error) {
        console.error(
          "Update category error:",
          error
        );

        setConnectionError(
          error instanceof Error
            ? error.message
            : String(error)
        );

        throw error;
      }
    },
    [categories, refresh]
  );

  // ========================================
  // Delete Category
  // ========================================

  const deleteCategory = useCallback(
    async (id: string) => {
      try {
        const category = categories.find(
          (item) => item.id === id
        );

        if (!category) {
          throw new Error("التصنيف غير موجود");
        }

        const linkedProducts = products.some(
          (product) =>
            product.categoryId === id
        );

        if (linkedProducts) {
          throw new Error(
            "لا يمكن حذف هذا التصنيف لأنه يحتوي على منتجات. انقل المنتجات إلى تصنيف آخر أولاً."
          );
        }

        await supabaseRequest(
          "categories",
          {
            method: "DELETE",

            query:
              `id=eq.${encodeURIComponent(id)}`,
          }
        );

        await refresh();
      } catch (error) {
        console.error(
          "Delete category error:",
          error
        );

        setConnectionError(
          error instanceof Error
            ? error.message
            : String(error)
        );

        throw error;
      }
    },
    [categories, products, refresh]
  );

  // ========================================
  // Update Store Settings
  // ========================================

  const updateStoreSettings = useCallback(
    async (
      settings: Partial<StoreSettings>
    ): Promise<void> => {
      try {
        const allowedSettings = {
          store_name: settings.store_name,
          store_tagline: settings.store_tagline,
          announcement: settings.announcement,
          phone_number: settings.phone_number,
          whatsapp_number: settings.whatsapp_number,
          currency: settings.currency,

          free_shipping_threshold:
            settings.free_shipping_threshold,

          logo_url: settings.logo_url,
          banner_url: settings.banner_url,
          categories: settings.categories,
        };

        const body = Object.fromEntries(
          Object.entries(allowedSettings).filter(
            ([, value]) => value !== undefined
          )
        );

        if (Object.keys(body).length === 0) {
          return;
        }

        await supabaseRequest(
          "store_settings",
          {
            method: "PATCH",

            query: "id=eq.1",

            body,
          }
        );

        setStoreSettings((old) => ({
          ...old,
          ...body,
        }));
      } catch (error) {
        console.error(
          "Update settings error:",
          error
        );

        setConnectionError(
          error instanceof Error
            ? error.message
            : String(error)
        );

        throw error;
      }
    },
    []
  );

  // ========================================
  // WhatsApp Ordering Only
  // ========================================

  const placeOrder = useCallback(
    async (_data: {
      customer_name: string;
      phone: string;
      address: string;
      city: string;
      notes?: string;
    }): Promise<string> => {
      throw new Error(
        "الطلب يتم عبر واتساب فقط. استخدم زر اطلب الآن عبر واتساب في صفحة المنتج."
      );
    },
    []
  );

  // ========================================
  // Legacy Orders Disabled
  // ========================================

  const updateOrderStatus = useCallback(
    async (
      _id: string,
      _status: OrderStatus
    ): Promise<void> => {
      throw new Error(
        "إدارة الطلبات داخل الموقع غير مفعلة. الطلبات تتم عبر واتساب."
      );
    },
    []
  );

  // ========================================
  // Context Value
  // ========================================

  const value = useMemo<StoreContextValue>(
    () => ({
      categories,
      products,
      orders,
      storeSettings,

      cart,

      cartCount: Object.values(cart).reduce(
        (total, quantity) =>
          total + quantity,
        0
      ),

      cartItems: Object.entries(cart)
        .map(([id, quantity]) => ({
          product: products.find(
            (product) => product.id === id
          ),
          quantity,
        }))
        .filter(
          (
            item
          ): item is {
            product: Product;
            quantity: number;
          } => Boolean(item.product)
        ),

      loading,
      connectionError,

      addToCart,
      removeFromCart,
      clearCart,

      addProduct,
      updateProduct,
      deleteProduct,

      addCategory,
      updateCategory,
      deleteCategory,

      updateStoreSettings,

      placeOrder,
      refresh,
      updateOrderStatus,
    }),
    [
      categories,
      products,
      orders,
      storeSettings,
      cart,
      loading,
      connectionError,
      addToCart,
      removeFromCart,
      clearCart,
      addProduct,
      updateProduct,
      deleteProduct,
      addCategory,
      updateCategory,
      deleteCategory,
      updateStoreSettings,
      placeOrder,
      refresh,
      updateOrderStatus,
    ]
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

// ==========================================
// useStore Hook
// ==========================================

export function useStore() {
  const value = useContext(StoreContext);

  if (!value) {
    throw new Error(
      "useStore must be used inside StoreProvider"
    );
  }

  return value;
}

// ==========================================
// Price Formatter
// ==========================================

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 0,
  }).format(value);
}

// ==========================================
// WhatsApp Product Order URL
// ==========================================

export function buildWhatsAppUrl(
  whatsappNumber: string,
  product: Product,
  currency = "ج.م"
): string | null {
  let phone = String(
    whatsappNumber || ""
  ).replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "20" + phone.slice(1);
  }

  if (!phone || phone.length < 10) {
    return null;
  }

  const message = [
    "السلام عليكم،",
    "عايز أطلب المنتج التالي من الصاوى ستور:",
    "",
    `اسم المنتج: ${product.name}`,
    `السعر: ${formatPrice(product.price)} ${currency}`,
    `كود المنتج: ${product.sku || product.id}`,
    "",
    "من فضلكم أكدوا لي توفر المنتج وطريقة الاستلام.",
  ].join("\n");

  return (
    `https://wa.me/${phone}` +
    `?text=${encodeURIComponent(message)}`
  );
}

// ==========================================
// Empty Seeds
// ==========================================

export const categoriesSeed: Category[] = [];

export const productsSeed: Product[] = [];

export const ordersSeed: Order[] = [];
