
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronLeft,
  Eye,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Package,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Tags,
  Trash2,
  X,
} from "lucide-react";

import {
  formatPrice,
  Product,
  StoreSettings,
  useStore,
} from "@/lib/store";

import {
  adminSignIn,
  adminSignOut,
  getAdminUser,
  uploadProductImage,
} from "@/lib/supabase";

import { toast } from "sonner";

type AdminTab = "overview" | "products" | "categories" | "settings";

type ProductForm = Omit<Product, "id">;

type CategoryForm = {
  name: string;
  eyebrow: string;
  icon: string;
  accent: string;
};

type SettingsForm = Pick<
  StoreSettings,
  | "store_name"
  | "store_tagline"
  | "announcement"
  | "phone_number"
  | "whatsapp_number"
  | "currency"
  | "logo_url"
  | "banner_url"
>;

type AdminUser = {
  email: string;
  name: string;
  role: "admin";
};

const emptyProduct = (categoryId: string): ProductForm => ({
  name: "",
  categoryId,
  description: "",
  price: 0,
  oldPrice: undefined,
  image: "/assets/store-laptops.jpg",
  images: ["/assets/store-laptops.jpg"],
  tag: "",
  stock: 99,
  sku: "TM-NEW-001",
  rating: 4.8,
  visible: true,
});

const emptyCategory = (): CategoryForm => ({
  name: "",
  eyebrow: "",
  icon: "laptop",
  accent: "cyan",
});

// ==========================================
// Admin Authentication - Supabase Email
// ==========================================

export default function Admin() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    let active = true;

    getAdminUser()
      .then((currentUser) => {
        if (active) {
          setUser(
            currentUser
              ? {
                  email: currentUser.email ?? "",
                  name: "مدير المتجر",
                  role: "admin",
                }
              : null
          );
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("اكتب الإيميل وكلمة المرور");
      return;
    }

    setLoggingIn(true);

    try {
      const signedInUser = await adminSignIn(email, password);

      setUser({
        email: signedInUser.email ?? email,
        name: "مدير المتجر",
        role: "admin",
      });

      setPassword("");

      toast.success("تم تسجيل الدخول بنجاح");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "فشل تسجيل الدخول"
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminSignOut();
      setUser(null);
      setPassword("");
      setEmail("");
      toast.success("تم تسجيل الخروج");
    } catch (error) {
      setUser(null);
      setPassword("");
      setEmail("");

      toast.error(
        error instanceof Error
          ? error.message
          : "تم تسجيل الخروج"
      );
    }
  };

  if (loading) {
    return (
      <AdminState
        icon={<ShieldCheck size={25} />}
        title="جارٍ التحقق من الدخول"
        text="لحظات ونجهز لوحة الإدارة."
      />
    );
  }

  if (!user) {
    return (
      <AdminState
        locked
        title="تسجيل دخول مدير المتجر"
        text="اكتب الإيميل وكلمة المرور للدخول إلى لوحة الإدارة."
        action={
          <form
            onSubmit={handleLogin}
            className="admin-login-form"
          >
            <label>
              البريد الإلكتروني

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="username"
                required
                dir="ltr"
                placeholder="name@example.com"
              />
            </label>

            <label>
              كلمة المرور

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                required
                dir="ltr"
                placeholder="كلمة المرور"
              />
            </label>

            <button
              className="button primary"
              type="submit"
              disabled={loggingIn}
            >
              {loggingIn
                ? "جارٍ تسجيل الدخول..."
                : "تسجيل الدخول"}

              <ChevronLeft size={17} />
            </button>
          </form>
        }
      />
    );
  }

  return (
    <AdminPanel
      userName={user.name}
      logout={handleLogout}
    />
  );
}

// ==========================================
// Admin State
// ==========================================

function AdminState({
  title,
  text,
  action,
  icon,
  locked,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className={`admin-lock-icon ${locked ? "locked" : ""}`}>
          {icon ?? <ShieldCheck size={26} />}
        </div>

        <span className="eyebrow">الصاوى ستور · الإدارة</span>

        <h1>{title}</h1>

        <p>{text}</p>

        {action}

        <a href="/" className="back-home">
          العودة إلى المتجر
          <ChevronLeft size={16} />
        </a>
      </div>
    </div>
  );
}

// ==========================================
// Main Admin Panel
// ==========================================

function AdminPanel({
  userName,
  logout,
}: {
  userName: string;
  logout: () => Promise<void>;
}) {
  const {
    products,
    categories,
    storeSettings,
    updateStoreSettings,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useStore();

  const [tab, setTab] = useState<AdminTab>("overview");

  const [productModal, setProductModal] = useState<{
    editing: Product | null;
  } | null>(null);

  const [categoryModal, setCategoryModal] = useState<{
    editing: string | null;
  } | null>(null);

  const [productForm, setProductForm] = useState<ProductForm>(() =>
    emptyProduct(categories[0]?.id ?? "")
  );

  const [categoryForm, setCategoryForm] =
    useState<CategoryForm>(emptyCategory);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const visibleProducts = products.length;

  const unavailableProducts = products.filter(
    (product) => product.stock <= 0
  ).length;

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      id: "overview",
      label: "نظرة عامة",
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: "products",
      label: "المنتجات",
      icon: <Package size={18} />,
      count: products.length,
    },
    {
      id: "categories",
      label: "التصنيفات",
      icon: <Tags size={18} />,
      count: categories.length,
    },
    {
      id: "settings",
      label: "الإعدادات",
      icon: <Settings size={18} />,
    },
  ];

  // ========================================
  // Products
  // ========================================

  const openNewProduct = () => {
    setProductForm(emptyProduct(categories[0]?.id ?? ""));
    setProductModal({ editing: null });
  };

  const openEditProduct = (product: Product) => {
    setProductForm({
      ...product,
      images: [product.image],
    });

    setProductModal({ editing: product });
  };

  const saveProduct = async () => {
    if (
      !productForm.name.trim() ||
      !productForm.categoryId ||
      !productForm.price
    ) {
      toast.error("أكمل اسم المنتج والتصنيف والسعر أولًا");
      return;
    }

    try {
      if (productModal?.editing) {
        await updateProduct(
          productModal.editing.id,
          productForm
        );

        toast.success("تم تحديث المنتج بنجاح");
      } else {
        await addProduct(productForm);

        toast.success("تمت إضافة المنتج بنجاح");
      }

      setProductModal(null);
    } catch (error) {
      console.error("Product save error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "تعذر حفظ المنتج في قاعدة البيانات"
      );
    }
  };

  const deleteProductHandler = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      return;
    }

    try {
      await deleteProduct(id);
      toast.success("تم حذف المنتج بنجاح");
    } catch (error) {
      console.error("Product delete error:", error);
      toast.error("تعذر حذف المنتج");
    }
  };

  // ========================================
  // Upload Product Image to Supabase Storage
  // ========================================

  const uploadProductImages = async (files?: FileList) => {
    if (!files?.length) return;

    const file = files[0];

    if (files.length > 1) {
      toast.info(
        "قاعدة البيانات الحالية تحفظ صورة أساسية واحدة لكل منتج. سيتم رفع أول صورة فقط."
      );
    }

    setUploadingImage(true);

    try {
      const imageUrl = await uploadProductImage(file);

      setProductForm((current) => ({
        ...current,
        image: imageUrl,
        images: [imageUrl],
      }));

      toast.success("تم رفع الصورة بنجاح");
    } catch (error) {
      console.error("Product image upload error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "تعذر رفع الصورة"
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // ========================================
  // Categories
  // ========================================

  const openNewCategory = () => {
    setCategoryForm(emptyCategory());
    setCategoryModal({ editing: null });
  };

  const openEditCategory = (id: string) => {
    const category = categories.find(
      (item) => item.id === id
    );

    if (!category) return;

    setCategoryForm({
      name: category.name,
      eyebrow: category.eyebrow,
      icon: category.icon,
      accent: category.accent,
    });

    setCategoryModal({ editing: id });
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error("اكتب اسم التصنيف");
      return;
    }

    try {
      if (categoryModal?.editing) {
        await updateCategory(
          categoryModal.editing,
          categoryForm
        );

        toast.success("تم تحديث التصنيف");
      } else {
        await addCategory(categoryForm);

        toast.success("تمت إضافة التصنيف");
      }

      setCategoryModal(null);
    } catch (error) {
      console.error("Category save error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "تعذر حفظ التصنيف"
      );
    }
  };

  const deleteCategoryHandler = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا التصنيف؟")) {
      return;
    }

    try {
      await deleteCategory(id);
      toast.success("تم حذف التصنيف");
    } catch (error) {
      console.error("Category delete error:", error);
      toast.error("تعذر حذف التصنيف");
    }
  };

  // ========================================
  // Admin Layout
  // ========================================

  return (
    <div className="admin-layout">
      <aside
        className={`admin-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="admin-brand">
          <span className="brand-mark">
            <span>T</span>
          </span>

          <div>
            <strong>الصاوى ستور</strong>
            <small>مساحة الإدارة</small>
          </div>

          <button
            className="icon-button admin-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-profile">
          <div className="avatar">
            {userName.slice(0, 1)}
          </div>

          <div>
            <strong>{userName}</strong>
            <span>مدير المتجر</span>
          </div>

          <span className="online-status" />
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => {
                setTab(item.id);
                setSidebarOpen(false);
              }}
            >
              {item.icon}

              <span>{item.label}</span>

              {item.count !== undefined && (
                <b>{item.count}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-side-bottom">
          <div className="security-note">
            <ShieldCheck size={17} />

            <span>
              حسابك محمي
              <br />
              <small>Supabase Auth</small>
            </span>
          </div>

          <button
            className="admin-logout"
            onClick={() => logout()}
          >
            <LogOut size={17} />
            تسجيل الخروج
          </button>

          <a href="/" className="view-store">
            العودة للمتجر
            <ChevronLeft size={15} />
          </a>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="mobile-admin-menu"
            onClick={() => setSidebarOpen(true)}
          >
            <LayoutDashboard size={20} />
          </button>

          <div>
            <span className="eyebrow">مساحة الإدارة</span>
            <h1>
              {navItems.find((item) => item.id === tab)?.label}
            </h1>
          </div>

          <div className="admin-top-actions">
            <div className="top-avatar">
              {userName.slice(0, 1)}
            </div>
          </div>
        </header>

        <div className="admin-content">
          {tab === "overview" && (
            <Overview
              products={products}
              categories={categories}
              visibleProducts={visibleProducts}
              unavailableProducts={unavailableProducts}
              setTab={setTab}
            />
          )}

          {tab === "products" && (
            <ProductsView
              products={products}
              categories={categories}
              openNew={openNewProduct}
              openEdit={openEditProduct}
              onDelete={deleteProductHandler}
            />
          )}

          {tab === "categories" && (
            <CategoriesView
              categories={categories}
              products={products}
              openNew={openNewCategory}
              openEdit={openEditCategory}
              onDelete={deleteCategoryHandler}
            />
          )}

          {tab === "settings" && (
            <SettingsView
              storeSettings={storeSettings}
              updateStoreSettings={updateStoreSettings}
            />
          )}
        </div>
      </div>

      {productModal && (
        <ProductEditor
          form={productForm}
          setForm={setProductForm}
          editing={productModal.editing}
          categories={categories}
          close={() => setProductModal(null)}
          save={saveProduct}
          upload={uploadProductImages}
          uploading={uploadingImage}
        />
      )}

      {categoryModal && (
        <CategoryEditor
          form={categoryForm}
          setForm={setCategoryForm}
          editing={Boolean(categoryModal.editing)}
          close={() => setCategoryModal(null)}
          save={saveCategory}
        />
      )}
    </div>
  );
}

// ==========================================
// Overview
// ==========================================

function Overview({
  products,
  categories,
  visibleProducts,
  unavailableProducts,
  setTab,
}: {
  products: Product[];
  categories: ReturnType<typeof useStore>["categories"];
  visibleProducts: number;
  unavailableProducts: number;
  setTab: (tab: AdminTab) => void;
}) {
  return (
    <div className="overview">
      <div className="welcome-panel">
        <div>
          <span className="eyebrow light">
            الصاوى ستور
          </span>

          <h2>أهلاً بك في إدارة متجرك.</h2>

          <p>
            تابع منتجاتك وتصنيفاتك وتحكم في بيانات المتجر بسهولة.
          </p>
        </div>

        <div className="welcome-orb">
          <Package size={31} />
        </div>
      </div>

      <div className="metric-grid">
        <Metric
          icon={<Package />}
          label="إجمالي المنتجات"
          value={String(products.length)}
          trend="منتج مسجل"
          tone="cyan"
        />

        <Metric
          icon={<Eye />}
          label="منتجات الكتالوج"
          value={String(visibleProducts)}
          trend="منتج مسجل بالمتجر"
          tone="green"
        />

        <Metric
          icon={<Tags />}
          label="التصنيفات"
          value={String(categories.length)}
          trend="تصنيف بالمتجر"
          tone="violet"
        />

        <Metric
          icon={<Package />}
          label="غير متوفر"
          value={String(unavailableProducts)}
          trend={
            unavailableProducts
              ? "منتجات غير متاحة"
              : "كل المنتجات متاحة"
          }
          tone="orange"
        />
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card quick-actions">
          <div className="card-heading">
            <div>
              <span className="eyebrow">اختصارات</span>
              <h3>إدارة سريعة</h3>
            </div>
          </div>

          <button onClick={() => setTab("products")}>
            <span className="quick-icon cyan">
              <Plus size={18} />
            </span>

            <span>
              <strong>إضافة منتج</strong>
              <small>أضف منتجًا جديدًا للكتالوج</small>
            </span>

            <ChevronLeft size={16} />
          </button>

          <button onClick={() => setTab("categories")}>
            <span className="quick-icon orange">
              <Tags size={18} />
            </span>

            <span>
              <strong>إدارة التصنيفات</strong>
              <small>نظّم منتجات المتجر</small>
            </span>

            <ChevronLeft size={16} />
          </button>

          <button onClick={() => setTab("settings")}>
            <span className="quick-icon violet">
              <Settings size={18} />
            </span>

            <span>
              <strong>إعدادات المتجر</strong>
              <small>تعديل بيانات التواصل والواتساب</small>
            </span>

            <ChevronLeft size={16} />
          </button>
        </section>

        <section className="dashboard-card quick-actions">
          <div className="card-heading">
            <div>
              <span className="eyebrow">حالة الكتالوج</span>
              <h3>ملخص المنتجات</h3>
            </div>
          </div>

          <p>
            عدد المنتجات المسجلة:{" "}
            <strong>{products.length}</strong>
          </p>

          <p>
            المنتجات المسجلة بالكتالوج:{" "}
            <strong>{visibleProducts}</strong>
          </p>

          <p>
            المنتجات غير المتوفرة:{" "}
            <strong>{unavailableProducts}</strong>
          </p>

          <p>
            التصنيفات المتاحة:{" "}
            <strong>{categories.length}</strong>
          </p>
        </section>
      </div>
    </div>
  );
}

// ==========================================
// Metric Card
// ==========================================

function Metric({
  icon,
  label,
  value,
  trend,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${tone}`}>
        {icon}
      </span>

      <span className="metric-label">{label}</span>

      <strong>{value}</strong>

      <small
        className={
          trend.includes("غير متاحة")
            ? "warning-text"
            : "positive-text"
        }
      >
        {trend}
      </small>
    </div>
  );
}

// ==========================================
// Products View
// ==========================================

function ProductsView({
  products,
  categories,
  openNew,
  openEdit,
  onDelete,
}: {
  products: Product[];
  categories: ReturnType<typeof useStore>["categories"];
  openNew: () => void;
  openEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="admin-section">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">المخزون والكتالوج</span>

          <h2>
            إدارة المنتجات
            <small>{products.length}</small>
          </h2>
        </div>

        <button
          className="button primary"
          onClick={openNew}
        >
          <Plus size={17} />
          منتج جديد
        </button>
      </div>

      <div className="admin-filters">
        <div className="admin-search">
          إدارة منتجات المتجر
        </div>

        <span className="filter-chip active">
          كل المنتجات
        </span>
      </div>

      <div className="dashboard-card admin-table-card">
        <div className="admin-product-table">
          <div className="table-row table-head">
            <span>المنتج</span>
            <span>التصنيف</span>
            <span>السعر</span>
            <span>التوفر</span>
            <span>الحالة</span>
            <span>إجراءات</span>
          </div>

          {products.map((product) => (
            <div className="table-row" key={product.id}>
              <div className="admin-product-name">
                <img src={product.image} alt="" />

                <div>
                  <strong>{product.name}</strong>
                  <small>{product.sku}</small>
                </div>
              </div>

              <span>
                {categories.find(
                  (item) => item.id === product.categoryId
                )?.name ?? "بدون تصنيف"}
              </span>

              <b>
                {formatPrice(product.price)} ج.م
              </b>

              <span
                className={
                  product.stock > 0
                    ? "positive-text"
                    : "warning-text"
                }
              >
                {product.stock > 0
                  ? "متوفر"
                  : "غير متوفر"}
              </span>

              <span
                className={`visibility-badge ${
                  product.stock > 0 ? "shown" : "hidden"
                }`}
              >
                {product.stock > 0
                  ? "متاح للطلب"
                  : "نفد من المخزون"}
              </span>

              <div className="row-actions">
                <button
                  onClick={() => openEdit(product)}
                  aria-label="تعديل"
                >
                  <Pencil size={15} />
                </button>

                <button
                  onClick={() => onDelete(product.id)}
                  aria-label="حذف"
                  className="danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="empty-state">
              لا توجد منتجات حتى الآن. أضف أول منتج للمتجر.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Categories View
// ==========================================

function CategoriesView({
  categories,
  products,
  openNew,
  openEdit,
  onDelete,
}: {
  categories: ReturnType<typeof useStore>["categories"];
  products: Product[];
  openNew: () => void;
  openEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="admin-section">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">تنظيم المتجر</span>

          <h2>
            التصنيفات
            <small>{categories.length}</small>
          </h2>
        </div>

        <button
          className="button primary"
          onClick={openNew}
        >
          <Plus size={17} />
          تصنيف جديد
        </button>
      </div>

      <div className="category-admin-grid">
        {categories.map((category) => (
          <div
            className={`category-admin-card ${category.accent}`}
            key={category.id}
          >
            <div className="category-admin-icon">
              <Tags size={21} />
            </div>

            <div>
              <span className="eyebrow">
                {category.eyebrow}
              </span>

              <h3>{category.name}</h3>

              <p>
                {
                  products.filter(
                    (product) =>
                      product.categoryId === category.id
                  ).length
                }{" "}
                منتجات مرتبطة
              </p>
            </div>

            <div className="row-actions">
              <button
                onClick={() => openEdit(category.id)}
                aria-label="تعديل التصنيف"
              >
                <Pencil size={15} />
              </button>

              <button
                onClick={() => onDelete(category.id)}
                className="danger"
                aria-label="حذف التصنيف"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="empty-state">
            لا توجد تصنيفات حتى الآن.
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Store Settings
// ==========================================

function SettingsView({
  storeSettings,
  updateStoreSettings,
}: {
  storeSettings: StoreSettings;
  updateStoreSettings: (
    settings: Partial<StoreSettings>
  ) => Promise<void>;
}) {
  const [form, setForm] = useState<SettingsForm>(() => ({
    store_name: storeSettings.store_name,
    store_tagline: storeSettings.store_tagline,
    announcement: storeSettings.announcement,
    phone_number: storeSettings.phone_number,
    whatsapp_number: storeSettings.whatsapp_number,
    currency: storeSettings.currency,
    logo_url: storeSettings.logo_url,
    banner_url: storeSettings.banner_url,
  }));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      store_name: storeSettings.store_name,
      store_tagline: storeSettings.store_tagline,
      announcement: storeSettings.announcement,
      phone_number: storeSettings.phone_number,
      whatsapp_number: storeSettings.whatsapp_number,
      currency: storeSettings.currency,
      logo_url: storeSettings.logo_url,
      banner_url: storeSettings.banner_url,
    });
  }, [storeSettings]);

  const updateField = (
    field: keyof SettingsForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveSettings = async () => {
    if (!form.store_name?.trim()) {
      toast.error("اكتب اسم المتجر أولًا");
      return;
    }

    if (!form.whatsapp_number?.trim()) {
      toast.error("اكتب رقم واتساب المتجر");
      return;
    }

    setSaving(true);

    try {
      await updateStoreSettings({
        store_name: form.store_name.trim(),
        store_tagline: form.store_tagline,
        announcement: form.announcement,
        phone_number: form.phone_number,
        whatsapp_number: form.whatsapp_number,
        currency: form.currency,
        logo_url: form.logo_url,
        banner_url: form.banner_url,
      });

      toast.success("تم حفظ إعدادات المتجر بنجاح");
    } catch (error) {
      console.error("Store settings error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "تعذر حفظ الإعدادات"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">التحكم الكامل</span>
          <h2>إعدادات المتجر</h2>
        </div>

        <button
          className="button primary"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      <div className="settings-grid">
        <div className="dashboard-card settings-card">
          <span className="settings-icon cyan">
            <Settings size={19} />
          </span>

          <h3>بيانات المتجر</h3>

          <label>
            اسم المتجر
            <input
              value={form.store_name ?? ""}
              onChange={(event) =>
                updateField("store_name", event.target.value)
              }
              placeholder="الصاوى ستور"
            />
          </label>

          <label>
            الوصف المختصر
            <input
              value={form.store_tagline ?? ""}
              onChange={(event) =>
                updateField("store_tagline", event.target.value)
              }
              placeholder="الصاوى - اختيارك"
            />
          </label>

          <label>
            رقم الهاتف
            <input
              type="tel"
              dir="ltr"
              value={form.phone_number ?? ""}
              onChange={(event) =>
                updateField("phone_number", event.target.value)
              }
              placeholder="01xxxxxxxxx"
            />
          </label>

          <label>
            رقم واتساب الطلبات
            <input
              type="tel"
              dir="ltr"
              value={form.whatsapp_number ?? ""}
              onChange={(event) =>
                updateField("whatsapp_number", event.target.value)
              }
              placeholder="01xxxxxxxxx"
            />
            <small>
              الرقم الذي سيستقبل رسائل طلبات العملاء.
            </small>
          </label>

          <label>
            العملة
            <input
              value={form.currency ?? ""}
              onChange={(event) =>
                updateField("currency", event.target.value)
              }
              placeholder="ج.م"
            />
          </label>

          <label>
            رسالة الشريط العلوي
            <textarea
              value={form.announcement ?? ""}
              onChange={(event) =>
                updateField("announcement", event.target.value)
              }
              placeholder="اكتب رسالة تظهر أعلى المتجر"
            />
          </label>

          <label>
            رابط شعار المتجر
            <input
              value={form.logo_url ?? ""}
              onChange={(event) =>
                updateField("logo_url", event.target.value)
              }
              placeholder="رابط صورة الشعار"
            />
          </label>

          <label>
            رابط صورة البانر
            <input
              value={form.banner_url ?? ""}
              onChange={(event) =>
                updateField("banner_url", event.target.value)
              }
              placeholder="رابط صورة البانر"
            />
          </label>
        </div>

        <div className="dashboard-card settings-card">
          <span className="settings-icon orange">
            <Bell size={19} />
          </span>

          <h3>طريقة استقبال الطلبات</h3>

          <div className="permission-line">
            <span className="avatar small">W</span>

            <div>
              <strong>الطلب عبر واتساب</strong>
              <small>رسالة مباشرة إلى رقم المتجر</small>
            </div>

            <span className="status-badge done">
              مفعّل
            </span>
          </div>

          <p className="security-copy">
            العميل يختار المنتج ويضغط على زر الطلب عبر واتساب،
            ثم يتم فتح محادثة برسالة تحتوي على بيانات المنتج.
            لا يتم إنشاء طلب داخل قاعدة البيانات من خلال هذا النظام.
          </p>
        </div>

        <div className="dashboard-card settings-card">
          <span className="settings-icon violet">
            <ShieldCheck size={19} />
          </span>

          <h3>الأمان والصلاحيات</h3>

          <div className="permission-line">
            <span className="avatar small">م</span>

            <div>
              <strong>مدير المتجر</strong>
              <small>Supabase Auth</small>
            </div>

            <span className="status-badge done">
              نشط
            </span>
          </div>

          <p className="security-copy">
            الدخول إلى لوحة الإدارة محمي بتسجيل الدخول.
            يجب أن تظل صلاحيات التعديل في Supabase مقتصرة
            على حسابات الإدارة المصرح لها.
          </p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Product Editor
// ==========================================

function ProductEditor({
  form,
  setForm,
  editing,
  categories,
  close,
  save,
  upload,
  uploading,
}: {
  form: ProductForm;
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>;
  editing: Product | null;
  categories: ReturnType<typeof useStore>["categories"];
  close: () => void;
  save: () => void;
  upload: (files?: FileList) => Promise<void>;
  uploading: boolean;
}) {
  return (
    <div className="editor-backdrop">
      <div className="editor-modal">
        <div className="editor-head">
          <div>
            <span className="eyebrow">
              {editing ? "تعديل المنتج" : "منتج جديد"}
            </span>

            <h2>
              {editing
                ? editing.name
                : "أضف منتجًا للكتالوج"}
            </h2>
          </div>

          <button
            className="icon-button"
            onClick={close}
            disabled={uploading}
          >
            <X size={18} />
          </button>
        </div>

        <div className="editor-body">
          <div className="image-upload">
            <img src={form.image} alt="معاينة المنتج" />

            <label>
              <ImagePlus size={19} />

              <span>
                {uploading
                  ? "جارٍ رفع الصورة..."
                  : "ارفع صورة المنتج"}
              </span>

              <small>
                JPG أو PNG أو WEBP أو GIF · الحد الأقصى 5 ميجابايت
              </small>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading}
                onChange={(event) => {
                  void upload(
                    event.target.files ?? undefined
                  );

                  event.target.value = "";
                }}
              />
            </label>

            <input
              value={
                form.image.startsWith("data:")
                  ? ""
                  : form.image
              }
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  image: event.target.value,
                  images: [event.target.value],
                }))
              }
              placeholder="أو ألصق رابط صورة المنتج"
            />

            <small>
              يتم حفظ صورة أساسية واحدة لكل منتج حسب أعمدة قاعدة البيانات الحالية.
            </small>
          </div>

          <div className="form-grid">
            <label>
              اسم المنتج
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="مثال: لابتوب أعمال"
              />
            </label>

            <label>
              التصنيف
              <select
                value={form.categoryId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
              >
                {categories.map((category) => (
                  <option
                    value={category.id}
                    key={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              السعر الحالي
              <input
                type="number"
                min="0"
                value={form.price || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    price: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label>
              السعر السابق
              <input
                type="number"
                min="0"
                value={form.oldPrice || ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    oldPrice:
                      Number(event.target.value) || undefined,
                  }))
                }
              />
            </label>

            <label className="wide">
              حالة المنتج
              <select
                value={form.stock > 0 ? "available" : "unavailable"}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    stock:
                      event.target.value === "available"
                        ? 99
                        : 0,
                  }))
                }
              >
                <option value="available">متوفر</option>
                <option value="unavailable">غير متوفر</option>
              </select>
              <small>
                قاعدة البيانات الحالية تحفظ حالة التوفر فقط، وليس عدد القطع.
              </small>
            </label>

            <label className="wide">
              الشارة
              <input
                value={form.tag ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tag: event.target.value,
                  }))
                }
                placeholder="الأكثر مبيعًا، جديد..."
              />
            </label>

            <label className="wide">
              الوصف
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="اكتب وصفًا واضحًا للمنتج"
              />
            </label>
          </div>
        </div>

        <div className="editor-foot">
          <button
            className="button secondary"
            onClick={close}
            disabled={uploading}
          >
            إلغاء
          </button>

          <button
            className="button primary"
            onClick={save}
            disabled={uploading}
          >
            {uploading
              ? "جارٍ رفع الصورة..."
              : editing
                ? "حفظ التعديل"
                : "إضافة المنتج"}
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Category Editor
// ==========================================

function CategoryEditor({
  form,
  setForm,
  editing,
  close,
  save,
}: {
  form: CategoryForm;
  setForm: React.Dispatch<React.SetStateAction<CategoryForm>>;
  editing: boolean;
  close: () => void;
  save: () => void;
}) {
  return (
    <div className="editor-backdrop">
      <div className="small-editor-modal">
        <div className="editor-head">
          <div>
            <span className="eyebrow">
              {editing ? "تعديل التصنيف" : "تصنيف جديد"}
            </span>

            <h2>
              {editing
                ? "حدّث بيانات التصنيف"
                : "أضف تصنيفًا جديدًا"}
            </h2>
          </div>

          <button
            className="icon-button"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>

        <div className="form-grid one-col">
          <label>
            اسم التصنيف
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="مثال: شاشات"
            />
          </label>

          <small>
            سيتم حفظ اسم التصنيف في قاعدة البيانات. الألوان والوصف القصير يعرضهما المتجر حسب إعداداته الحالية.
          </small>
        </div>

        <div className="editor-foot">
          <button
            className="button secondary"
            onClick={close}
          >
            إلغاء
          </button>

          <button
            className="button primary"
            onClick={save}
          >
            حفظ التصنيف
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
