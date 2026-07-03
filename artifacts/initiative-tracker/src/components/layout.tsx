import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Target, Grid3X3, Menu, Goal, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Initiatives", href: "/initiatives", icon: Target },
  { name: "Heatmap", href: "/heatmap", icon: Grid3X3 },
  { name: "Quarterly Goals", href: "/quarterly-goals", icon: Goal },
  { name: "Settings", href: "/settings", icon: SettingsIcon },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();

  return (
    <nav className="grid items-start px-4 text-sm font-medium gap-1">
      {navigation.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
              isActive ? "bg-muted text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <div className="hidden border-r bg-card w-64 lg:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Target className="h-6 w-6 text-primary" />
              <span className="">Initiative Tracker</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <NavLinks />
          </div>
        </div>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center border-b px-6">
                <Link
                  href="/"
                  className="flex items-center gap-2 font-semibold"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Target className="h-6 w-6 text-primary" />
                  <span>Initiative Tracker</span>
                </Link>
              </div>
              <div className="flex-1 overflow-auto py-2">
                <NavLinks onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-primary" />
            <span>Initiative Tracker</span>
          </Link>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-8 lg:p-6 min-w-0 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
