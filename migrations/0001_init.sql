-- =====================================================================
-- migrations/0001_init.sql
-- Schema + seed for أداة متابعة أعمال مشاريع الأمانة
-- Authentication: username + password (PBKDF2-SHA256, see lib/password.ts)
-- Default password for ALL seeded users: 'Amanat@2026'  ← MUST be changed at first login
-- =====================================================================

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS weekly_reports;
DROP TABLE IF EXISTS risks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS regions;

CREATE TABLE regions (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  color_hex TEXT
);
INSERT INTO regions (id,code,name_ar,color_hex) VALUES (1,'JAZ','منطقة جازان','#1F3864');
INSERT INTO regions (id,code,name_ar,color_hex) VALUES (2,'EST','المنطقة الشرقية','#2E8B8B');
INSERT INTO regions (id,code,name_ar,color_hex) VALUES (3,'NOR','الحدود الشمالية','#7D3C98');

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,            -- اسم المستخدم لتسجيل الدخول
  email TEXT UNIQUE,                         -- اختياري للتواصل / استرجاع كلمة المرور
  password_hash TEXT NOT NULL,              -- PBKDF2-SHA256, format: pbkdf2$iter$salt$hash
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','regional_manager','viewer')),
  region_id INTEGER REFERENCES regions(id),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);
CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
INSERT INTO users (id,username,email,password_hash,full_name,role,region_id,must_change_password,is_active,created_at) VALUES (1,'admin','roaya30.sa@gmail.com','pbkdf2$100000$aR2AFO8kb6WYI14dLmAFFg==$u+75kmmwhCgpPRfdoNhnq9M1vfpgtcokzlCD6WPVWeE=','مدير النظام','admin',NULL,1,1,strftime('%s','now')*1000);
INSERT INTO users (id,username,email,password_hash,full_name,role,region_id,must_change_password,is_active,created_at) VALUES (2,'jazan_manager','mohannedo@iacct.sa','pbkdf2$100000$AGtAxwmN/lSkVRPS4VV6Qw==$RS1JJ0IrEP0E4viOg6gYMMdZwEREMn8Bv2/0GhelPvY=','مهند - مدير منطقة جازان','regional_manager',1,1,1,strftime('%s','now')*1000);
INSERT INTO users (id,username,email,password_hash,full_name,role,region_id,must_change_password,is_active,created_at) VALUES (3,'east_manager','at@iacct.sa','pbkdf2$100000$H+a0Xh5DzrNYjjrG7IAnGg==$3VLoCSA88mJ+vbWCA5SEUqEF/8v3u+DdYFszPL3vWhM=','مدير المنطقة الشرقية','regional_manager',2,1,1,strftime('%s','now')*1000);
INSERT INTO users (id,username,email,password_hash,full_name,role,region_id,must_change_password,is_active,created_at) VALUES (4,'shehab','shehabalshawafi@gmail.com','pbkdf2$100000$Q0LeTNGGQn159FrbF/iFeQ==$b+2xVhIt47XaegbnHEMgaURZNvh5xO8VJt2DuUhrwHg=','شهاب الشوافي','regional_manager',2,1,1,strftime('%s','now')*1000);
INSERT INTO users (id,username,email,password_hash,full_name,role,region_id,must_change_password,is_active,created_at) VALUES (5,'north_manager','z.fatani@iacct.sa','pbkdf2$100000$TZfDYvv3hdCw8FOUdBm5Kg==$RdA02DH8IbmafbmXt33COfDZzhDWygz36dTTfpHi6bs=','الفتني - الحدود الشمالية','regional_manager',3,1,1,strftime('%s','now')*1000);

CREATE TABLE team_members (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  job_title TEXT,
  task_category TEXT
);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (1,'Ahmed Omar Barham','مدير مشروع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (2,'Abdulrahman Muhammad Zeila','مشرف مشروع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (3,'Ali Omar Mohammed Hamdi','مراجع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (4,'Ibrahim Hassan','مدقق',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (5,'Abdulrahman Hassan Harisi','محلل بيانات',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (6,'Amjad Reda Habib Al Madan','مراقب ميداني',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (7,'Nawaf Abdulaziz Almawlad','قائد حملات تواصل',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (8,'Mansour Nasser Al-Mutairi','مدير مشروع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (9,'Ali Aqil Al-Marhoun','مشرف مشروع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (10,'Issa Abdulrahman Alrashidi','مراجع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (11,'Imad Hamdi Attia','مدقق',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (12,'Riyad Mohammed Alyahya','محلل بيانات',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (13,'Tariq Ali Alenzi','مراقب ميداني',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (14,'Rawan Abdo Aqili','قائد حملات تواصل',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (15,'Zahraa Mahdi Al-Akhawah','مدير مشروع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (16,'Abdulaziz Awad Alanzi','مشرف مشروع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (17,'Khadijah Ahmed Al-Aman','مراجع',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (18,'Mohammed Hassan Al-Thunayan','مدقق',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (19,'Issa Abdo Ajibi','محلل بيانات',NULL);
INSERT INTO team_members (id,full_name,job_title,task_category) VALUES (20,'Ali Ibrahim Hakami','مراقب ميداني',NULL);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  task_name TEXT NOT NULL,
  phase TEXT,
  deadline TEXT,
  responsible_person TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed','in_progress','not_started')),
  priority TEXT CHECK (priority IN ('high','medium','low')),
  completion_percent INTEGER NOT NULL DEFAULT 0 CHECK (completion_percent BETWEEN 0 AND 100),
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX idx_tasks_region ON tasks(region_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'إعداد خطة المشروع التفصيلية','الأعمال الإدارية','2026-01-15','أحمد عمر برهام','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'تحديد الميزانية والموارد','الأعمال الإدارية','2026-01-15','عبدالرحمن محمد','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'إعداد هيكل فريق العمل','الأعمال الإدارية','2026-01-15','علي عمر محمد','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'توثيق إجراءات العمل','الأعمال الإدارية','2026-01-15','إبراهيم حسن','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'تصميم الهيكل التنظيمي','المراجعة والتقارير','2026-01-15','أحمد عمر برهام','completed','high',75,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'تطوير النماذج والإجراءات','المراجعة والتقارير','2026-01-15','عبدالرحمن حرسي','completed','high',10,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'مراجعة المتطلبات القانونية','المراجعة والتقارير','2026-01-15','منصور المطيري','completed','high',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'إعداد تقارير الأداء الشهرية','المراجعة والتقارير','2026-01-15','رياض يحيى','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'جدولة الزيارات الميدانية الأولى','الزيارات الميدانية','2026-01-15','طارق العنزي','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'إعداد تقارير الزيارات الميدانية','الزيارات الميدانية','2026-01-15','نواف عبدالعزيز','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'تقييم نتائج الزيارات','الزيارات الميدانية','2026-01-15','عيسى عبدالرحمن','in_progress','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'تصميم مواد التوعية والتواصل','الزيارات الميدانية','2026-01-15','رواب عبده','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'تنفيذ جلسات نقل المعرفة','حملات التواصل ونقل المعرفة','2026-01-15','زهراء مهدي','in_progress','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (1,'ت','الأعمال الإدارية','2026-06-06','س','in_progress','high',60,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'إعداد خطة المشروع التفصيلية','الأعمال الإدارية','2026-01-15','أحمد عمر برهام','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'تحديد الميزانية والموارد','الأعمال الإدارية','2026-01-15','عبدالرحمن محمد','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'إعداد هيكل فريق العمل','الأعمال الإدارية','2026-01-15','علي عمر محمد','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'توثيق إجراءات العمل','الأعمال الإدارية','2026-01-15','إبراهيم حسن','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'تصميم الهيكل التنظيمي','المراجعة والتقارير','2026-01-15','أحمد عمر برهام','completed','high',75,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'تطوير النماذج والإجراءات','المراجعة والتقارير','2026-01-15','عبدالرحمن حرسي','completed','high',10,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'مراجعة المتطلبات القانونية','المراجعة والتقارير','2026-01-15','منصور المطيري','completed','high',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'إعداد تقارير الأداء الشهرية','المراجعة والتقارير','2026-01-15','رياض يحيى','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'جدولة الزيارات الميدانية الأولى','الزيارات الميدانية','2026-01-15','طارق العنزي','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'إعداد تقارير الزيارات الميدانية','الزيارات الميدانية','2026-01-15','نواف عبدالعزيز','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'تقييم نتائج الزيارات','الزيارات الميدانية','2026-01-15','عيسى عبدالرحمن','in_progress','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'تصميم مواد التوعية والتواصل','الزيارات الميدانية','2026-01-15','رواب عبده','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'تنفيذ جلسات نقل المعرفة','حملات التواصل ونقل المعرفة','2026-01-15','زهراء مهدي','in_progress','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (2,'ت','الأعمال الإدارية','2026-06-06','س','in_progress','high',60,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'إعداد خطة المشروع التفصيلية','الأعمال الإدارية','2026-01-15','أحمد عمر برهام','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'تحديد الميزانية والموارد','الأعمال الإدارية','2026-01-15','عبدالرحمن محمد','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'إعداد هيكل فريق العمل','الأعمال الإدارية','2026-01-15','علي عمر محمد','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'توثيق إجراءات العمل','الأعمال الإدارية','2026-01-15','إبراهيم حسن','completed','high',100,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'تصميم الهيكل التنظيمي','المراجعة والتقارير','2026-01-15','أحمد عمر برهام','completed','high',75,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'تطوير النماذج والإجراءات','المراجعة والتقارير','2026-01-15','عبدالرحمن حرسي','completed','high',10,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'مراجعة المتطلبات القانونية','المراجعة والتقارير','2026-01-15','منصور المطيري','completed','high',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'إعداد تقارير الأداء الشهرية','المراجعة والتقارير','2026-01-15','رياض يحيى','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'جدولة الزيارات الميدانية الأولى','الزيارات الميدانية','2026-01-15','طارق العنزي','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'إعداد تقارير الزيارات الميدانية','الزيارات الميدانية','2026-01-15','نواف عبدالعزيز','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'تقييم نتائج الزيارات','الزيارات الميدانية','2026-01-15','عيسى عبدالرحمن','in_progress','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'تصميم مواد التوعية والتواصل','الزيارات الميدانية','2026-01-15','رواب عبده','not_started','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'تنفيذ جلسات نقل المعرفة','حملات التواصل ونقل المعرفة','2026-01-15','زهراء مهدي','in_progress','medium',0,NULL);
INSERT INTO tasks (region_id,task_name,phase,deadline,responsible_person,status,priority,completion_percent,notes) VALUES (3,'ت','الأعمال الإدارية','2026-06-06','س','in_progress','high',60,NULL);

CREATE TABLE risks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  risk_description TEXT NOT NULL,
  affected_project TEXT,
  category TEXT,
  probability INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  risk_level INTEGER GENERATED ALWAYS AS (probability * impact) STORED,
  response_plan TEXT,
  owner TEXT,
  status TEXT CHECK (status IN ('open','in_progress','controlled')) DEFAULT 'open',
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX idx_risks_region ON risks(region_id);
CREATE INDEX idx_risks_level ON risks(risk_level);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'تأخر الموافقات الحكومية والتراخيص','منطقة جازان','إداري/قانوني',2,5,'مراسلة رسمية مستعجلة وتفعيل قناة التصعيد مع الإدارة العليا','مدير المشروع','open','متكرر في مشاريع المنطقة');
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'نقص الكوادر التقنية المؤهلة','المنطقة الشرقية','موارد بشرية',3,4,'إعارة مهندسين من مشاريع أخرى + إطلاق إجراء التوظيف الطارئ','مدير الموارد البشرية','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'صعوبة الوصول الميداني - ظروف مناخية','الحدود الشمالية','بيئي/لوجستي',4,3,'جدولة بديلة للزيارات + تجهيز عتاد ميداني مناسب','قائد الفريق الميداني','in_progress','موسمي: أكتوبر/فبراير');
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'تجاوز الميزانية المخصصة للمشروع','الثلاثة مشاريع','مالي',3,5,'مراجعة بنود الإنفاق شهرياً + احتياطي 10% من الميزانية','المدير المالي','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'تأخر توريد المواد والمعدات','منطقة جازان','لوجستي',3,4,'تنويع قائمة الموردين + عقود إطار مسبقة','مدير المشتريات','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'تغيير في نطاق العمل (Scope Creep)','المنطقة الشرقية','إدارة مشاريع',2,4,'توثيق صارم لطلبات التغيير + لجنة مراجعة التغييرات','مكتب إدارة المشاريع','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'ضعف التنسيق بين الفرق الميدانية','الحدود الشمالية','تشغيلي',2,3,'اجتماعات تنسيق أسبوعية + منصة تواصل موحدة','مشرف التنسيق','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'فقدان بيانات التقارير وعدم توثيقها','الثلاثة مشاريع','تقني',2,4,'نسخ احتياطية يومية + نظام إدارة وثائق مركزي','مدير تقنية المعلومات','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'معارضة أصحاب المصلحة المحليين','الحدود الشمالية','مجتمعي',2,3,'خطة تواصل استباقية + جلسات إشراك المجتمع','مدير شؤون المجتمع','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (1,'تضارب الأولويات بين المشاريع','الثلاثة مشاريع','إدارة مشاريع',3,3,'لجنة توجيهية مشتركة + نظام تحديد الأولويات الموحد','البرنامج/PMO','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'تأخر الموافقات الحكومية والتراخيص','منطقة جازان','إداري/قانوني',2,5,'مراسلة رسمية مستعجلة وتفعيل قناة التصعيد مع الإدارة العليا','مدير المشروع','open','متكرر في مشاريع المنطقة');
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'نقص الكوادر التقنية المؤهلة','المنطقة الشرقية','موارد بشرية',3,4,'إعارة مهندسين من مشاريع أخرى + إطلاق إجراء التوظيف الطارئ','مدير الموارد البشرية','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'صعوبة الوصول الميداني - ظروف مناخية','الحدود الشمالية','بيئي/لوجستي',4,3,'جدولة بديلة للزيارات + تجهيز عتاد ميداني مناسب','قائد الفريق الميداني','in_progress','موسمي: أكتوبر/فبراير');
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'تجاوز الميزانية المخصصة للمشروع','الثلاثة مشاريع','مالي',3,5,'مراجعة بنود الإنفاق شهرياً + احتياطي 10% من الميزانية','المدير المالي','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'تأخر توريد المواد والمعدات','منطقة جازان','لوجستي',3,4,'تنويع قائمة الموردين + عقود إطار مسبقة','مدير المشتريات','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'تغيير في نطاق العمل (Scope Creep)','المنطقة الشرقية','إدارة مشاريع',2,4,'توثيق صارم لطلبات التغيير + لجنة مراجعة التغييرات','مكتب إدارة المشاريع','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'ضعف التنسيق بين الفرق الميدانية','الحدود الشمالية','تشغيلي',2,3,'اجتماعات تنسيق أسبوعية + منصة تواصل موحدة','مشرف التنسيق','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'فقدان بيانات التقارير وعدم توثيقها','الثلاثة مشاريع','تقني',2,4,'نسخ احتياطية يومية + نظام إدارة وثائق مركزي','مدير تقنية المعلومات','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'معارضة أصحاب المصلحة المحليين','الحدود الشمالية','مجتمعي',2,3,'خطة تواصل استباقية + جلسات إشراك المجتمع','مدير شؤون المجتمع','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (2,'تضارب الأولويات بين المشاريع','الثلاثة مشاريع','إدارة مشاريع',3,3,'لجنة توجيهية مشتركة + نظام تحديد الأولويات الموحد','البرنامج/PMO','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'تأخر الموافقات الحكومية والتراخيص','منطقة جازان','إداري/قانوني',2,5,'مراسلة رسمية مستعجلة وتفعيل قناة التصعيد مع الإدارة العليا','مدير المشروع','open','متكرر في مشاريع المنطقة');
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'نقص الكوادر التقنية المؤهلة','المنطقة الشرقية','موارد بشرية',3,4,'إعارة مهندسين من مشاريع أخرى + إطلاق إجراء التوظيف الطارئ','مدير الموارد البشرية','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'صعوبة الوصول الميداني - ظروف مناخية','الحدود الشمالية','بيئي/لوجستي',4,3,'جدولة بديلة للزيارات + تجهيز عتاد ميداني مناسب','قائد الفريق الميداني','in_progress','موسمي: أكتوبر/فبراير');
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'تجاوز الميزانية المخصصة للمشروع','الثلاثة مشاريع','مالي',3,5,'مراجعة بنود الإنفاق شهرياً + احتياطي 10% من الميزانية','المدير المالي','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'تأخر توريد المواد والمعدات','منطقة جازان','لوجستي',3,4,'تنويع قائمة الموردين + عقود إطار مسبقة','مدير المشتريات','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'تغيير في نطاق العمل (Scope Creep)','المنطقة الشرقية','إدارة مشاريع',2,4,'توثيق صارم لطلبات التغيير + لجنة مراجعة التغييرات','مكتب إدارة المشاريع','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'ضعف التنسيق بين الفرق الميدانية','الحدود الشمالية','تشغيلي',2,3,'اجتماعات تنسيق أسبوعية + منصة تواصل موحدة','مشرف التنسيق','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'فقدان بيانات التقارير وعدم توثيقها','الثلاثة مشاريع','تقني',2,4,'نسخ احتياطية يومية + نظام إدارة وثائق مركزي','مدير تقنية المعلومات','controlled',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'معارضة أصحاب المصلحة المحليين','الحدود الشمالية','مجتمعي',2,3,'خطة تواصل استباقية + جلسات إشراك المجتمع','مدير شؤون المجتمع','in_progress',NULL);
INSERT INTO risks (region_id,risk_description,affected_project,category,probability,impact,response_plan,owner,status,notes) VALUES (3,'تضارب الأولويات بين المشاريع','الثلاثة مشاريع','إدارة مشاريع',3,3,'لجنة توجيهية مشتركة + نظام تحديد الأولويات الموحد','البرنامج/PMO','in_progress',NULL);

CREATE TABLE weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL REFERENCES regions(id),
  report_date TEXT NOT NULL,
  current_task TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('high','medium','low')),
  obstacles TEXT,
  solution_plan TEXT,
  required_resources TEXT,
  follow_up_date TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX idx_weekly_region ON weekly_reports(region_id);
CREATE INDEX idx_weekly_date ON weekly_reports(report_date);
INSERT INTO weekly_reports (region_id,report_date,current_task,priority,obstacles,solution_plan,required_resources,follow_up_date) VALUES (1,'2025-03-07','تأخر توقيع المستخلص','high','تأخر الموافقات من الجهة المرجعية','مراسلة رسمية مستعجلة + تفعيل قناة التصعيد','صلاحيات تصعيد إدارية','2025-03-10');
INSERT INTO weekly_reports (region_id,report_date,current_task,priority,obstacles,solution_plan,required_resources,follow_up_date) VALUES (2,'2025-03-07','تطوير منظومة الاتصالات الداخلية','low','نقص الكوادر التقنية - تعارض جداول زمنية','التنسيق مع الموارد البشرية لإعارة مهندس','مهندس تقني (دوام جزئي) - ترخيص برنامج إضافي','2025-03-12');
INSERT INTO weekly_reports (region_id,report_date,current_task,priority,obstacles,solution_plan,required_resources,follow_up_date) VALUES (3,'2025-03-07','تقييم البنية التحتية المتاحة','medium','صعوبة وصول ميداني (ظروف مناخية) - محدودية لوجستية','جدولة زيارات بديلة + التنسيق مع قيادة المنطقة','سيارات دفع رباعي - ترتيبات إقامة ميدانية','2025-03-15');
