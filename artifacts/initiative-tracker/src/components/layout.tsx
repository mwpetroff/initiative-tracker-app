import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Grid3X3, Menu, Goal, Settings as SettingsIcon, Target } from "lucide-react";
import { NriLogo } from "@/components/nri-logo";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/language-switcher";

const navigation = [
  { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { key: "nav.initiatives", href: "/initiatives", icon: Target },
  { key: "nav.heatmap", href: "/heatmap", icon: Grid3X3 },
  { key: "nav.quarterlyGoals", href: "/quarterly-goals", icon: Goal },
  { key: "nav.settings", href: "/settings", icon: SettingsIcon },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { t } = useTranslation();

  return (
    <nav className="grid items-start px-4 text-sm font-medium gap-1">
      {navigation.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-sidebar-foreground",
              isActive
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70",
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <div className="hidden border-r border-sidebar-border w-64 lg:block bg-gradient-to-b from-[#001178] to-[#415e9b] text-sidebar-foreground">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b border-sidebar-border/60 px-6">
            <Link href="/" className="flex items-center gap-3 font-semibold">
              <NriLogo className="h-[18px] w-auto shrink-0 text-white" />
              <span className="border-l border-sidebar-border/60 pl-3 text-sm">{t("app.title")}</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <NavLinks />
          </div>
          <div className="border-t border-sidebar-border/60 px-4 py-4">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("nav.openMenu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 p-0 border-sidebar-border bg-gradient-to-b from-[#001178] to-[#415e9b] text-sidebar-foreground"
            >
              <div className="flex h-full flex-col">
                <div className="flex h-14 items-center border-b border-sidebar-border/60 px-6">
                  <Link
                    href="/"
                    className="flex items-center gap-2 font-semibold"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <NriLogo className="h-[18px] w-auto shrink-0 text-white" />
                    <span className="border-l border-sidebar-border/60 pl-3 text-sm">{t("app.title")}</span>
                  </Link>
                </div>
                <div className="flex-1 overflow-auto py-2">
                  <NavLinks onNavigate={() => setMobileNavOpen(false)} />
                </div>
                <div className="border-t border-sidebar-border/60 px-4 py-4">
                  <LanguageSwitcher />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <NriLogo className="h-4 w-auto shrink-0 text-[#001178]" />
            <span className="border-l pl-3 text-sm">{t("app.title")}</span>
          </Link>
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-8 lg:p-6 min-w-0 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
