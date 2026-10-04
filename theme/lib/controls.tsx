// The theme's controls. Each reads and writes one reader setting (settings.js) on <html data-*>; their pressed state
// is drawn by CSS keyed on that attribute, so pre-rendered pages show the right state before hydration.
import {useEffect, useState, type MouseEventHandler, type ReactNode} from 'react';
import {settings} from '../settings';

type Setting = keyof typeof settings;

export function setSetting(name: Setting, value: string): void {
  document.documentElement.dataset[name] = value;
  try {
    localStorage.setItem(`cs-${name}`, value);
  } catch {}
  window.dispatchEvent(new Event('cs-setting'));
}

export function useSetting(name: Setting): string {
  const [value, setValue] = useState(settings[name][0]);
  useEffect(() => {
    const read = () => setValue(document.documentElement.dataset[name] ?? settings[name][0]);
    read();
    window.addEventListener('cs-setting', read);
    return () => window.removeEventListener('cs-setting', read);
  }, [name]);
  return value;
}

const Icon = ({children}: {children: ReactNode}) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const listIcon = <Icon><path d="M9 6h12M9 12h12M9 18h12M3.5 6h.5M3.5 12h.5M3.5 18h.5" /></Icon>;
const bookIcon = <Icon><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></Icon>;
const codeIcon = <Icon><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></Icon>;

export function AudienceToggle() {
  return (
    <div className="audience-toggle" role="radiogroup" aria-label="Audience">
      {settings.audience.map((kind) => (
        <button key={kind} type="button" role="radio" data-value={kind} onClick={() => setSetting('audience', kind)}>
          {kind[0].toUpperCase() + kind.slice(1)}
        </button>
      ))}
    </div>
  );
}

// Providers always see power-user content, so for them the switch shows on and disabled.
export function PowerUserRow() {
  const provider = useSetting('audience') === 'provider';
  const advanced = useSetting('advanced') === 'on';
  const on = provider || advanced;
  return (
    <div className="power-user">
      <span id="power-user-label">Power user</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="power-user-label"
        disabled={provider}
        title={provider ? 'Power-user content is always shown to resource providers' : undefined}
        onClick={() => setSetting('advanced', on ? 'off' : 'on')}>
        {bookIcon}
        <span className="power-user__track" />
        {codeIcon}
      </button>
    </div>
  );
}

// A side panel's header row when the panel is open, and the tab it leaves when collapsed; both put the icon and label
// in the same place, so switching between them moves nothing.
export function PanelButton({panel, collapsed, detail, onClick}: {panel: 'pages' | 'sections'; collapsed?: boolean; detail?: string; onClick: MouseEventHandler}) {
  const label = panel === 'pages' ? 'Page' : 'Section';
  return (
    <button
      type="button"
      className={`panel-button panel-button--${panel}${collapsed ? ' panel-button--collapsed' : ''}`}
      aria-label={`${collapsed ? 'Show' : 'Hide'} ${panel}`}
      title={collapsed ? detail : `Hide ${panel}`}
      onClick={onClick}>
      {listIcon}
      <span className="panel-button__label">{label}</span>
      {collapsed && detail && <span className="panel-button__detail">{detail}</span>}
    </button>
  );
}
