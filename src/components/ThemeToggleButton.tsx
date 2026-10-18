import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../useAppTheme';

export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useAppTheme();
  const { t } = useTranslation();
  const label = theme === 'dark' ? t('layout.lightModeShort') : t('layout.darkMode');
  return <button type="button" className={`button secondary theme-toggle auth-theme-toggle ${className}`.trim()} aria-label={label} title={label} aria-pressed={theme === 'dark'} onClick={toggleTheme}>
    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
  </button>;
}
