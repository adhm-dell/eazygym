"use client";

import React, { useState } from "react";
import {
  Button,
  Badge,
  Chip,
  Card,
  Input,
  Select,
  Combobox,
  Money,
  MoneyInput,
  StatusBadge,
  StatCard,
  DataTable,
  Dialog,
  Sheet,
  ConfirmDialog,
  FullScreenResult,
  DateRange,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ThemeToggle,
  LanguageToggle,
  useToast,
  type ColumnDef,
} from "@gym/ui";
import Link from "next/link";
import {
  MOCK_MEMBERS,
  MOCK_PLANS,
  MOCK_SUBSCRIPTIONS,
  type Member,
} from "@gym/mock-data";
import { getDictionary, type Locale } from "@gym/i18n";
import {
  Users,
  CreditCard,
  AlertCircle,
  PauseCircle,
  Search,
  Bell,
  ScanLine,
} from "lucide-react";

export default function DesignSystemPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const dict = getDictionary(locale);
  const toast = useToast();

  // Component test states
  const [moneyValue, setMoneyValue] = useState<number>(125000); // 1,250.00 EGP in piasters
  const [comboboxValue, setComboboxValue] = useState<string>("mem_01");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmResult, setConfirmResult] = useState<string | null>(null);

  // Full screen result modal test states
  const [fullScreenResult, setFullScreenResult] = useState<{
    isOpen: boolean;
    type: "success" | "warning" | "danger";
    title: string;
    subtitle: string;
    reason?: string;
    memberName: string;
    memberCode: string;
    planName: string;
  } | null>(null);

  // Data table state toggles
  const [tableState, setTableState] = useState<"normal" | "loading" | "error" | "empty">("normal");

  // Combobox options
  const memberOptions = MOCK_MEMBERS.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.code})`,
    description: m.phone,
  }));

  // Table columns definition
  const columns: ColumnDef<Member>[] = [
    {
      accessorKey: "code",
      header: locale === "ar" ? "الكود" : "Code",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-xs bg-muted px-2 py-0.5 rounded">
          {row.original.code}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: locale === "ar" ? "العضو" : "Member",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.phone}</p>
        </div>
      ),
    },
    {
      id: "plan",
      header: locale === "ar" ? "الخطة والاشتراك" : "Plan",
      cell: ({ row }) => {
        const sub = MOCK_SUBSCRIPTIONS.find((s) => s.memberId === row.original.id);
        const plan = sub ? MOCK_PLANS.find((p) => p.id === sub.planId) : null;
        return (
          <span className="text-xs">
            {plan ? plan.name : locale === "ar" ? "بدون اشتراك" : "No Plan"}
          </span>
        );
      },
    },
    {
      id: "status",
      header: locale === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => {
        if (row.original.isBlocked) {
          return <StatusBadge status="BLOCKED" locale={locale} size="sm" />;
        }
        const sub = MOCK_SUBSCRIPTIONS.find((s) => s.memberId === row.original.id);
        if (!sub) {
          return <StatusBadge status="NO_SUBSCRIPTION" locale={locale} size="sm" />;
        }
        return <StatusBadge status={sub.status} locale={locale} size="sm" />;
      },
    },
    {
      id: "actions",
      header: locale === "ar" ? "الإجراء" : "Action",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            toast.info(
              locale === "ar"
                ? `تم اختيار العضو: ${row.original.name}`
                : `Selected member: ${row.original.name}`
            );
          }}
        >
          {locale === "ar" ? "عرض" : "View"}
        </Button>
      ),
    },
  ];

  const handleLanguageChange = (nextLang: Locale) => {
    setLocale(nextLang);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top sticky bar with toggles */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="text-start">
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary inline-block" />
              {dict.design.title}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{dict.design.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggle currentLang={locale} onLanguageChange={handleLanguageChange} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-12">
        {/* 0. EazyGym Reference Mockups & Core Tokens Showcase */}
        <section className="bg-white border border-[#E1E5DF] rounded-[18px] p-6 shadow-sm space-y-6 text-start">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E1E5DF]">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#C6F24E]" />
                <h2 className="text-xl font-bold text-[#14181F]">
                  شاشات ومكونات الهوية المعتمدة (EazyGym Mockup UI)
                </h2>
              </div>
              <p className="text-xs text-[#5B6470] mt-1">
                تطابق تام ومحكم مع ملفات الـ Mockup المرفقة بالقيم والألوان والخط (IBM Plex Sans Arabic)
              </p>
            </div>
            <Chip>
              <span>EazyGym · التصميم المعتمد</span>
            </Chip>
          </div>

          {/* Quick links to implemented reference screens */}
          <div>
            <h3 className="text-xs font-bold text-[#5B6470] uppercase tracking-wider mb-3">
              استعراض الشاشات المنفذة طبق الأصل:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/" className="no-underline">
                <div className="p-4 rounded-[12px] border border-[#E1E5DF] bg-[#F2F4F1] hover:border-[#14181F] transition-all flex flex-col gap-1">
                  <b className="text-[15px] text-[#14181F]">1. مسح الدخول (الريسبشن)</b>
                  <span className="text-xs text-[#5B6470]">3 أعمدة: سايدبار + نتيجة الفحص + حصص اليوم</span>
                </div>
              </Link>
              <Link href="/pos" className="no-underline">
                <div className="p-4 rounded-[12px] border border-[#E1E5DF] bg-[#F2F4F1] hover:border-[#14181F] transition-all flex flex-col gap-1">
                  <b className="text-[15px] text-[#14181F]">2. نقطة البيع (الكاشير والبار)</b>
                  <span className="text-xs text-[#5B6470]">شبكة منتجات 4 أعمدة + سلة الفاتورة والخصم</span>
                </div>
              </Link>
              <Link href="/admin" className="no-underline">
                <div className="p-4 rounded-[12px] border border-[#E1E5DF] bg-[#F2F4F1] hover:border-[#14181F] transition-all flex flex-col gap-1">
                  <b className="text-[15px] text-[#14181F]">3. لوحة التحكم (الأدمن)</b>
                  <span className="text-xs text-[#5B6470]">بطاقات الإحصاءات + إغلاق الورديات + العمولات</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Core Tokens & Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[#E1E5DF]">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#5B6470] uppercase tracking-wider">
                الأزرار الأساسية (Buttons)
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default">.btn (الافتراضي الداكن)</Button>
                <Button variant="lime">.btn.l (الزر الليموني المميز)</Button>
                <Button variant="outline">زر محدد (Outline)</Button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#5B6470] uppercase tracking-wider">
                الشارات المعتمدة (Pill Badges & Chips)
              </h3>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="g">ACTIVE (.g)</Badge>
                <Badge variant="w">ينتهي قريباً (.w)</Badge>
                <Badge variant="r">الاشتراك منتهي (.r)</Badge>
                <Badge variant="lime">50% عمولة</Badge>
                <Chip>وردية سارة مفتوحة منذ 09:00</Chip>
              </div>
            </div>
          </div>
        </section>

        {/* 1. Stat Cards */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {dict.design.statCards}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={locale === "ar" ? "إجمالي الأعضاء النشطين" : "Active Members"}
              value="1,420"
              icon={<Users className="h-5 w-5" />}
              trend={{ value: "12%+", positive: true, label: "مقارنة بالشهر الماضي" }}
              subtitle={locale === "ar" ? "اشتراكات جارية" : "Current memberships"}
            />
            <StatCard
              title={locale === "ar" ? "إيراد اليوم (الخزينة)" : "Today's Cash Revenue"}
              value={<Money amount={850000} locale={locale} />}
              icon={<CreditCard className="h-5 w-5" />}
              trend={{ value: "8%+", positive: true }}
              subtitle={locale === "ar" ? "شفت الصباح مفتوح" : "Morning shift open"}
            />
            <StatCard
              title={locale === "ar" ? "ينتهي اشتراكهم قريباً" : "Expiring in 3 Days"}
              value="28"
              icon={<AlertCircle className="h-5 w-5" />}
              trend={{ value: "5-", positive: false }}
              subtitle={locale === "ar" ? "يحتاجون تذكير واتساب" : "Need WhatsApp reminder"}
            />
            <StatCard
              title={locale === "ar" ? "الاشتراكات المجمّدة" : "Frozen Subscriptions"}
              value="14"
              icon={<PauseCircle className="h-5 w-5" />}
              subtitle={locale === "ar" ? "إيقاف مؤقت للوقت" : "Time paused"}
            />
          </div>
        </section>

        {/* 2. Buttons */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold">{dict.design.buttons}</h2>
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="default">Primary Default</Button>
              <Button variant="lime">Lime Accent (.btn.l)</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="success">Success Action</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link Style</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
              <Button size="sm">Small (sm)</Button>
              <Button size="md">Medium (md)</Button>
              <Button size="lg">Large (lg)</Button>
              <Button size="icon">
                <Bell className="h-4 w-4" />
              </Button>
              <Button isLoading>جاري المعالجة</Button>
              <Button disabled>معطل (Disabled)</Button>
            </div>
          </div>
        </section>

        {/* 3. Inputs & Selects & Combobox */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold">{dict.design.inputs}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-lg border border-border bg-card p-6">
            <Input
              label={locale === "ar" ? "اسم العضو" : "Member Name"}
              placeholder={locale === "ar" ? "أدخل الاسم الثلاثي..." : "Enter full name..."}
              helperText={locale === "ar" ? "كما هو مدون بالبطاقة القومية" : "As written on ID"}
            />
            <Input
              label={locale === "ar" ? "بحث برقم الهاتف أو الكود" : "Search by Phone / Code"}
              placeholder="010..."
              startIcon={<Search className="h-4 w-4" />}
            />
            <Input
              label={locale === "ar" ? "حقل مع رسالة خطأ" : "Input with Error"}
              value="invalid_data"
              readOnly
              error={locale === "ar" ? "البيانات المدخلة غير صحيحة" : "Invalid input data"}
            />
            <Select
              label={locale === "ar" ? "طريقة السداد" : "Payment Method"}
              options={[
                { value: "CASH", label: locale === "ar" ? "نقداً (كاش)" : "Cash" },
                { value: "INSTAPAY", label: locale === "ar" ? "إنستاباي (InstaPay)" : "InstaPay" },
                { value: "CARD", label: locale === "ar" ? "بطاقة دفع / فيزا (Card)" : "Card" },
                { value: "WALLET", label: locale === "ar" ? "خصم من المحفظة (Wallet)" : "Wallet" },
              ]}
            />
            <Combobox
              label={locale === "ar" ? "اختيار عضو (بحث وتصفية)" : "Select Member (Combobox)"}
              options={memberOptions}
              value={comboboxValue}
              onChange={setComboboxValue}
              placeholder={locale === "ar" ? "ابحث بالاسم أو الكود..." : "Search member..."}
            />
            <DateRange
              label={locale === "ar" ? "نطاق التاريخ (Date Range)" : "Date Range"}
            />
          </div>
        </section>

        {/* 4. Money Display & Input */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold">{dict.design.money}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-lg border border-border bg-card p-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {locale === "ar" ? "عروض مبالغ نقدية (صيغ مختلفة بالمليم/القرش)" : "Money Formatted Displays"}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-lg">
                <Money amount={240000} locale={locale} />
                <Money amount={150050} locale={locale} showSign />
                <Money amount={-45000} locale={locale} />
                <Money amount={0} locale={locale} />
              </div>
              <p className="text-xs text-muted-foreground">
                المبالغ تُحسب داخلياً بالقروش كأعداد صحيحة تامة (Integer Piasters) بدون أي كسور عشرية للتقريب المالي.
              </p>
            </div>

            <div className="space-y-3">
              <MoneyInput
                label={locale === "ar" ? "حقل إدخال نقدي (MoneyInput)" : "Money Input"}
                value={moneyValue}
                onChange={setMoneyValue}
                helperText={
                  locale === "ar"
                    ? `القيمة المخزنة بالقروش: ${moneyValue} قرش`
                    : `Stored value in piasters: ${moneyValue}`
                }
              />
            </div>
          </div>
        </section>

        {/* 5. Status Badges & Access Reasons */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold">{dict.design.badges}</h2>
          <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                {locale === "ar" ? "حالات الاشتراكات (Subscription Statuses)" : "Subscription Statuses"}
              </h4>
              <div className="flex flex-wrap gap-2.5">
                <StatusBadge status="ACTIVE" locale={locale} />
                <StatusBadge status="EXPIRING_SOON" locale={locale} />
                <StatusBadge status="EXPIRED" locale={locale} />
                <StatusBadge status="FROZEN" locale={locale} />
                <StatusBadge status="SUSPENDED_UNPAID" locale={locale} />
                <StatusBadge status="PENDING_PAYMENT" locale={locale} />
                <StatusBadge status="CANCELLED" locale={locale} />
                <StatusBadge status="BLOCKED" locale={locale} />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                {locale === "ar" ? "أسباب قرارات الدخول (Access Decision Reasons)" : "Access Reasons"}
              </h4>
              <div className="flex flex-wrap gap-2.5">
                <StatusBadge status="NO_SUBSCRIPTION" locale={locale} />
                <StatusBadge status="NO_SESSIONS_LEFT" locale={locale} />
                <StatusBadge status="CLASS_OUT_OF_TIME" locale={locale} />
                <StatusBadge status="CLASS_CANCELLED" locale={locale} />
                <StatusBadge status="CLASS_NOT_STARTED" locale={locale} />
                <StatusBadge status="OPEN" locale={locale} />
                <StatusBadge status="CLOSED" locale={locale} />
                <StatusBadge status="PAID" locale={locale} />
                <StatusBadge status="VOID" locale={locale} />
              </div>
            </div>
          </div>
        </section>

        {/* 6. DataTable with 12 Members */}
        <section className="space-y-4 text-start">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{dict.design.table}</h2>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground me-1">{locale === "ar" ? "حالة الجدول:" : "Table State:"}</span>
              <Button
                size="sm"
                variant={tableState === "normal" ? "default" : "outline"}
                onClick={() => setTableState("normal")}
              >
                عادي
              </Button>
              <Button
                size="sm"
                variant={tableState === "loading" ? "default" : "outline"}
                onClick={() => setTableState("loading")}
              >
                تحميل
              </Button>
              <Button
                size="sm"
                variant={tableState === "error" ? "default" : "outline"}
                onClick={() => setTableState("error")}
              >
                خطأ
              </Button>
              <Button
                size="sm"
                variant={tableState === "empty" ? "default" : "outline"}
                onClick={() => setTableState("empty")}
              >
                فارغ
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={tableState === "empty" ? [] : MOCK_MEMBERS}
            isLoading={tableState === "loading"}
            error={tableState === "error" ? (locale === "ar" ? "تعذر جلب بيانات المشتركين" : "Failed to load members") : null}
            onRetry={() => setTableState("normal")}
            pageSize={6}
          />
        </section>

        {/* 7. Dialogs, Sheet & Confirm with Reason */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold">{dict.design.dialogs}</h2>
          <div className="rounded-lg border border-border bg-card p-6 flex flex-wrap items-center gap-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
              فتح نافذة منبثقة (Dialog)
            </Button>
            <Button variant="outline" onClick={() => setIsSheetOpen(true)}>
              فتح لوحة جانبية (Sheet Drawer)
            </Button>
            <Button variant="destructive" onClick={() => setIsConfirmOpen(true)}>
              تأكيد إجراء حساس مع ذكر السبب (ConfirmDialog)
            </Button>

            {confirmResult && (
              <span className="text-xs bg-success/10 text-success border border-success/30 px-3 py-1.5 rounded-md font-medium">
                {locale === "ar" ? `تم التأكيد بالسبب: "${confirmResult}"` : `Confirmed with: "${confirmResult}"`}
              </span>
            )}
          </div>
        </section>

        {/* 8. Toasts Triggers */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold">رسائل التنبيه العائمة (Toasts)</h2>
          <div className="rounded-lg border border-border bg-card p-6 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="text-success border-success/30 hover:bg-success/10"
              onClick={() => toast.success("تم تجديد الاشتراك بنجاح وسداد الرسوم كاش", "عملية ناجحة")}
            >
              إشعار نجاح (Success)
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => toast.error("فشل تسجيل الدخول: رصيد متأخر على العضو", "تنبيه منع الدخول")}
            >
              إشعار خطأ (Error)
            </Button>
            <Button
              variant="outline"
              className="text-warning border-warning/30 hover:bg-warning/10"
              onClick={() => toast.warning("متبقي 3 أيام فقط على انتهاء اشتراك العضو", "تحذير")}
            >
              إشعار تحذير (Warning)
            </Button>
            <Button
              variant="outline"
              className="text-info border-info/30 hover:bg-info/10"
              onClick={() => toast.info("تم بدء شفت الاستقبال الصباحي بنجاح", "معلومة")}
            >
              إشعار معلومات (Info)
            </Button>
          </div>
        </section>

        {/* 9. Full Screen Turnstile/Scan Result Modals */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            {dict.design.fullScreen}
          </h2>
          <div className="rounded-lg border border-border bg-card p-6 flex flex-wrap items-center gap-3">
            <Button
              variant="success"
              onClick={() =>
                setFullScreenResult({
                  isOpen: true,
                  type: "success",
                  title: "مُصرح بالدخول",
                  subtitle: "أهلاً بك في EazyGym!",
                  reason: "اشتراك نشط وساري",
                  memberName: "أحمد محمد علي",
                  memberCode: "1001",
                  planName: "اشتراك جيم 3 شهور",
                })
              }
            >
              نتيجة خضراء (Green - Access Granted)
            </Button>
            <Button
              variant="outline"
              className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
              onClick={() =>
                setFullScreenResult({
                  isOpen: true,
                  type: "warning",
                  title: "تنبيه: اقتراب انتهاء الاشتراك",
                  subtitle: "مسموح بالدخول اليوم ولكن يرجى التجديد",
                  reason: "متبقي 3 أيام على الانتهاء",
                  memberName: "محمود حسن السيد",
                  memberCode: "1002",
                  planName: "اشتراك جيم شهري",
                })
              }
            >
              نتيجة برتقالية (Amber - Warning / Grace)
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                setFullScreenResult({
                  isOpen: true,
                  type: "danger",
                  title: "مرفوض الدخول",
                  subtitle: "يرجى التوجه إلى موظف الاستقبال فوراً",
                  reason: "قسط متأخر (SUSPENDED_UNPAID)",
                  memberName: "عمر فاروق حسان",
                  memberCode: "1005",
                  planName: "اشتراك جيم سنوي",
                })
              }
            >
              نتيجة حمراء (Red - Access Denied)
            </Button>
          </div>
        </section>

        {/* 10. Tabs Component */}
        <section className="space-y-4 text-start">
          <h2 className="text-lg font-bold">{dict.design.tabs}</h2>
          <div className="rounded-lg border border-border bg-card p-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
                <TabsTrigger value="subscriptions">الاشتراكات</TabsTrigger>
                <TabsTrigger value="wallet">المحفظة</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="p-4 rounded-md bg-muted/40 text-sm">
                  محتوى تاب النظرة العامة: يتم عرض ملخص سريع للبيانات والإحصائيات الخاصة بالعضو.
                </div>
              </TabsContent>
              <TabsContent value="subscriptions">
                <div className="p-4 rounded-md bg-muted/40 text-sm">
                  محتوى تاب الاشتراكات: سجل كامل بكل باقات الجيم والتدريب الشخصي والكلاسات السابقة والنشطة.
                </div>
              </TabsContent>
              <TabsContent value="wallet">
                <div className="p-4 rounded-md bg-muted/40 text-sm">
                  محتوى تاب المحفظة: كشف حساب الحركات المالية وسندات القبض والصرف والرصيد الحالي.
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>

      {/* Active Modals */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="نافذة حوار منبثقة تجريبية"
        description="هذا المكون يستخدم للنماذج والتفاصيل وعمليات الاستقبال السريعة."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => setIsDialogOpen(false)}>حفظ التغييرات</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          تم تصميم النافذة لتدعم الاتجاهين RTL و LTR بسلاسة مع خلفية معتمة (Backdrop) وإمكانية الإغلاق بزر Esc أو النقر خارج النافذة.
        </p>
      </Dialog>

      <Sheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        side="end"
        title="لوحة سحب جانبية (Sheet)"
        description="تُستخدم لعرض تفاصيل الاشتراكات أو سلة المشتريات السريعة بنقطة البيع POS."
        footer={
          <Button onClick={() => setIsSheetOpen(false)}>إغلاق اللوحة</Button>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            تفتح اللوحة من جهة البداية أو النهاية (Start / End) وتتطابق هندسياً مع اتجاه اللغة العربي أو الإنجليزي بدون أي كسر لتنسيق CSS.
          </p>
          <div className="p-3 rounded-md bg-muted border border-border">
            <span className="font-semibold block mb-1">بيانات تجريبية</span>
            <span className="text-xs text-muted-foreground">الرصيد: 450.00 ج.م</span>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={(reason) => {
          setConfirmResult(reason);
          setIsConfirmOpen(false);
          toast.success(`تم تأكيد الإجراء بنجاح: ${reason}`);
        }}
        title="إلغاء وتفريغ فاتورة بيع (Void Invoice)"
        description="هذا الإجراء محاسبي حساس ولا يمكن التراجع عنه. يجب توثيق السبب ليتم حفظه في سجل التدقيق المالي."
        reasonLabel="سبب الإلغاء المحاسبي (مطلوب)"
        reasonPlaceholder="اكتب مثلاً: خطأ غير مقصود من العميل في اختيار الباقة..."
        minReasonLength={4}
      />

      {fullScreenResult && (
        <FullScreenResult
          isOpen={fullScreenResult.isOpen}
          onClose={() => setFullScreenResult(null)}
          type={fullScreenResult.type}
          title={fullScreenResult.title}
          subtitle={fullScreenResult.subtitle}
          reason={fullScreenResult.reason}
          memberName={fullScreenResult.memberName}
          memberCode={fullScreenResult.memberCode}
          planName={fullScreenResult.planName}
          details={[
            { label: "رقم الاشتراك", value: "#SUB-2026-09" },
            { label: "تاريخ الفحص", value: "2026-11-04 07:05" },
          ]}
          autoCloseSeconds={6}
        />
      )}
    </div>
  );
}
