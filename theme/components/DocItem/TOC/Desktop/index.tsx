import {useEffect, useRef, useState} from 'react';
import TOCDesktop from '@theme-init/DocItem/TOC/Desktop';
import {PanelButton, setSetting, useSetting} from '../../../../lib/controls';

// The sections panel, fixed to the right edge. Collapsed, its tab names the section the reader is in: the last visible
// heading scrolled past the navbar (headings hidden by the audience or power-user switches have no box and are skipped).
export default function SectionsPanel() {
  const open = useSetting('toc') === 'open';
  const panel = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<string>();
  useEffect(() => {
    const links = [...panel.current!.querySelectorAll<HTMLAnchorElement>('.table-of-contents__link')];
    links.forEach((link) => (link.title = link.textContent ?? ''));
    const headings = links.map((link) => ({text: link.textContent ?? undefined, heading: document.getElementById(decodeURIComponent(link.hash.slice(1)))!}));
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ifm-navbar-height')) + 24;
        const visible = headings.filter(({heading}) => heading?.getClientRects().length);
        setSection((visible.filter(({heading}) => heading.getBoundingClientRect().top <= top).at(-1) ?? visible[0])?.text);
      });
    };
    read();
    window.addEventListener('scroll', read, {passive: true});
    window.addEventListener('cs-setting', read);
    return () => {
      window.removeEventListener('scroll', read);
      window.removeEventListener('cs-setting', read);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="toc-panel" ref={panel}>
      <PanelButton panel="sections" collapsed={!open} detail={section} onClick={() => setSetting('toc', open ? 'closed' : 'open')} />
      <TOCDesktop />
    </div>
  );
}
