'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import { publicLangFromPath, toEnglishPath, toThaiPath, type PublicLang } from '@/lib/i18n/public-routes';
import styles from './landing-page.module.css';

export const lineFriendUrl = 'https://lin.ee/oViqAoh';

type NavChild = { label: string; desc: string; href: string; icon: typeof QrCode2RoundedIcon };
type NavItem = { label: string; href: string; id?: string; children?: NavChild[] };

const navItems: NavItem[] = [
  { label: 'ภาพรวม', href: '#overview', id: 'overview' },
  { label: 'โหมดทดลอง', href: '/sandbox-demo' },
  { label: 'วิธีทำงาน', href: '#workflow', id: 'workflow' },
  {
    label: 'ฟีเจอร์',
    href: '#features',
    id: 'features',
    children: [
      { label: 'รับมัดจำ PromptPay', desc: 'ล็อกคิวด้วย QR ใน LINE ไม่ต้องเช็คสลิป', href: '#deposit', icon: QrCode2RoundedIcon },
      { label: 'จอเรียกคิว / Digital Signage', desc: 'เทมเพลตจอ TV และป้ายตั้งพื้น พร้อมติดตั้ง', href: '#signage', icon: TvRoundedIcon },
      { label: 'Google Calendar', desc: 'ซิงก์ทุกการจองเข้าปฏิทินของร้าน', href: '#google-calendar', icon: CalendarMonthRoundedIcon },
      { label: 'ฟีเจอร์ทั้งหมด', desc: 'Queue Board หลายสาขา รายงาน และอื่น ๆ', href: '#features', icon: DashboardRoundedIcon },
    ],
  },
  { label: 'ราคา', href: '#pricing', id: 'pricing' },
  { label: 'ซัพพอร์ต', href: '#support', id: 'support' },
  { label: 'คำถามที่พบบ่อย', href: '#faq', id: 'faq' },
  { label: 'บทความ', href: '/blog' },
];

/** English pages are separate routes (no home-page sections), so the menu links to them directly. */
const navItemsEn: NavItem[] = [
  { label: 'Home', href: '/en' },
  { label: 'Pricing', href: '/en/pricing' },
  { label: 'Use cases', href: '/en/use-cases' },
  { label: 'Blog', href: '/en/blog' },
  { label: 'Contact', href: '/en/contact' },
];

const navText: Record<PublicLang, Record<string, string>> = {
  th: {
    home: 'QueueBooking LINE หน้าแรก',
    mainNav: 'เมนูหลัก',
    features: 'ฟีเจอร์',
    login: 'เข้าสู่ระบบ',
    addFriend: 'เพิ่มเพื่อน',
    addFriendAria: 'เพิ่มเพื่อนใน LINE',
    start: 'เริ่มใช้ฟรี',
    openMenu: 'เปิดเมนู',
    closeMenu: 'ปิดเมนู',
    mobileNav: 'เมนูมือถือ',
    menu: 'เมนู',
    switchLang: 'EN',
    switchLangAria: 'View in English',
  },
  en: {
    home: 'QueueBooking LINE home',
    mainNav: 'Main menu',
    features: 'Features',
    login: 'Log in',
    addFriend: 'Add friend',
    addFriendAria: 'Add friend on LINE',
    start: 'Start free',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    mobileNav: 'Mobile menu',
    menu: 'Menu',
    switchLang: 'ไทย',
    switchLangAria: 'ดูภาษาไทย',
  },
};

const sectionIds = navItems.flatMap((item) => (item.id ? [item.id] : []));

/** Brand mark linking to the home page of the given language. */
export function Brand({ lang = 'th' }: { lang?: PublicLang }) {
  return (
    <Link href={lang === 'en' ? '/en' : '/'} className={styles.brand} aria-label={navText[lang].home}>
      <span className={styles.brandMark} aria-hidden="true"><span /></span>
      <span>QueueBooking <strong>LINE</strong></span>
    </Link>
  );
}

function ArrowIcon() {
  return <ArrowOutwardRoundedIcon aria-hidden="true" fontSize="small" />;
}

/**
 * Shared top navigation for the public landing family (/, /sandbox-demo, ...).
 * Hash links resolve to the home page when rendered elsewhere; the scroll spy
 * only runs on the home page. Under `/en` it shows the English menu.
 */
export function LandingNavbar() {
  const pathname = usePathname();
  const lang = publicLangFromPath(pathname);
  const items = lang === 'en' ? navItemsEn : navItems;
  const text = navText[lang];
  // Language link only where the other language has a page.
  const otherLangHref = lang === 'en' ? toThaiPath(pathname) : toEnglishPath(pathname);
  const onHome = pathname === '/';
  const resolveHref = (href: string) => (href.startsWith('#') && !onHome ? `/${href}` : href);
  const isRouteActive = (href: string) => !href.startsWith('#') && pathname === href;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('overview');
  const featuresRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll spy: highlight the nav item whose section is closest to the top.
  useEffect(() => {
    if (!onHome) return;
    const sections = sectionIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [onHome]);

  // Mobile drawer: lock body scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Desktop dropdown: close on outside click or Escape.
  useEffect(() => {
    if (!featuresOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!featuresRef.current?.contains(e.target as Node)) setFeaturesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFeaturesOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [featuresOpen]);

  const openFeatures = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFeaturesOpen(true);
  };
  const closeFeaturesSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFeaturesOpen(false), 140);
  };

  const featureItem = items.find((item) => item.children);

  return (
    <>
    <header className={`${styles.navScope} ${styles.navbar} ${scrolled ? styles.navbarScrolled : ''}`}>
      <div className={styles.navInner}>
        <Brand lang={lang} />

        <nav className={styles.desktopNav} aria-label={text.mainNav}>
          {items.map((item) =>
            item.children ? (
              <div
                key={item.href}
                ref={featuresRef}
                className={`${styles.navDropdown} ${featuresOpen ? styles.navDropdownOpen : ''}`}
                onMouseEnter={openFeatures}
                onMouseLeave={closeFeaturesSoon}
              >
                <button
                  type="button"
                  className={`${styles.navLink} ${(onHome && activeId === item.id) || featuresOpen ? styles.navLinkActive : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={featuresOpen}
                  onClick={() => setFeaturesOpen((v) => !v)}
                >
                  {item.label} <KeyboardArrowDownRoundedIcon className={styles.navCaret} />
                </button>
                <div className={styles.navMenu} role="menu" aria-label={text.features}>
                  {item.children.map(({ label, desc, href, icon: Icon }) => (
                    <Link key={label} href={resolveHref(href)} role="menuitem" className={styles.navMenuItem} onClick={() => setFeaturesOpen(false)}>
                      <span className={styles.navMenuIcon}><Icon /></span>
                      <span>
                        <strong>{label}</strong>
                        <small>{desc}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={resolveHref(item.href)}
                className={`${styles.navLink} ${(onHome && item.id && activeId === item.id) || isRouteActive(item.href) ? styles.navLinkActive : ''} ${
                  item.id === 'support' || item.id === 'faq' ? styles.navLinkSecondary : ''
                }`}
                aria-current={(onHome && item.id && activeId === item.id) || isRouteActive(item.href) ? 'true' : undefined}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className={styles.navActions}>
          {otherLangHref ? (
            <Link href={otherLangHref} className={styles.navGhost} aria-label={text.switchLangAria} hrefLang={lang === 'en' ? 'th' : 'en'}>
              {text.switchLang}
            </Link>
          ) : null}
          <Link href="/login" className={styles.navGhost}>{text.login}</Link>
          <a href={lineFriendUrl} className={styles.lineFriendNav} target="_blank" rel="noopener noreferrer" aria-label={text.addFriendAria}>
            <ChatBubbleOutlineRoundedIcon /> <span>{text.addFriend}</span>
          </a>
          <Link href="/register" className={styles.navCta}>{text.start} <ArrowIcon /></Link>
          <button
            type="button"
            className={styles.menuButton}
            aria-label={open ? text.closeMenu : text.openMenu}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
          </button>
        </div>
      </div>
    </header>

    {/* Drawer lives outside <header>: backdrop-filter on the navbar would otherwise become the containing block for position: fixed. */}
    <div className={`${styles.navScope} ${styles.mobileBackdrop} ${open ? styles.mobileBackdropOpen : ''}`} aria-hidden="true" onClick={() => setOpen(false)} />
      <aside id="landing-mobile-menu" className={`${styles.navScope} ${styles.mobileMenu} ${open ? styles.mobileMenuOpen : ''}`} aria-hidden={!open}>
        <div className={styles.mobileMenuHeader}>
          <Brand lang={lang} />
          <button type="button" className={styles.menuButton} aria-label={text.closeMenu} onClick={() => setOpen(false)}>
            <CloseRoundedIcon />
          </button>
        </div>
        <nav className={styles.mobileNav} aria-label={text.mobileNav}>
          <p className={styles.mobileGroupLabel}>{text.menu}</p>
          {items.filter((item) => !item.children).map((item) => (
            <Link key={item.href} href={resolveHref(item.href)} className={`${styles.mobileLink} ${isRouteActive(item.href) ? styles.mobileLinkActive : ''}`} onClick={() => setOpen(false)}>
              {item.label} <KeyboardArrowRightRoundedIcon />
            </Link>
          ))}
          {featureItem?.children ? (
            <>
              <p className={styles.mobileGroupLabel}>{text.features}</p>
              <div className={styles.mobileFeatureGrid}>
                {featureItem.children.map(({ label, desc, href, icon: Icon }) => (
                  <Link key={label} href={resolveHref(href)} className={styles.mobileFeature} onClick={() => setOpen(false)}>
                    <span className={styles.navMenuIcon}><Icon /></span>
                    <span>
                      <strong>{label}</strong>
                      <small>{desc}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
          <Link href="/login" className={styles.mobileLink} onClick={() => setOpen(false)}>
            {text.login} <KeyboardArrowRightRoundedIcon />
          </Link>
          {otherLangHref ? (
            <Link href={otherLangHref} className={styles.mobileLink} hrefLang={lang === 'en' ? 'th' : 'en'} onClick={() => setOpen(false)}>
              {lang === 'en' ? 'ภาษาไทย' : 'English'} <KeyboardArrowRightRoundedIcon />
            </Link>
          ) : null}
        </nav>
        <div className={styles.mobileMenuFooter}>
          <a href={lineFriendUrl} className={styles.mobileLineFriend} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <ChatBubbleOutlineRoundedIcon /> {text.addFriendAria}
          </a>
          <Link href="/register" className={styles.navCta} onClick={() => setOpen(false)}>{text.start} <ArrowIcon /></Link>
        </div>
      </aside>
    </>
  );
}
