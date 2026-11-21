
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Filter,
  Search,
  SlidersHorizontal,
  Star,
  X,
  MessageCircle,
} from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { StoreShell } from "@/components/StoreShell";

import {
  buildWhatsAppUrl,
  formatPrice,
  Product,
  useStore,
} from "@/lib/store";

import { toast } from "sonner";

export default function Catalog() {
  const { products, categories, storeSettings } = useStore();

  const [search, setSearch] = useState("");

  const [category, setCategory] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("category") ?? "all"
      : "all"
  );

  const [sort, setSort] = useState("featured");
  const [selected, setSelected] = useState<Product | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);

  const visibleProducts = useMemo(() => {
    const next = products.filter(
      (product) =>
        product.visible &&
        (category === "all" || product.categoryId === category) &&
        `${product.name} ${product.description}`
          .toLowerCase()
          .includes(search.toLowerCase())
    );

    if (sort === "price-low") {
      return [...next].sort((a, b) => a.price - b.price);
    }

    if (sort === "price-high") {
      return [...next].sort((a, b) => b.price - a.price);
    }

    if (sort === "rating") {
      return [...next].sort((a, b) => b.rating - a.rating);
    }

    return next;
  }, [category, products, search, sort]);

  const selectedCategory = categories.find(
    (item) => item.id === category
  );

  return (
    <StoreShell>
      <main className="catalog-page">
        <div className="container">
          <div className="catalog-hero">
            <div>
              <span className="section-kicker">
                <span className="kicker-line" />
                متجر الصاوى ستور
              </span>

              <h1>
                كل التقنية
                <br />
                <em>في مكان واحد.</em>
              </h1>

              <p>
                اختيارات واضحة، أسعار صريحة، وخدمة تعرف ماذا تفعل بعد الشراء.
              </p>
            </div>

            <div className="catalog-note">
              <span className="floating-icon cyan">
                <Filter size={17} />
              </span>

              <strong>
                {products.filter((item) => item.visible).length} منتج مختار
              </strong>

              <small>يتحدث باستمرار حسب احتياجك</small>
            </div>
          </div>

          <div className="catalog-toolbar">
            <div className="search-field">
              <Search size={18} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث عن لابتوب، كاميرا، إكسسوار..."
              />
            </div>

            <button
              className="filter-mobile"
              onClick={() => setMobileFilters((value) => !value)}
            >
              <SlidersHorizontal size={17} />
              الفلاتر
            </button>

            <label className="sort-select">
              ترتيب حسب

              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="featured">الأكثر صلة</option>
                <option value="price-low">السعر: الأقل أولًا</option>
                <option value="price-high">السعر: الأعلى أولًا</option>
                <option value="rating">الأعلى تقييمًا</option>
              </select>
            </label>
          </div>

          <div className="catalog-layout">
            <aside
              className={`catalog-sidebar ${mobileFilters ? "open" : ""}`}
            >
              <div className="sidebar-title">
                <strong>التصنيفات</strong>

                <button
                  className="icon-button close-mobile"
                  onClick={() => setMobileFilters(false)}
                >
                  <X size={17} />
                </button>
              </div>

              <button
                className={
                  category === "all"
                    ? "filter-link active"
                    : "filter-link"
                }
                onClick={() => {
                  setCategory("all");
                  setMobileFilters(false);
                }}
              >
                كل المنتجات
                <span>{products.length}</span>
              </button>

              {categories.map((item) => (
                <button
                  key={item.id}
                  className={
                    category === item.id
                      ? "filter-link active"
                      : "filter-link"
                  }
                  onClick={() => {
                    setCategory(item.id);
                    setMobileFilters(false);
                  }}
                >
                  {item.name}

                  <span>
                    {
                      products.filter(
                        (product) => product.categoryId === item.id
                      ).length
                    }
                  </span>
                </button>
              ))}

              <div className="sidebar-divider" />

              <div className="sidebar-promise">
                <Check size={17} />

                <div>
                  <strong>توصيل موثوق</strong>
                  <p>نجهز طلبك بعناية ونرسله بأسرع وقت.</p>
                </div>
              </div>

              <div className="sidebar-promise">
                <Check size={17} />

                <div>
                  <strong>ضمان محلي</strong>
                  <p>خدمة ما بعد البيع عندنا جزء من المنتج.</p>
                </div>
              </div>
            </aside>

            <div className="catalog-results">
              <div className="results-head">
                <span>
                  {selectedCategory
                    ? selectedCategory.name
                    : "كل المنتجات"}

                  <b>{visibleProducts.length}</b>
                </span>

                {search && (
                  <button
                    className="clear-search"
                    onClick={() => setSearch("")}
                  >
                    مسح البحث
                    <X size={13} />
                  </button>
                )}
              </div>

              {visibleProducts.length ? (
                <div className="product-grid">
                  {visibleProducts.map((product) => (
                    <div
                      className="catalog-product-wrap"
                      key={product.id}
                    >
                      <ProductCard product={product} />

                      <button
                        className="details-link"
                        onClick={() => setSelected(product)}
                      >
                        عرض التفاصيل
                        <ArrowLeft size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <div className="empty-icon">
                    <Search size={24} />
                  </div>

                  <h3>ما لقينا طلبك</h3>

                  <p>
                    جرّب كلمة مختلفة أو استعرض كل المنتجات.
                  </p>

                  <button
                    className="button primary"
                    onClick={() => {
                      setSearch("");
                      setCategory("all");
                    }}
                  >
                    عرض كل المنتجات
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {selected && (
        <ProductModal
          product={selected}
          close={() => setSelected(null)}
          whatsappNumber={storeSettings.whatsapp_number}
          currency={storeSettings.currency}
        />
      )}
    </StoreShell>
  );
}

function ProductModal({
  product,
  close,
  whatsappNumber,
  currency,
}: {
  product: Product;
  close: () => void;
  whatsappNumber: string;
  currency: string;
}) {
  const gallery = product.images?.length
    ? product.images
    : [product.image];

  const [activeImage, setActiveImage] = useState(gallery[0]);

  const orderNow = () => {
    const url = buildWhatsAppUrl(
      whatsappNumber,
      product,
      currency
    );

    if (!url) {
      toast.error("رقم الواتساب غير مضبوط", {
        description: "يرجى التواصل مع إدارة المتجر.",
      });

      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="product-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="icon-button modal-close"
          onClick={close}
        >
          <X size={18} />
        </button>

        <div className="modal-gallery">
          <div className="modal-image">
            <img src={activeImage} alt={product.name} />
          </div>

          {gallery.length > 1 && (
            <div className="modal-thumbs">
              {gallery.map((image, index) => (
                <button
                  className={
                    activeImage === image ? "active" : ""
                  }
                  key={`${image}-${index}`}
                  onClick={() => setActiveImage(image)}
                >
                  <img
                    src={image}
                    alt={`صورة ${index + 1} من ${product.name}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="modal-copy">
          <span className="eyebrow">
            تفاصيل المنتج
            {gallery.length > 1 && ` · ${gallery.length} صور`}
          </span>

          <h2>{product.name}</h2>

          <div className="modal-rating">
            <Star size={15} fill="currentColor" />
            {product.rating} · تقييمات العملاء
          </div>

          <div className="modal-price">
            <strong>
              {formatPrice(product.price)}
              <small> {currency || "ج.م"}</small>
            </strong>

            {product.oldPrice && (
              <del>
                {formatPrice(product.oldPrice)} {currency || "ج.م"}
              </del>
            )}
          </div>

          <p>{product.description}</p>

          <div className="modal-stock">
            <Check size={15} />
            متوفر الآن
          </div>

          <button
            className="button primary full"
            onClick={orderNow}
          >
            اطلب الآن عبر واتساب
            <MessageCircle size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
