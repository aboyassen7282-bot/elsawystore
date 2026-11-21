
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu,
  Search,
  MessageCircle,
} from "lucide-react";

import { useStore } from "@/lib/store";

export function StoreShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { storeSettings, connectionError } = useStore();

  const isCatalog = location.startsWith("/catalog");

  const storeName = storeSettings.store_name || "الصاوى ستور";

  const whatsapp = (storeSettings.whatsapp_number || "")
    .replace(/\D/g, "");

  const whatsappNumber = whatsapp.startsWith("0")
    ? "20" + whatsapp.slice(1)
    : whatsapp;

  const whatsappUrl =
    whatsappNumber.length >= 10
      ? `https://wa.me/${whatsappNumber}`
      : null;

  const announcement =
    storeSettings.announcement ||
    "أهلاً بيك في الصاوى ستور · اختار منتجك واطلب مباشرة عبر واتساب";

  const logoPath =
    "/assets/Gemini_Generated_Image_1jn6zk1jn6zk1jn6-removebg-preview.png";

  return (
    <div className="site-shell">

      {connectionError && (
        <div
          role="alert"
          style={{
            background: "#fff1f0",
            color: "#9b1c1c",
            padding: "10px 16px",
            textAlign: "center",
            fontSize: 13,
          }}
        >
          مشكلة اتصال المتجر: {connectionError}
        </div>
      )}

      <div className="announcement">
        <span className="live-dot" />
        {announcement}
      </div>

      <header className="site-header">

        <Link
          href="/"
          className="brand"
          onClick={() => setMobileOpen(false)}
        >
          <img
            src={logoPath}
            alt={`شعار ${storeName}`}
            className="header-logo"
            style={{
              width: 55,
              height: 55,
              objectFit: "contain",
              display: "block",
              flexShrink: 0,
            }}
          />

          <span>
            <strong>{storeName}</strong>
            <small>
              {storeSettings.store_tagline ||
                "للكمبيوتر واللاب توب وأنظمة المراقبة"}
            </small>
          </span>
        </Link>

        <button
          className="mobile-menu"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="فتح القائمة"
        >
          <Menu size={22} />
        </button>

        <nav className={`main-nav ${mobileOpen ? "is-open" : ""}`}>

          <Link
            className={location === "/" ? "active" : ""}
            href="/"
            onClick={() => setMobileOpen(false)}
          >
            الرئيسية
          </Link>

          <Link
            className={isCatalog ? "active" : ""}
            href="/catalog"
            onClick={() => setMobileOpen(false)}
          >
            المنتجات
          </Link>

          <a
            href="/#services"
            onClick={() => setMobileOpen(false)}
          >
            الصيانة والدعم
          </a>

          <a
            href="/#why-us"
            onClick={() => setMobileOpen(false)}
          >
            لماذا الصاوى ستور؟
          </a>

        </nav>

        <div className="header-actions">

          <Link
            className="icon-button search-button"
            href="/catalog"
            aria-label="البحث"
          >
            <Search size={19} />
          </Link>

          {whatsappUrl && (
            <a
              className="cart-button"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="تواصل معنا عبر واتساب"
            >
              <MessageCircle size={18} />
              <span>واتساب</span>
            </a>
          )}

        </div>
      </header>

      {children}

      <footer className="site-footer">

        <div className="footer-grid">

          <div>
            <Link
              href="/"
              className="brand footer-brand"
            >
              <img
                src={logoPath}
                className="brand-mark footer-logo"
                alt={`شعار ${storeName}`}
                style={{
                  width: 75,
                  height: 75,
                  objectFit: "contain",
                  display: "block",
                  flexShrink: 0,
                }}
              />

              <span>
                <strong>{storeName}</strong>
                <small>
                  {storeSettings.store_tagline ||
                    "للكمبيوتر واللاب توب وأنظمة المراقبة"}
                </small>
              </span>
            </Link>

            <p>
              كل ما تحتاجه من تقنية، في مكان واحد.
              نختار لك الأفضل ونجهزه ليعمل من أول يوم.
            </p>
          </div>

          <div>
            <h4>تسوق</h4>
            <Link href="/catalog">كل المنتجات</Link>
            <Link href="/catalog">أحدث المنتجات</Link>
          </div>

          <div>
            <h4>خدماتنا</h4>
            <a href="/#services">صيانة وترقية</a>
            <a href="/#services">تركيب كاميرات</a>
            <a href="/#services">دعم فني</a>
          </div>

          <div>
            <h4>تواصل معنا</h4>

            {storeSettings.phone_number && (
              <p className="contact-phone">
                {storeSettings.phone_number}
              </p>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-admin"
              >
                <MessageCircle size={14} />
                تواصل عبر واتساب
              </a>
            )}

          </div>

        </div>

        <div className="footer-bottom">
          <span>
            © 2026 {storeName}. جميع الحقوق محفوظة.
          </span>

          <span>صنعنا التقنية أسهل</span>
        </div>

      </footer>

    </div>
  );
}
