# أداة متابعة أعمال مشاريع الأمانة — Web App

تطبيق متعدد المستأجرين (Multi-tenant) بواجهة عربية كاملة من اليمين لليسار، يحل محل ورقة Google Sheets الأصلية لمتابعة مشاريع الأمانة في المناطق الثلاث:

- 🏗️ **منطقة جازان** (JAZ)
- 🏗️ **المنطقة الشرقية** (EST)
- 🏗️ **الحدود الشمالية** (NOR)

## ✨ المميزات

- **مصادقة باسم مستخدم وكلمة مرور** (PBKDF2-SHA256) — يحددها مدير النظام من واجهة `/admin/users`
- **إجبار تغيير كلمة المرور** عند الدخول الأول أو بعد إعادة تعيينها من قِبل المدير
- **تعطيل/تفعيل الحسابات** دون الحاجة لحذفها
- **كل مستخدم يرى فقط بيانات منطقته** — Regional Access Control صارم على مستوى DB + API
- **لوحة تحكم ديناميكية** بمؤشرات KPI ورسوم بيانية تفاعلية (Recharts)
- **إدارة المهام** مع فلاتر متعددة، نسبة إنجاز قابلة للتعديل بـ slider، حساب تلقائي للأيام المتبقية
- **سجل المخاطر** مع حساب تلقائي لمستوى الخطر (الاحتمالية × التأثير) وتلوين حسب الشدة
- **التقارير الأسبوعية** لتتبع العوائق
- **صلاحيات صارمة على مستوى المنطقة** — مدير منطقة لا يستطيع رؤية أو تعديل بيانات منطقة أخرى (يعود 403 حتى لو حاول الوصول عبر API مباشرة)
- **يعمل على Edge** — Cloudflare Pages + D1 (SQLite)

## 🛠️ المنصة التقنية

| الطبقة | الأداة |
|--------|--------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Cloudflare Workers (عبر `@cloudflare/next-on-pages`) |
| قاعدة البيانات | Cloudflare D1 (SQLite) |
| المصادقة | Auth.js v5 (next-auth@beta) + Credentials provider |
| تشفير كلمات المرور | PBKDF2-SHA256 (100k iterations) عبر Web Crypto API |
| الرسوم البيانية | Recharts |
| الخط | Tajawal (Google Fonts) |

---

## 🚀 خطوات الإعداد المحلي

### 1) التبعيات

```bash
cd amanat-tracker
npm install
```

### 2) إنشاء قاعدة بيانات D1 محلية

```bash
npx wrangler d1 create projects-tracker
```

ضع `database_id` الذي يعيده الأمر في `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "projects-tracker"
database_id = "PUT_THE_RETURNED_UUID_HERE"
```

### 3) تنفيذ migration الأولي + seed البيانات

```bash
npm run db:init      # ينشئ كل الجداول + يحقن 42 مهمة + 30 خطر + 3 تقارير + 5 مستخدمين
```

> ✅ التحقق: `npx wrangler d1 execute projects-tracker --local --command "SELECT COUNT(*) FROM tasks"` يجب أن يعطي `42`.

### 4) متغيرات البيئة

انسخ `.env.example` إلى `.env.local` وعبئ القيم:

```bash
cp .env.example .env.local
```

```env
# المطلوب فقط — لا حاجة لأي مفاتيح OAuth
AUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
```

### 5) تشغيل خادم التطوير

```bash
npm run dev
```

افتح <http://localhost:3000>.

---

## 👥 المستخدمون المُسجَّلون مسبقاً (seed)

| اسم المستخدم | كلمة المرور | الدور | المنطقة |
|--------------|------------|------|---------|
| `admin` | `Amanat@2026` | admin | جميع المناطق |
| `jazan_manager` | `Amanat@2026` | regional_manager | جازان |
| `east_manager` | `Amanat@2026` | regional_manager | الشرقية |
| `shehab` | `Amanat@2026` | regional_manager | الشرقية |
| `north_manager` | `Amanat@2026` | regional_manager | الشمالية |

> 🔐 **هام جداً:** كل المستخدمين المحقونين كـ seed لديهم العَلم `must_change_password = 1`.
> عند أول تسجيل دخول، سيتم توجيه المستخدم تلقائياً إلى `/account/password` لتغيير كلمته
> قبل أن يستطيع الوصول لأي صفحة. **غيّر كلمة مرور حساب `admin` فوراً بعد النشر.**

### إضافة مستخدم جديد

#### الطريقة الموصى بها — من واجهة الأدمن

1. سجل دخول كـ `admin`
2. اذهب إلى `/admin/users`
3. اضغط **"+ إضافة مستخدم"**
4. عبّئ:
   - **اسم المستخدم** (3-32 حرف إنجليزي/أرقام/_.-)
   - **كلمة المرور الأولية** (8 أحرف على الأقل — سيُجبَر على تغييرها أول دخول)
   - الاسم الكامل، الإيميل (اختياري)، الدور، المنطقة
5. أبلغ المستخدم باسم الدخول والكلمة المؤقتة عبر قناة آمنة (واتساب/إيميل خاص)

#### إعادة تعيين كلمة مرور مستخدم

من جدول المستخدمين، اضغط أيقونة **🔑** بجانب المستخدم → أدخل كلمة جديدة → سيُجبر على تغييرها عند الدخول التالي.

#### تعطيل/تفعيل حساب

اضغط أيقونة **🛡️** بجانب المستخدم. الحساب المعطل لا يستطيع تسجيل الدخول لكن بياناته تبقى في النظام.

---

## ☁️ النشر على Cloudflare Pages

### 1) إنشاء قاعدة بيانات remote D1

```bash
npx wrangler d1 create projects-tracker
npm run db:init:remote
```

### 2) ربط مستودع GitHub بـ Cloudflare Pages

اذهب لـ Cloudflare Dashboard → Pages → Create application → Connect to Git.

**إعدادات البناء:**
- Build command: `npx @cloudflare/next-on-pages`
- Build output directory: `.vercel/output/static`
- Root directory: `amanat-tracker`

### 3) ضع متغيرات البيئة في Cloudflare Pages → Settings → Environment Variables

```
AUTH_SECRET   = generated_with_openssl_rand_base64_32
NEXTAUTH_URL  = https://your-domain.pages.dev
```

### 4) ربط D1 binding

في Cloudflare Pages → Settings → Functions → D1 database bindings:
- Variable name: `DB`
- D1 database: `projects-tracker`

### 5) Deploy

```bash
npm run pages:deploy
```

---

## 📥 استيراد بيانات إضافية من CSV

تم توفير سكربت لاستيراد بيانات من ملفات CSV ذات رؤوس عربية:

```bash
# ضع ملفاتك في data/ بنفس البنية (راجع data/tasks.csv)
npx tsx scripts/import-from-sheets.ts            # للقاعدة المحلية
npx tsx scripts/import-from-sheets.ts --remote   # للقاعدة في الإنتاج
```

---

## 🧪 معايير القبول (Acceptance Criteria)

اختبر هذه السيناريوهات بعد التشغيل:

✅ `east_manager / Amanat@2026` يدخل لأول مرة → يُعاد توجيهه إلى `/account/password` ويُلزَم بتغيير الكلمة
✅ بعد تغيير الكلمة، يرى **بيانات الشرقية فقط** (14 مهمة + 10 مخاطر)
✅ محاولة الوصول مباشرة لـ `GET /api/tasks?regionId=1` (جازان) تعيد 403
✅ `admin / Amanat@2026` يدخل ويرى **كل البيانات** (42 مهمة + 30 خطر + جدول إقليمي)
✅ المستخدم غير المسجّل دخوله يُعاد توجيهه إلى `/login`
✅ اسم مستخدم خاطئ أو كلمة مرور خاطئة → رسالة "اسم المستخدم أو كلمة المرور غير صحيحة"
✅ حساب معطّل (`is_active=0`) لا يستطيع تسجيل الدخول
✅ جميع النماذج تظهر رسائل خطأ عربية واضحة
✅ متوسط الإنجاز الإجمالي = 38.93% (مطابق لـ Excel الأصلي)
✅ تصنيف الأداء الكلي = "🔴 يحتاج تدخل" (مطابق لـ Excel)

---

## 📊 مرجع المعادلات (مأخوذة من Excel الأصلي)

| المعادلة | الكود |
|---------|-------|
| **تصنيف الأداء** | `≥90% ✅ ممتاز ⋅ ≥70% 🟢 جيد ⋅ ≥40% 🟡 متوسط ⋅ <40% 🔴 يحتاج تدخل` |
| **مستوى الخطر** | `probability × impact` |
| **بكتات الخطر** | `≥20 🔴 حرج ⋅ 13-19 🟠 عالٍ ⋅ 6-12 🟡 متوسط ⋅ 1-5 🟢 منخفض` |
| **الأيام المتبقية** | `deadline - today()` |
| **تصنيف الحالة** | `مكتمل→منجزة ⋅ days<0→متأخرة ⋅ days≤7→قريبة ⋅ else→ضمن الجدول` |

جميع المعادلات موجودة في `lib/formulas.ts` ومستخدمة في كل من lvy server و client.

---

## 📂 بنية المشروع

```
amanat-tracker/
├── app/
│   ├── api/                  # API routes (tasks, risks, weekly-reports, users, dashboard)
│   ├── (auth pages)/         # login, unauthorized
│   ├── dashboard/            # لوحة التحكم
│   ├── tasks/                # المهام
│   ├── risks/                # سجل المخاطر
│   ├── weekly-reports/       # التقارير الأسبوعية
│   ├── admin/users/          # إدارة المستخدمين (admin فقط)
│   └── admin/reference/      # البيانات المرجعية (admin فقط)
├── components/
│   ├── ui/                   # shadcn/ui (Button, Dialog, Input, Slider, …)
│   ├── layout/               # Sidebar, AppShell
│   ├── dashboard/            # KpiCard, Charts
│   ├── tasks/                # TaskTable, TaskModal
│   ├── risks/                # RiskTable, RiskModal
│   ├── weekly/               # WeeklyTable, WeeklyModal
│   └── admin/                # UsersTable
├── lib/
│   ├── auth.ts               # Auth.js config
│   ├── access.ts             # requireSession / requireAdmin / assertRegionAccess
│   ├── db.ts                 # D1 binding helper
│   ├── formulas.ts           # كل معادلات Excel (performance, riskBucket, …)
│   ├── types.ts              # TypeScript types
│   └── utils.ts              # helpers
├── migrations/
│   └── 0001_init.sql         # schema + 42 task + 30 risk + 3 weekly + 5 users seed
├── scripts/
│   └── import-from-sheets.ts # CSV → D1 importer
├── data/                     # نماذج CSV
├── middleware.ts             # حماية المسارات
├── wrangler.toml             # Cloudflare config + D1 binding
└── ...
```

---

## ⚠️ ملاحظات

- **الأداء على Edge**: كل الصفحات تستخدم `runtime = 'edge'` لتشغيلها على Cloudflare Workers ✓
- **حد بيانات D1**: D1 المجاني يدعم حتى 5 GB و 100M reads/يوم — أكثر من كافٍ
- **Auth.js v5 beta**: المكتبة لا تزال بيتا، تابع تحديثاتها من <https://authjs.dev>
- **RTL**: التطبيق بـ `dir="rtl"` افتراضياً، Tailwind يدعم RTL تلقائياً
- **تشفير كلمات المرور**: نستخدم PBKDF2-SHA256 بـ 100k iterations (راجع `lib/password.ts`). كلمات المرور **لا تُسجَّل في الـ logs** ولا تُرسَل للعميل أبداً (راجع `SAFE_USER_COLUMNS` في API)
- **جلسة Session**: مدتها 8 ساعات، تُحفظ كـ JWT signed بـ `AUTH_SECRET`

---

## 📜 الترخيص

ملكية فكرية لـ HLB IA / الأمانة. للاستخدام الداخلي فقط.
