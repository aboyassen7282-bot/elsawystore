
import type { Express, Request, Response } from "express";
import express from "express";
import { randomUUID } from "node:crypto";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isValidImage(buffer: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (contentType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      )
    );
  }

  if (contentType === "image/gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }

  if (contentType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

export function registerStorageRoutes(app: Express) {
  app.post(
    "/api/admin/upload-product-image",
    express.raw({
      type: "application/octet-stream",
      limit: MAX_FILE_SIZE,
    }),
    async (req: Request, res: Response) => {
      try {
        // إعدادات Supabase
        const supabaseUrl = (
          process.env.SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL ||
          ""
        ).replace(/\/+$/, "");

        const supabaseKey =
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          "";

        const serviceRoleKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY;

        const adminEmail = (process.env.ADMIN_EMAIL || "")
          .trim()
          .toLowerCase();

        if (
          !supabaseUrl ||
          !supabaseKey ||
          !serviceRoleKey ||
          !adminEmail
        ) {
          console.error(
            "[Storage] Missing server configuration"
          );

          res.status(500).json({
            error: "إعدادات رفع الصور غير مكتملة على السيرفر.",
          });
          return;
        }

        // استخراج Supabase Access Token
        const authorization = req.get("authorization") || "";
        const tokenMatch = authorization.match(
          /^Bearer\s+(.+)$/i
        );

        const accessToken = tokenMatch?.[1];

        if (!accessToken) {
          res.status(401).json({
            error: "يجب تسجيل الدخول بحساب المدير أولاً.",
          });
          return;
        }

        // التحقق من هوية المستخدم مباشرة من Supabase Auth
        const authResponse = await fetch(
          `${supabaseUrl}/auth/v1/user`,
          {
            method: "GET",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!authResponse.ok) {
          res.status(401).json({
            error: "جلسة تسجيل الدخول غير صالحة. سجل الدخول مرة أخرى.",
          });
          return;
        }

        const authenticatedUser = await authResponse.json() as {
          id?: string;
          email?: string;
          email_confirmed_at?: string | null;
        };

        const authenticatedEmail = (
          authenticatedUser.email || ""
        ).trim().toLowerCase();

        if (
          !authenticatedUser.id ||
          !authenticatedEmail ||
          !authenticatedUser.email_confirmed_at ||
          authenticatedEmail !== adminEmail
        ) {
          res.status(403).json({
            error: "غير مصرح لك برفع الصور. هذه العملية للمدير فقط.",
          });
          return;
        }

        // التحقق من الصورة
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          res.status(400).json({
            error: "لم يتم إرسال صورة صالحة.",
          });
          return;
        }

        if (req.body.length > MAX_FILE_SIZE) {
          res.status(413).json({
            error: "حجم الصورة يجب ألا يتجاوز 5 MB.",
          });
          return;
        }

        const contentType = req.header("x-file-type") || "";

        if (!ALLOWED_TYPES[contentType]) {
          res.status(415).json({
            error: "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF.",
          });
          return;
        }

        if (!isValidImage(req.body, contentType)) {
          res.status(415).json({
            error: "محتوى الملف لا يتطابق مع نوع الصورة المحدد.",
          });
          return;
        }

        // إنشاء اسم فريد للصورة
        const extension = ALLOWED_TYPES[contentType];
        const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
        const filePath = `products/${fileName}`;

        const encodedPath = filePath
          .split("/")
          .map((part) => encodeURIComponent(part))
          .join("/");

        // رفع الصورة باستخدام Service Role على السيرفر فقط
        const uploadResponse = await fetch(
          `${supabaseUrl}/storage/v1/object/${BUCKET_NAME}/${encodedPath}`,
          {
            method: "POST",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": contentType,
              "x-upsert": "false",
            },
            body: new Uint8Array(req.body),
          }
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();

          console.error(
            "[Storage] Supabase upload failed:",
            uploadResponse.status,
            errorText
          );

          res.status(502).json({
            error: "فشل رفع الصورة إلى Supabase Storage.",
          });
          return;
        }

        // إنشاء الرابط العام للصورة
        const publicUrl =
          `${supabaseUrl}/storage/v1/object/public/` +
          `${BUCKET_NAME}/${encodedPath}`;

        res.status(200).json({
          success: true,
          url: publicUrl,
          path: filePath,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error as Error & { status?: number }).status === 413
        ) {
          res.status(413).json({
            error: "حجم الصورة أكبر من 5 MB.",
          });
          return;
        }

        console.error(
          "[Storage] Upload route error:",
          error instanceof Error ? error.message : "Unknown error"
        );

        res.status(500).json({
          error: "حدث خطأ أثناء رفع الصورة.",
        });
      }
    }
  );
}
