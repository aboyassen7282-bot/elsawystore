# ربط متجر الصاوى ستور بـ Supabase

## 1) إعداد المفاتيح
انسخ `.env.example` إلى `.env` في جذر المشروع، ثم ضع:
- `VITE_SUPABASE_URL`: Project URL من Supabase > Project Settings > API.
- `VITE_SUPABASE_ANON_KEY`: Publishable key أو anon public key.

لا تضع `service_role` في ملفات الواجهة أو ترسله لأي شخص.

## 2) إعداد Storage
من Supabase > Storage أنشئ Bucket باسم `product-images` واجعله Public لعرض صور المنتجات. رفع الصور من لوحة الإدارة يحتاج لاحقاً سياسة Storage للمستخدم الإداري.

## 3) سياسات القراءة والطلبات (SQL Editor)
شغّل السياسات التالية بعد التأكد من أسماء الجداول كما في مخططك:

```sql
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_settings enable row level security;

create policy "public read categories" on public.categories for select to anon, authenticated using (true);
create policy "public read products" on public.products for select to anon, authenticated using (true);
create policy "public read store settings" on public.store_settings for select to anon, authenticated using (true);

-- يسمح للزائر بإنشاء طلب جديد فقط. لا تسمح للزائر بقراءة بيانات العملاء أو تعديل الطلبات.
create policy "guest create orders" on public.orders for insert to anon, authenticated
with check (status = 'new' and payment_method = 'cod' and subtotal >= 0 and shipping_fee >= 0 and total = subtotal + shipping_fee);
create policy "guest create order items" on public.order_items for insert to anon, authenticated
with check (quantity > 0 and price >= 0 and total_price = price * quantity);

-- صلاحيات الإدارة لا تُفتح للـ anon. يجب ربط دخول المدير بـ Supabase Auth وتعيين app_metadata.role = 'admin' قبل تفعيل سياسات الإدارة.
```

مهم: قبل إطلاق المتجر، أضف حماية ضد الطلبات الآلية (Captcha/Edge Function أو تحقق خادمي)، ولا تعرض جدول الطلبات للزوار.

## 4) تشغيل المشروع
```bash
pnpm install
pnpm dev
```

## ملاحظات توافق المخطط
- جدول `products` لا يحتوي عمود كمية مخزون أو SKU؛ الواجهة الحالية تستخدم `in_stock` فقط (متاح/غير متاح)، وتعرض كمية تقريبية 99 أو 0 مؤقتاً.
- جدول `categories` مرتبط بالمنتجات عبر `products.category` كنص مطابق لـ `categories.name`، وليس عبر category_id.
- `orders` و`order_items` مرتبطان باستخدام `order_items.order_id -> orders.id`.
- الواجهة الحالية تستخدم Manus OAuth لحماية `/admin`. هذا ليس Supabase Auth؛ لذلك لن تعمل عمليات إدارة المنتجات/الأقسام وتحديث الطلبات من لوحة الإدارة إلا بعد توحيد تسجيل دخول المدير مع Supabase Auth وإضافة سياسات RLS للمدير. لا تفتح CRUD للـ anon كحل بديل.
