# 🚀 بدء سريع — أداة متابعة أعمال مشاريع الأمانة

## الطريقة الأسرع (Windows PowerShell)

افتح PowerShell في هذا المجلد ونفذ:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
npm run dev
```

افتح <http://localhost:3000>

## الطريقة اليدوية (3 خطوات)

```bash
# 1) ثبّت الحزم
npm install

# 2) أنشئ قاعدة بيانات D1 وحدّث wrangler.toml بـ database_id الذي يعود لك
npx wrangler d1 create projects-tracker
# ← انسخ database_id من المخرجات وضعه في wrangler.toml بدل REPLACE_WITH_YOUR_D1_DATABASE_ID

# 3) نفّذ migration + seed
npm run db:init

# 4) أنشئ .env.local (إذا لم يكن موجوداً)
echo "AUTH_SECRET=$(openssl rand -base64 32)" > .env.local
echo "NEXTAUTH_URL=http://localhost:3000" >> .env.local

# 5) شغّل
npm run dev
```

## 🔑 حسابات تجريبية محقونة

| اسم المستخدم | كلمة المرور | الدور | المنطقة |
|--------------|------------|------|---------|
| `admin` | `Amanat@2026` | مدير النظام | جميع المناطق |
| `jazan_manager` | `Amanat@2026` | مدير منطقة | جازان |
| `east_manager` | `Amanat@2026` | مدير منطقة | الشرقية |
| `shehab` | `Amanat@2026` | مدير منطقة | الشرقية |
| `north_manager` | `Amanat@2026` | مدير منطقة | الحدود الشمالية |

⚠️ ستُلزم بتغيير كلمة المرور عند أول دخول.

## النشر على Cloudflare

```bash
# قاعدة بيانات الإنتاج
npm run db:init:remote

# نشر
npm run pages:deploy
```

تفاصيل أكثر: راجع [`README.md`](./README.md).

## أو جرّب النسخة المحلية بدون تثبيت

افتح ملف `../demo.html` مباشرة في المتصفح — تطبيق كامل بكل الميزات ونفس نظام username/password (PBKDF2)، البيانات تُحفظ في localStorage.
