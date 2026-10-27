import { SHOWCASE_MAX_QUOTE_CARDS, type PublicShowcaseCard } from '@/lib/showcase/showcase-rules';
import styles from './landing-page.module.css';

/** Logo, or the first letter of the shop name on a tinted tile. */
function ShopMark({ shop, small }: { shop: PublicShowcaseCard; small?: boolean }) {
  const className = small ? `${styles.showcaseMark} ${styles.showcaseMarkSmall}` : styles.showcaseMark;
  if (shop.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={shop.logoUrl} alt="" loading="lazy" />;
  }
  return (
    <span className={className} aria-hidden="true">
      {shop.name.charAt(0)}
    </span>
  );
}

/**
 * "ร้านที่ใช้ GoAlong Queue": real shops that consented and passed review
 * (`shop_showcase`). Renders nothing when there are none — never sample data.
 */
export function ShopShowcaseSection({ shops }: { shops: PublicShowcaseCard[] }) {
  if (shops.length === 0) return null;
  const quoted = shops.filter((s) => s.quote).slice(0, SHOWCASE_MAX_QUOTE_CARDS);

  return (
    <section className={styles.showcaseSection} id="customers">
      <div className={styles.container}>
        <div className={styles.sectionIntro} data-reveal>
          <p className={styles.sectionNumber}>ร้านที่ใช้จริง</p>
          <h2>ร้านที่รับคิว<br />ผ่าน LINE กับเรา</h2>
          <p>ทุกร้านในส่วนนี้ยินยอมให้แสดงชื่อและคำรีวิวเอง กดจองคิวร้านเหล่านี้ได้ทันที</p>
        </div>

        <ul className={styles.showcaseStrip} aria-label="ร้านที่ใช้ระบบ">
          {shops.map((shop) => (
            <li key={shop.id}>
              <ShopMark shop={shop} small />
              <span>{shop.name}</span>
            </li>
          ))}
        </ul>

        {quoted.length > 0 && (
          <div className={styles.showcaseGrid}>
            {quoted.map((shop) => {
              const meta = [shop.businessType, shop.area].filter(Boolean).join(' · ');
              return (
                <article key={shop.id} className={styles.showcaseCard}>
                  <blockquote>“{shop.quote}”</blockquote>
                  <div className={styles.showcaseCardFoot}>
                    <ShopMark shop={shop} />
                    <div>
                      <strong>{shop.name}</strong>
                      {meta && <small>{meta}</small>}
                    </div>
                  </div>
                  {shop.bookingUrl && (
                    <a className={styles.showcaseLink} href={shop.bookingUrl} target="_blank" rel="noopener noreferrer">
                      จองคิวร้านนี้ ›
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className={styles.showcaseNote}>
          เป็นร้านที่ใช้ GoAlong Queue อยู่แล้ว? เปิดให้ร้านขึ้นส่วนนี้ได้ที่ ตั้งค่า › แสดงร้านบนเว็บ
        </p>
      </div>
    </section>
  );
}
