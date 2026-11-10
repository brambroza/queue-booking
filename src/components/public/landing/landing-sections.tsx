import Image from 'next/image';
import Link from 'next/link';
import { blogPosts } from '@/components/public/blog-content';
import { pricingPlans } from '@/components/public/content';
import { MOBILE_BANKS, MOBILE_BANKING_MAX_THB, MOBILE_BANKING_MIN_THB } from '@/lib/payments/mobile-banking/banks';
import { LandingIcon } from './landing-icons';
import { LandingLineDemo } from './landing-line-demo';
import { LandingLineMoments } from './landing-line-moments';
import { LandingRichMenuGallery } from './landing-rich-menu-gallery';
import {
  businessTiles,
  compareRows,
  heroBusinessStrip,
  heroTrustPoints,
  landingDefinition,
  landingFaqs,
  recommendedPostSlugs,
  setupSteps,
  supportItems,
  trustFacts,
} from './landing-content';
import styles from './landing.module.css';

/** Add-friend link of the QueueBooking OA (same as the navbar's). */
export const LINE_FRIEND_URL = 'https://lin.ee/oViqAoh';

const primary = `${styles.btn} ${styles.btnPrimary}`;
const ghost = `${styles.btn} ${styles.btnGhost}`;

function Check() {
  return <LandingIcon name="check" size={16} strokeWidth={2.4} />;
}

/** Hero: H1 with the search phrase, the definition paragraph, two CTAs, real screenshots. */
export function HeroSection() {
  return (
    <section className={styles.hero} id="top">
      <div className={`${styles.wrap} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>ระบบจองคิวผ่าน LINE OA · เริ่มใช้ฟรี</p>
          <h1 className={styles.h1}>
            ระบบจองคิวออนไลน์ผ่าน LINE OA <em>ให้ลูกค้าจองและรับนัดหมายเองได้ 24 ชม.</em>
          </h1>
          <p className={styles.definition} id="definition">
            {landingDefinition}
          </p>
          <div className={styles.heroActions}>
            <Link href="/register" className={primary}>
              เริ่มใช้ฟรี ไม่ต้องใช้บัตร
            </Link>
            <Link href="/sandbox-demo" className={ghost}>
              ทดลองแบบไม่ต้องสมัคร
            </Link>
          </div>
          <div className={styles.trust}>
            {heroTrustPoints.map((point) => (
              <span key={point}>
                <Check />
                {point}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.shot} aria-label="หน้าจอจริง: ลูกค้าเลือกเวลาใน LINE และกระดานคิวของร้าน">
          <div className={styles.shotBoard}>
            <Image
              src="/images/product/portal-queue-board.webp"
              alt="กระดานคิวของร้านในระบบหลังบ้าน แสดงคิวรอเรียก กำลังบริการ และเสร็จแล้ว"
              width={2400}
              height={1500}
              sizes="(max-width: 900px) 55vw, 520px"
              priority
            />
          </div>
          <div className={styles.shotPhone}>
            <Image
              src="/images/product/liff-slots.webp"
              alt="หน้าจองคิวใน LINE ลูกค้าเลือกช่วงเวลาที่ว่าง ช่องที่เต็มเป็นสีเทา"
              width={780}
              height={1688}
              sizes="(max-width: 900px) 40vw, 250px"
              priority
              fetchPriority="high"
            />
          </div>
          <div className={`${styles.shotTag} ${styles.shotTagTop}`}>
            <b>ร้าน</b> เห็นคิวทันทีที่ลูกค้าจอง
          </div>
          <div className={`${styles.shotTag} ${styles.shotTagBottom}`}>
            <b>ลูกค้า</b> เลือกเวลาว่างเองใน LINE
          </div>
        </div>
      </div>
    </section>
  );
}

/** Names of the businesses the product serves, right under the hero. */
export function BusinessStrip() {
  return (
    <div className={styles.strip}>
      <div className={`${styles.wrap} ${styles.stripInner}`}>
        <b>ใช้ได้กับ 21 ประเภทธุรกิจ</b>
        {heroBusinessStrip.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
    </div>
  );
}

/** "วิธีสร้างระบบจองคิวผ่านไลน์ใน 3 ขั้น" with a real screenshot per step. */
export function StepsSection() {
  return (
    <section className={styles.section} id="how">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>วิธีทำงาน</p>
          <h2 className={styles.h2}>วิธีสร้างระบบจองคิวผ่านไลน์ให้ร้านของคุณใน 3 ขั้น</h2>
          <p className={styles.lead}>ไม่ต้องเขียนโปรแกรม ไม่ต้องให้ลูกค้าโหลดแอป ใช้ LINE OA ที่ร้านมีอยู่แล้ว</p>
        </div>
        <div className={styles.steps}>
          {setupSteps.map((step, index) => (
            <article key={step.title} className={styles.step} data-reveal>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              <div className={styles.stepImage}>
                <Image src={step.image} alt={step.alt} fill sizes="(max-width: 900px) 92vw, 380px" loading="lazy" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Industry grid; every tile is an internal link with the search phrase as text. */
export function BusinessSection() {
  return (
    <section className={`${styles.section} ${styles.business}`} id="business">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>ธุรกิจที่รองรับ</p>
          <h2 className={styles.h2}>ระบบนัดหมายลูกค้าสำหรับร้านบริการทุกแบบ</h2>
          <p className={styles.lead}>แต่ละประเภทมีหน้าอธิบายและห้องทดลองของตัวเอง กดเข้าไปลองจองแบบลูกค้าได้เลยโดยไม่ต้องสมัคร</p>
        </div>
        <div className={styles.bizGrid} data-reveal>
          {businessTiles.map((tile) => (
            <Link key={tile.href} href={tile.href} className={styles.bizTile}>
              <LandingIcon name={tile.icon} size={22} />
              <b>{tile.label}</b>
              <small>{tile.desc}</small>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Customer side: a tap-through demo and the four real Flex cards. */
export function LineExperienceSection() {
  return (
    <section className={`${styles.section} ${styles.lineSection}`} id="line-experience">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>ฝั่งลูกค้า</p>
          <h2 className={styles.h2}>ลูกค้าเห็นอะไรใน LINE ลองกดดูได้เลย</h2>
          <p className={styles.lead}>การ์ดด้านล่างสร้างจากตัวส่งข้อความชุดเดียวกับที่ระบบส่งจริง ตั้งแต่กดจองจนใช้บริการเสร็จ ลูกค้าไม่ต้องออกจาก LINE แม้แต่ครั้งเดียว</p>
        </div>
        <div className={styles.lineGrid}>
          <div data-reveal>
            <LandingLineDemo />
          </div>
          <div data-reveal>
            <LandingLineMoments />
            <p className={styles.lineNote}>ภาพการ์ดวาดจาก Flex builder ตัวเดียวกับที่ส่งใน LINE เมื่อฟีเจอร์เปลี่ยน ภาพเปลี่ยนตาม</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Feature bento: six cells, one per thing a shop needs to take queues on LINE. */
export function FeaturesSection() {
  return (
    <section className={styles.section} id="features">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>ฟีเจอร์</p>
          <h2 className={styles.h2}>ทุกอย่างที่ร้านต้องใช้รับคิวทาง LINE อยู่ในระบบเดียว</h2>
        </div>
        <div className={styles.bento}>
          <article className={`${styles.cell} ${styles.cellWide}`} data-reveal>
            <div className={styles.cellText}>
              <h3>ลูกค้าจองเองใน LINE ไม่ต้องโหลดแอป</h3>
              <p>เลือกบริการ วัน และเวลาจากช่องที่ยังว่างจริง ช่องที่เต็มขึ้นเป็นสีเทา ระบบกันจองเกินจำนวนต่อรอบ ยืนยันด้วยการ์ดในแชท ลูกค้ากดยกเลิกหรือ “ฉันมาถึงแล้ว” ได้เอง</p>
            </div>
            <div className={styles.cellPhones}>
              <Image src="/images/product/liff-services.webp" alt="หน้าเลือกบริการในแอป LINE" width={780} height={1688} sizes="(max-width: 900px) 45vw, 170px" loading="lazy" />
              <Image src="/images/product/liff-my-queue.webp" alt="หน้าคิวของฉันในแอป LINE" width={780} height={1688} sizes="(max-width: 900px) 45vw, 170px" loading="lazy" />
            </div>
          </article>
          <article className={styles.cell} data-reveal>
            <h3>เตือนนัดอัตโนมัติ ลดลูกค้าเบี้ยวนัด</h3>
            <p>ตั้งเตือนล่วงหน้า 15 นาที ถึง 1 วัน ส่งถึงลูกค้าทาง LINE และข้อความขอบคุณหลังใช้บริการพร้อมปุ่มรีวิว</p>
          </article>
          <article className={styles.cell} data-reveal>
            <h3>รับชำระค่าบริการล่วงหน้าใน LINE</h3>
            <p>PromptPay QR ยืนยันอัตโนมัติ, กดเปิดแอปธนาคาร 5 แอปยอดล็อกจากระบบ, หรือโอนแล้วแนบสลิปที่ระบบอ่าน QR และเตือนสลิปซ้ำ</p>
            <div className={styles.banks}>
              {MOBILE_BANKS.map((bank) => (
                <span key={bank.code} className={styles.bank} style={{ background: bank.color }} title={bank.name}>
                  {/* Small brand marks served from /public; next/image gains nothing on 22px SVGs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/banks/${bank.code}.svg`} alt={bank.name} width={22} height={22} loading="lazy" />
                </span>
              ))}
              <span>
                ยอด {MOBILE_BANKING_MIN_THB.toLocaleString('th-TH')}–{MOBILE_BANKING_MAX_THB.toLocaleString('th-TH')} บาท
              </span>
            </div>
          </article>
          <article className={styles.cell} data-reveal>
            <h3>กระดานคิวหลายสาขา เรียกคิวส่ง LINE</h3>
            <p>พนักงานกดเรียกคิว ลูกค้าได้ข้อความ “ถึงคิวของคุณแล้ว” ย้ายคิว เปลี่ยนช่าง หรือต่อเวลาได้จากหน้าเดียว</p>
            <div className={styles.cellPicture}>
              <Image src="/images/product/portal-queue-board.webp" alt="กระดานคิวในระบบหลังบ้าน" fill sizes="(max-width: 900px) 92vw, 380px" loading="lazy" />
            </div>
          </article>
          <article className={styles.cell} data-reveal>
            <h3>ซิงก์ Google Calendar และรายงาน</h3>
            <p>ทุกการจอง เลื่อน ยกเลิก ไปอยู่ในปฏิทินของร้านอัตโนมัติ รายงานยอดคิว ชั่วโมงขายดี ต่อพนักงานและสาขา ส่งออก PDF / CSV</p>
            <div className={styles.cellPicture}>
              <Image src="/images/product/portal-reports.webp" alt="หน้ารายงานยอดคิว" fill sizes="(max-width: 900px) 92vw, 380px" loading="lazy" />
            </div>
          </article>
          <article className={styles.cell} data-reveal>
            <h3>กล่องแชท LINE รวม และปฏิทินการจอง</h3>
            <p>ตอบแชทลูกค้าทุกสาขาในที่เดียว บอทตอบ “เช็คคิวของฉัน” ให้เอง ดูคิวทั้งสัปดาห์ในปฏิทินแล้วย้ายคิวได้</p>
            <div className={styles.cellPicture}>
              <Image src="/images/product/portal-calendar.webp" alt="ปฏิทินการจองในระบบหลังบ้าน" fill sizes="(max-width: 900px) 92vw, 380px" loading="lazy" />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/** Rich menu strip drawn by the production renderer. */
export function RichMenuSection() {
  return (
    <section className={styles.section} id="rich-menu">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>Rich Menu สำเร็จรูป</p>
          <h2 className={styles.h2}>เมนูใน LINE ของร้านคุณ พร้อมใน 1 คลิก</h2>
          <p className={styles.lead}>เลือกประเภทธุรกิจ ระบบวาดเมนูพร้อมไอคอน ข้อความไทย และสีให้ เปลี่ยนสีหรือสลับปุ่มได้ แล้วกดเผยแพร่ไป LINE OA จากระบบ ไม่ต้องใช้โปรแกรมแต่งภาพ</p>
        </div>
        <LandingRichMenuGallery />
        <p className={styles.galleryNote}>มีให้เลือกครบ 21 ประเภทธุรกิจ · เผยแพร่จากระบบแล้วใช้ได้ทันทีใน LINE OA ของร้าน</p>
      </div>
    </section>
  );
}

/** The one dark section: queue display on the shop's own TV. */
export function SignageSection() {
  return (
    <section className={`${styles.section} ${styles.signage}`} id="signage">
      <div className={`${styles.wrap} ${styles.signageGrid}`}>
        <div data-reveal>
          <p className={styles.eyebrow}>จอเรียกคิว</p>
          <h2 className={styles.h2}>จอแสดงคิวหน้าร้านบนทีวีที่มีอยู่แล้ว</h2>
          <p className={styles.lead}>เปิดลิงก์จากเบราว์เซอร์บนสมาร์ททีวีหรือแท็บเล็ต เลขคิวที่กำลังเรียกขึ้นตัวใหญ่ ลูกค้านั่งรอแล้วเห็นเอง พนักงานไม่ต้องตะโกน</p>
          <ul className={styles.signageList}>
            <li>
              <LandingIcon name="check" size={18} strokeWidth={2.2} />
              <span>11 เทมเพลต แนวนอนและแนวตั้ง เปลี่ยนสีตามร้านได้</span>
            </li>
            <li>
              <LandingIcon name="check" size={18} strokeWidth={2.2} />
              <span>อัปเดตเองเมื่อพนักงานกดเรียกคิว ไม่ต้องซื้อตู้กดบัตร</span>
            </li>
            <li>
              <LandingIcon name="check" size={18} strokeWidth={2.2} />
              <span>ต้องการจอพร้อมติดตั้ง ทักทีมงานขอใบเสนอราคาแยกได้</span>
            </li>
          </ul>
          <div className={styles.signageActions}>
            <Link href="/features/queue-display" className={`${styles.btn} ${styles.btnOnDark}`}>
              ดูเทมเพลตจอคิวทั้งหมด
            </Link>
            <a href={LINE_FRIEND_URL} className={`${styles.btn} ${styles.btnOutlineLight}`} target="_blank" rel="noopener noreferrer">
              ขอใบเสนอราคาจอ + ติดตั้ง
            </a>
          </div>
        </div>
        <div data-reveal>
          <div className={styles.tv}>
            <div className={styles.tvScreen}>
              <Image src="/images/product/signage-tv.webp" alt="จอทีวีแสดงคิวที่กำลังเรียกและคิวถัดไป" fill sizes="(max-width: 900px) 92vw, 680px" loading="lazy" />
            </div>
          </div>
          <div className={styles.tvStand} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

/** Three plans from `pricingPlans` (single source with /pricing), Enterprise as one line, then the 4-way comparison. */
export function PricingSection() {
  const plans = pricingPlans.filter((p) => !p.contactSales);
  const enterprise = pricingPlans.find((p) => p.contactSales);
  return (
    <section className={styles.section} id="pricing">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>ราคา</p>
          <h2 className={styles.h2}>ราคาระบบจองคิวผ่าน LINE OA เริ่มต้นฟรี ไม่ผูกสัญญา</h2>
          <p className={styles.lead}>ราคาไม่รวมค่าส่งข้อความของ LINE ซึ่งร้านชำระกับ LINE โดยตรง เปลี่ยนแพ็กเกจได้ตลอด</p>
        </div>
        <div className={styles.plans}>
          {plans.map((plan) => {
            const featured = plan.highlight ?? false;
            return (
              <article key={plan.code} className={`${styles.plan} ${featured ? styles.planFeatured : ''}`} data-reveal>
                <span className={styles.planName}>{featured ? `${plan.name} · แนะนำ` : plan.name}</span>
                <div className={styles.planPrice}>
                  {plan.price.replace(' บาท', '')} <small>{plan.price.includes('บาท') ? `บาท${plan.period}` : plan.desc.includes('ตลอดชีพ') ? 'ตลอดชีพ' : plan.period}</small>
                </div>
                <ul className={styles.planList}>
                  {plan.items.map((item) => (
                    <li key={item}>
                      <Check />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={`/register?plan=${plan.code}`} className={featured ? primary : ghost}>
                  {featured ? 'เริ่มใช้ฟรี แล้วอัปเกรดเมื่อพร้อม' : 'เริ่มใช้ฟรี'}
                </Link>
              </article>
            );
          })}
        </div>
        {enterprise ? (
          <div className={styles.enterprise} data-reveal>
            <span>
              <strong style={{ fontWeight: 500 }}>{enterprise.name}</strong> · {enterprise.items.join(', ')}
            </span>
            <Link href="/contact">ติดต่อฝ่ายขาย →</Link>
          </div>
        ) : null}

        <div className={styles.compare} data-reveal>
          <h3>รับคิวทาง LINE 4 วิธี ต่างกันอย่างไร</h3>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">หัวข้อเปรียบเทียบ</span>
                  </th>
                  <th scope="col">ตอบแชทเอง</th>
                  <th scope="col">Google Form</th>
                  <th scope="col">แอปจองทั่วไป</th>
                  <th scope="col">QueueBooking</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" style={{ background: 'transparent', color: 'inherit', fontWeight: 400 }}>
                      {row.label}
                    </th>
                    <td>{row.chat}</td>
                    <td>{row.form}</td>
                    <td>{row.app}</td>
                    <td className={styles.tableMe}>{row.me}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Verifiable product facts and the support promise that matches the FAQ. */
export function TrustSection() {
  return (
    <section className={`${styles.section} ${styles.trustSection}`} id="trust">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>ความไว้ใจ</p>
          <h2 className={styles.h2}>ทำโดยทีมคนไทย ดูแลร้านไทย</h2>
          <p className={styles.lead}>ข้อมูลลูกค้าเป็นของร้าน ส่งออกได้ตลอด จัดเก็บตามหลัก PDPA เซิร์ฟเวอร์และระบบแจ้งเตือนมีทีมเฝ้าระวัง</p>
        </div>
        <div className={styles.facts} data-reveal>
          {trustFacts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <b>{fact.value}</b>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.support} data-reveal>
          {supportItems.map((item) => (
            <div key={item.title} className={styles.supportItem}>
              <b>{item.title}</b>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** FAQ in search language (also the FAQPage JSON-LD source) plus three guides. */
export function FaqSection() {
  const posts = recommendedPostSlugs.map((slug) => blogPosts.find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  return (
    <section className={styles.section} id="faq">
      <div className={styles.wrap}>
        <div data-reveal>
          <p className={styles.eyebrow}>คำถามที่พบบ่อย</p>
          <h2 className={styles.h2}>ก่อนเริ่มใช้ระบบจองคิวผ่าน LINE</h2>
        </div>
        <div className={styles.faqGrid} data-reveal>
          {landingFaqs.map((faq, index) => (
            <details key={faq.q} className={styles.faq} open={index === 0}>
              <summary>
                <h3 style={{ font: 'inherit' }}>{faq.q}</h3>
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
        {posts.length > 0 ? (
          <div className={styles.posts} data-reveal>
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.post}>
                <small>{post.category}</small>
                <b>{post.title}</b>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Closing call to action with the OA QR. */
export function FinalCtaSection() {
  return (
    <section className={styles.cta} id="start">
      <div className={`${styles.wrap} ${styles.ctaGrid}`}>
        <div data-reveal>
          <h2>เปิดรับคิวผ่าน LINE ให้ร้านของคุณวันนี้</h2>
          <p>สมัครฟรี ระบบสร้างบริการและเวลาทำการเริ่มต้นให้ทันที ยังไม่แน่ใจ ลองจองแบบลูกค้าในห้องทดลองก่อนได้</p>
          <div className={styles.ctaActions}>
            <Link href="/register" className={`${styles.btn} ${styles.btnOnDark}`}>
              เริ่มใช้ฟรี
            </Link>
            <Link href="/sandbox-demo" className={`${styles.btn} ${styles.btnOutlineLight}`}>
              ทดลองแบบไม่ต้องสมัคร
            </Link>
          </div>
        </div>
        <div className={styles.qr} data-reveal>
          <Image src="/images/landing/line-add-friend-qr.png" alt="QR Code เพิ่มเพื่อน QueueBooking ใน LINE" width={92} height={92} loading="lazy" unoptimized />
          <div>
            <b>คุยกับทีมงานทาง LINE</b>
            <small>
              <a href={LINE_FRIEND_URL} target="_blank" rel="noopener noreferrer">
                @queuebooking
              </a>{' '}
              · ถามฟีเจอร์ ขอดูตัวอย่าง หรือให้ช่วยเลือกแพ็กเกจ
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Bottom bar on phones: appears once the page scrolls past the hero. */
export function StickyCta() {
  return (
    <div className={styles.stickyCta}>
      <Link href="/sandbox-demo" className={ghost}>
        ทดลอง
      </Link>
      <Link href="/register" className={primary}>
        เริ่มใช้ฟรี
      </Link>
    </div>
  );
}
