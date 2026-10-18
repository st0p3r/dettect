import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Database,
  Eye,
  FileStack,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Menu,
  Moon,
  Radar,
  Settings,
  ShieldCheck,
  Sun,
  Swords,
  Users,
  X
} from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

const NAV = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/coverage', label: 'Coverage', icon: Gauge },
      { to: '/files', label: 'Files', icon: FolderOpen }
    ]
  },
  {
    title: 'Administration',
    items: [
      { to: '/editor/data-sources', label: 'Data sources', icon: Database },
      { to: '/editor/techniques', label: 'Techniques', icon: ListChecks },
      { to: '/editor/groups', label: 'Groups', icon: Users }
    ]
  },
  {
    title: 'Analysis',
    items: [
      { to: '/run/data-sources', label: 'Data source mapping', icon: FileStack },
      { to: '/run/visibility', label: 'Visibility coverage', icon: Eye },
      { to: '/run/detection', label: 'Detection coverage', icon: ShieldCheck },
      { to: '/run/groups', label: 'Threat groups', icon: Swords },
      { to: '/run/generic', label: 'ATT&CK statistics', icon: BarChart3 }
    ]
  },
  {
    title: 'System',
    items: [
      { to: '/jobs', label: 'Jobs', icon: Activity },
      { to: '/settings', label: 'Settings', icon: Settings }
    ]
  }
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Radar className="size-4.5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">DeTT&CT</div>
          <div className="text-[11px] text-muted-foreground">Detect Tactics, Techniques & Combat Threats</div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function AppLayout() {
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <TooltipProvider>
      <div className="flex min-h-svh">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r bg-sidebar lg:block">
          <Sidebar />
        </aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64 border-r bg-sidebar shadow-xl">
              <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" onClick={() => setMobileOpen(false)}>
                <X />
              </Button>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu />
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon-sm" onClick={toggle} title="Toggle theme">
              {dark ? <Sun /> : <Moon />}
            </Button>
          </header>
          <main key={location.pathname} className="mx-auto w-full max-w-[1600px] flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
