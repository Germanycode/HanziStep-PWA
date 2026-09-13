import { Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { NAV_ITEMS } from '@/app/navigation';
import { updateSettings, useSettings } from '@/db/settings';
import { vi } from '@/i18n/vi';
import { ProgressMini } from './ProgressMini';

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const label = isLight ? vi.theme.toDark : vi.theme.toLight;
  const Icon = isLight ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={() => void updateSettings({ theme: isLight ? 'dark' : 'light' })}
      aria-label={label}
      title={label}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sub transition hover:bg-surface-2 hover:text-fg"
    >
      <Icon className="size-5" aria-hidden />
      {!compact && <span>{label}</span>}
    </button>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav
      aria-label="Điều hướng chính"
      className="flex shrink-0 flex-col border-b border-line bg-surface md:h-full md:w-60 md:border-r md:border-b-0 md:p-4"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-2 md:pb-6">
        <NavLink to="/" className="flex items-center gap-3">
          <span className="font-hanzi grid size-10 place-items-center rounded-xl bg-seal text-xl font-bold text-white shadow">
            汉
          </span>
          <span className="leading-tight">
            <strong className="block text-base text-fg">{vi.appName}</strong>
            <small className="font-hanzi text-xs text-sub">{vi.appTagline}</small>
          </span>
        </NavLink>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle compact />
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-primary-navigation"
            onClick={() => setMobileOpen((value) => !value)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sub transition hover:bg-surface-2 hover:text-fg"
          >
            {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            Menu
          </button>
        </div>
      </div>

      <ProgressMini />

      <ul
        id="mobile-primary-navigation"
        className={`${mobileOpen ? 'grid' : 'hidden'} grid-cols-2 gap-1 border-t border-line px-2 py-2 md:flex md:flex-col md:overflow-visible md:border-0 md:px-0 md:py-0`}
      >
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                  isActive ? 'bg-primary/15 text-fg ring-1 ring-primary/40' : 'text-sub hover:bg-surface-2 hover:text-fg'
                }`
              }
            >
              <item.icon className="size-5 shrink-0" aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-auto hidden pt-4 md:block">
        <ThemeToggle />
      </div>
    </nav>
  );
}
