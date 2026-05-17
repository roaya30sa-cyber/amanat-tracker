# 🚀 دليل النشر على Cloudflare Pages + D1

دليل شامل لنشر المشروع كاملاً على Cloudflare Pages. الوقت المتوقع: **15-20 دقيقة**.

---

## 📋 المتطلبات

قبل البدء تأكد من توفر:

| المتطلب | كيف تحصل عليه |
|---------|--------------|
| ✅ **Node.js 20+** | تحميل مجاني من <https://nodejs.org> |
| ✅ **حساب Cloudflare** | تسجيل مجاني في <https://dash.cloudflare.com/sign-up> |
| ✅ **متصفح** | لتأكيد wrangler login + إعدادات Pages |
| ✅ **PowerShell** (Windows) | متوفر افتراضياً |

> 💡 **تكلفة Cloudflare:** الخطة المجانية تكفي لهذا التطبيق. D1 يدعم 5 GB مجاناً + 5M reads/يوم + 100K writes/يوم.

---

## ⚡ الطريقة الأسرع: سكربت آلي (موصى به)

افتح PowerShell في مجلد `amanat-tracker` ونفذ:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

السكربت سيقوم تلقائياً بـ:
1. التحقق من المتطلبات
2. تثبيت الحزم (إذا لم تكن مثبتة)
3. فتح المتصفح لتسجيل الدخول إلى Cloudflare
4. إنشاء قاعدة بيانات D1
5. تحديث `wrangler.toml`
6. تنفيذ migration + حقن البيانات
7. توليد `AUTH_SECRET` عشوائي
8. بناء التطبيق
9. إنشاء مشروع Pages
10. نشر التطبيق
11. عرض الرابط النهائي + الخطوات اليدوية المتبقية

> 🔧 لتخصيص الأسماء:
> ```powershell
> .\deploy.ps1 -ProjectName "my-tracker" -DbName "my-db"
> ```

---

## 🧭 الطريقة اليدوية: خطوة بخطوة

إذا كنت تفضل التحكم الكامل في كل خطوة:

### الخطوة 1: تسجيل الدخول إلى Cloudflare

```powershell
cd amanat-tracker
npm install
npx wrangler login
```

> سيُفتح المتصفح. وافق على التفويض ثم عُد إلى Terminal. سترى: `Successfully logged in.`

### الخطوة 2: إنشاء قاعدة بيانات D1

```powershell
npx wrangler d1 create projects-tracker
```

ستحصل على output يشبه هذا:
```toml
[[d1_databases]]
binding = "DB"
database_name = "projects-tracker"
database_id = "abc123-def456-..."
```

**انسخ قيمة `database_id`** وضعها في `wrangler.toml` بدلاً من `REPLACE_WITH_YOUR_D1_DATABASE_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "projects-tracker"
database_id = "abc123-def456-..."  # ← الصق هنا
```

### الخطوة 3: تنفيذ migration على قاعدة البيانات

```powershell
npx wrangler d1 execute projects-tracker --remote --file=./migrations/0001_init.sql
```

سيقوم بإنشاء كل الجداول وحقن البيانات (42 مهمة + 30 خطر + 5 مستخدمين).

**التحقق:**
```powershell
npx wrangler d1 execute projects-tracker --remote --command "SELECT COUNT(*) FROM tasks"
```
يجب أن يعطي **42**.

### الخطوة 4: توليد AUTH_SECRET

في PowerShell:
```powershell
$secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
$secret
```

احفظ القيمة المعروضة — ستحتاجها في الخطوة 7.

### الخطوة 5: بناء التطبيق

```powershell
# أنشئ .env.local مؤقت للبناء
"AUTH_SECRET=$secret`nNEXTAUTH_URL=http://localhost:3000" | Out-File .env.local -Encoding utf8

# ابنِ التطبيق لـ Cloudflare Pages
npx @cloudflare/next-on-pages
```

سيُنشأ مجلد `.vercel/output/static/` يحتوي على ملفات البناء.

### الخطوة 6: إنشاء مشروع Pages + النشر الأول

```powershell
npx wrangler pages project create amanat-tracker --production-branch main
npx wrangler pages deploy .vercel/output/static --project-name amanat-tracker --commit-dirty=true
```

ستحصل على رابط مثل: `https://amanat-tracker-abc.pages.dev` ← **احفظه**.

### الخطوة 7: ربط D1 + إضافة متغيرات البيئة في Cloudflare Dashboard

⚠️ **هذه الخطوة يدوية ومهمة جداً** — بدونها التطبيق لن يعمل!

#### 7.أ - ربط قاعدة البيانات

1. اذهب إلى <https://dash.cloudflare.com>
2. Workers & Pages → اختر مشروعك (**amanat-tracker**)
3. **Settings** → **Functions** → **D1 database bindings** → **Add binding**
4. املأ:
   - **Variable name:** `DB`
   - **D1 database:** `projects-tracker`
5. **Save**

#### 7.ب - متغيرات البيئة

1. نفس الصفحة → **Settings** → **Environment Variables** → **Add variable**
2. أضف لكلٍ من Production و Preview:

| المتغير | القيمة |
|---------|--------|
| `AUTH_SECRET` | (الذي ولّدته في الخطوة 4) |
| `NEXTAUTH_URL` | `https://amanat-tracker-abc.pages.dev` (رابطك من الخطوة 6) |

3. اضغط **Save**

#### 7.ج - إعادة النشر

بعد إضافة المتغيرات، اذهب إلى **Deployments** → اضغط **Retry deployment** على آخر deployment.

أو من Terminal:
```powershell
npx wrangler pages deploy .vercel/output/static --project-name amanat-tracker --commit-dirty=true
```

### الخطوة 8: افتح التطبيق وسجل دخول

افتح الرابط في المتصفح وسجل دخول:

| الحقل | القيمة |
|------|--------|
| اسم المستخدم | `admin` |
| كلمة المرور | `Amanat@2026` |

⚠️ **مهم:** ستُلزم بتغيير كلمة المرور فوراً. اختر كلمة قوية.

---

## 🔄 إعادة النشر (بعد التعديلات)

```powershell
# 1. ابنِ الإصدار الجديد
npx @cloudflare/next-on-pages

# 2. انشر
npx wrangler pages deploy .vercel/output/static --project-name amanat-tracker --commit-dirty=true
```

أو أمر مختصر من `package.json`:
```powershell
npm run pages:deploy
```

---

## 🌐 إضافة Domain مخصص

1. Cloudflare Dashboard → Workers & Pages → **amanat-tracker** → **Custom domains**
2. **Set up a custom domain** → أدخل دومينك (مثل `tracker.iacct.sa`)
3. اتبع التعليمات لإضافة CNAME record
4. **حدّث `NEXTAUTH_URL`** في Environment Variables إلى الدومين الجديد
5. أعد النشر

---

## 🐛 استكشاف الأخطاء

### "D1 database binding 'DB' not found"
- لم تربط D1 بـ Pages project (راجع الخطوة 7.أ)
- بعد ربطها، أعد النشر

### "Configuration error" عند تسجيل الدخول
- `NEXTAUTH_URL` غير صحيح (يجب أن يطابق رابط النشر تماماً، بدون `/` في النهاية)
- `AUTH_SECRET` غير مضبوط

### "اسم المستخدم أو كلمة المرور غير صحيحة"
- تأكد من تنفيذ migration على **remote** (وليس local فقط)
- تحقق:
  ```powershell
  npx wrangler d1 execute projects-tracker --remote --command "SELECT username, role FROM users"
  ```
- يجب أن يعرض 5 مستخدمين

### الصفحات بطيئة جداً
- التشغيل الأول قد يكون بطيئاً (cold start). الطلبات اللاحقة < 100ms
- تحقق من تواجد D1 binding بشكل صحيح

### البناء يفشل بـ "Module not found"
- نظف وأعد البناء:
  ```powershell
  Remove-Item -Recurse -Force .next, .vercel, node_modules
  npm install
  npx @cloudflare/next-on-pages
  ```

---

## 📊 مراقبة الإنتاج

```powershell
# عرض اللوقز الحية
npx wrangler pages deployment tail --project-name amanat-tracker

# استعلام DB مباشر
npx wrangler d1 execute projects-tracker --remote --command "SELECT * FROM users"

# قائمة بكل النشرات السابقة
npx wrangler pages deployment list --project-name amanat-tracker

# عرض حجم استخدام D1
npx wrangler d1 info projects-tracker
```

---

## 💰 التكلفة المتوقعة

في الخطة المجانية:
- ✅ **Cloudflare Pages:** 500 build/شهر، unlimited requests، unlimited bandwidth
- ✅ **D1 Database:** 5 GB storage، 5M reads/يوم، 100K writes/يوم
- ✅ **Workers:** 100K requests/يوم

لـ ~50 مستخدم نشط، التطبيق سيبقى في الخطة المجانية بسهولة.

إذا تجاوزت الحدود (Workers Paid - $5/شهر) ستحصل على:
- 10M requests/يوم على Workers
- 25 GB storage على D1
- 25B reads/شهر + 50M writes/شهر

---

## ✅ قائمة التحقق النهائية

قبل تسليم النظام للمستخدمين:

- [ ] `wrangler.toml` يحتوي على database_id الصحيح
- [ ] D1 migration نُفّذ على **remote** وفيه 42 مهمة و 5 مستخدمين
- [ ] مشروع Pages أُنشئ بنجاح
- [ ] D1 binding مربوط بـ Pages (Variable: DB)
- [ ] `AUTH_SECRET` و `NEXTAUTH_URL` مضبوطان في Environment Variables
- [ ] أعدت النشر بعد إضافة المتغيرات
- [ ] دخلت بـ admin/Amanat@2026 وغيّرت كلمة المرور
- [ ] أضفت Custom domain (اختياري)
- [ ] أضفت مستخدمين حقيقيين من `/admin/users`
- [ ] أبلغت كل مستخدم باسمه وكلمة مروره المؤقتة

---

## 📞 إذا احتجت دعم

- وثائق Cloudflare Pages: <https://developers.cloudflare.com/pages>
- وثائق D1: <https://developers.cloudflare.com/d1>
- وثائق Auth.js: <https://authjs.dev>
- @cloudflare/next-on-pages: <https://github.com/cloudflare/next-on-pages>
