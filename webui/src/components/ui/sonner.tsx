import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  const dark = document.documentElement.classList.contains('dark');
  return (
    <Sonner
      theme={dark ? 'dark' : 'light'}
      className="toaster group"
      richColors
      closeButton
      style={{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)' } as React.CSSProperties}
      {...props}
    />
  );
}

export { Toaster };
