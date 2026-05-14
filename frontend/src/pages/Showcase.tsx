import React, { useState } from 'react';
import styles from './Showcase.module.css';

/* ──────────────────────────────────────────────
   Inline mini-components (so Showcase is self-
   contained without importing from the project).
   In your real app, import from components/.
   ──────────────────────────────────────────── */

/* Button */
type BtnVariant = 'primary'|'secondary'|'ghost'|'danger'|'outline';
type BtnSize    = 'sm'|'md'|'lg';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: BtnSize;
  loading?: boolean; fullWidth?: boolean;
  iconLeft?: React.ReactNode; iconRight?: React.ReactNode;
}
const Btn: React.FC<BtnProps> = ({
  variant='primary', size='md', loading=false, fullWidth=false,
  iconLeft, iconRight, children, className='', disabled, ...rest
}) => (
  <button
    className={[
      styles.btn,
      styles[`btn_${variant}`],
      styles[`btn_${size}`],
      fullWidth ? styles.btn_full : '',
      loading   ? styles.btn_loading : '',
      className,
    ].filter(Boolean).join(' ')}
    disabled={disabled || loading}
    {...rest}
  >
    {loading && <span className={styles.spinner} />}
    {!loading && iconLeft  && <span className={styles.btnIcon}>{iconLeft}</span>}
    {children && <span>{children}</span>}
    {!loading && iconRight && <span className={styles.btnIcon}>{iconRight}</span>}
  </button>
);

/* Input */
interface InpProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; hint?: string; error?: string;
  iconLeft?: React.ReactNode; iconRight?: React.ReactNode;
}
const Inp: React.FC<InpProps> = ({ label, hint, error, iconLeft, iconRight, id, ...rest }) => {
  const uid = id ?? `inp-${Math.random().toString(36).slice(2,7)}`;
  return (
    <div className={styles.inpWrap}>
      {label && <label className={styles.inpLabel} htmlFor={uid}>{label}</label>}
      <div className={`${styles.inpField} ${error ? styles.inpError : ''}`}>
        {iconLeft  && <span className={styles.inpIconL}>{iconLeft}</span>}
        <input id={uid}
          className={`${styles.inp} ${iconLeft?styles.inpPadL:''} ${iconRight?styles.inpPadR:''}`}
          aria-invalid={!!error} {...rest} />
        {iconRight && <span className={styles.inpIconR}>{iconRight}</span>}
      </div>
      {error && <span className={styles.inpErrMsg}>{error}</span>}
      {!error && hint && <span className={styles.inpHint}>{hint}</span>}
    </div>
  );
};

/* Badge */
type BadgeVariant = 'default'|'success'|'warning'|'danger'|'accent';
const Badge: React.FC<{ variant?: BadgeVariant; children: React.ReactNode }> = ({ variant='default', children }) => (
  <span className={`${styles.badge} ${styles[`badge_${variant}`]}`}>{children}</span>
);

/* Avatar */
const Avatar: React.FC<{ name: string; size?: 'sm'|'md'|'lg'; src?: string }> = ({ name, size='md', src }) => {
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const colors   = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669'];
  const bg       = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${styles.avatar} ${styles[`avatar_${size}`]}`}
         style={{ background: src ? 'transparent' : bg }}>
      {src ? <img src={src} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : initials}
    </div>
  );
};

/* Toggle */
const Toggle: React.FC<{ label?: string; defaultOn?: boolean }> = ({ label, defaultOn=false }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className={styles.toggleWrap}>
      <div
        className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
        role="switch" aria-checked={on} tabIndex={0}
        onClick={() => setOn(v=>!v)}
        onKeyDown={e => e.key===' ' && setOn(v=>!v)}
      >
        <div className={styles.toggleThumb} />
      </div>
      {label && <span className={styles.toggleLabel}>{label}</span>}
    </label>
  );
};

/* Tag */
const Tag: React.FC<{ children: React.ReactNode; onRemove?: () => void }> = ({ children, onRemove }) => (
  <span className={styles.tag}>
    {children}
    {onRemove && <button className={styles.tagRemove} onClick={onRemove} aria-label="Remove">×</button>}
  </span>
);

/* Card */
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className='' }) => (
  <div className={`${styles.card} ${className}`}>
    {title && <div className={styles.cardTitle}>{title}</div>}
    {children}
  </div>
);

/* Section wrapper */
const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {subtitle && <p className={styles.sectionSub}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

/* Row */
const Row: React.FC<{ children: React.ReactNode; wrap?: boolean }> = ({ children, wrap=true }) => (
  <div className={styles.row} style={{ flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</div>
);

/* ── Colour palette data ──────────────────────── */
const DARK_TOKENS = [
  { name:'Canvas',        hex:'#0D0D0D', token:'--color-canvas' },
  { name:'BG Primary',    hex:'#111111', token:'--color-bg-primary' },
  { name:'BG Raised',     hex:'#161616', token:'--color-bg-raised' },
  { name:'BG Hover',      hex:'#1C1C1C', token:'--color-bg-hover' },
  { name:'Border',        hex:'#2A2A2A', token:'--color-border' },
  { name:'Border Active', hex:'#444444', token:'--color-border-active' },
  { name:'Text Tertiary', hex:'#777777', token:'--color-text-tertiary' },
  { name:'Text Secondary',hex:'#AAAAAA', token:'--color-text-secondary' },
  { name:'Text Primary',  hex:'#DDDDDD', token:'--color-text-primary' },
  { name:'White',         hex:'#FFFFFF', token:'--color-white' },
];
const ACCENT_TOKENS = [
  { name:'Accent',        hex:'#2563EB', token:'--color-accent' },
  { name:'Accent Dark',   hex:'#1D4ED8', token:'--color-accent-dark' },
  { name:'Accent Hover',  hex:'#3B82F6', token:'--color-accent-hover' },
];
const GREEN_TOKENS = [
  { name:'Green Accent',  hex:'#3D6B35', token:'--color-accent (light)' },
  { name:'Green Dark',    hex:'#2F5429', token:'--color-accent-dark (light)' },
  { name:'Green Subtle',  hex:'#EDF3EC', token:'--color-accent-subtle (light)' },
];
const STATUS_TOKENS = [
  { name:'Success', hex:'#22C55E', token:'--color-success' },
  { name:'Warning', hex:'#F59E0B', token:'--color-warning' },
  { name:'Danger',  hex:'#EF4444', token:'--color-danger' },
];

const Swatch: React.FC<{ name: string; hex: string; token: string; light?: boolean }> = ({ name, hex, token, light }) => (
  <div className={styles.swatch}>
    <div className={styles.swatchColor}
         style={{ background: hex, border: light ? '1px solid #E5E7EB' : '1px solid rgba(255,255,255,0.06)' }} />
    <div className={styles.swatchName}>{name}</div>
    <div className={styles.swatchHex}>{hex}</div>
    <div className={styles.swatchToken}>{token}</div>
  </div>
);

/* ─────────────────────────────────────────────── */
export const Showcase: React.FC = () => {
  const [inputVal, setInputVal]   = useState('');
  const [tags,     setTags]       = useState(['React', 'TypeScript', 'CSS Modules']);
  const [newTag,   setNewTag]     = useState('');

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(t => [...t, newTag.trim()]);
      setNewTag('');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Component Showcase</h1>
        <p className={styles.heroSub}>
          All design tokens and UI components extracted from the Figma prototype.
        </p>
      </div>

      {/* ── Colour Palette ── */}
      <Section title="Colour Palette" subtitle="Dark surface hierarchy + accent system. Use CSS custom properties everywhere.">
        <div className={styles.paletteGroup}>
          <div className={styles.paletteLabel}>Dark surfaces</div>
          <div className={styles.swatches}>
            {DARK_TOKENS.map(t => <Swatch key={t.hex} {...t} />)}
          </div>
        </div>
        <div className={styles.paletteGroup}>
          <div className={styles.paletteLabel}>Blue accent (dark theme)</div>
          <div className={styles.swatches}>
            {ACCENT_TOKENS.map(t => <Swatch key={t.hex} {...t} />)}
          </div>
        </div>
        <div className={styles.paletteGroup}>
          <div className={styles.paletteLabel}>Green accent (light theme)</div>
          <div className={styles.swatches}>
            {GREEN_TOKENS.map(t => <Swatch key={t.hex} {...t} light />)}
          </div>
        </div>
        <div className={styles.paletteGroup}>
          <div className={styles.paletteLabel}>Status</div>
          <div className={styles.swatches}>
            {STATUS_TOKENS.map(t => <Swatch key={t.hex} {...t} />)}
          </div>
        </div>
      </Section>

      {/* ── Typography ── */}
      <Section title="Typography" subtitle="DM Sans for UI text, DM Mono for code. Sizes from --text-xs to --text-3xl.">
        <Card>
          <div className={styles.typeRow} style={{fontSize:'var(--text-3xl)',fontWeight:'var(--weight-bold)'}}>
            Heading 3XL · Bold
          </div>
          <div className={styles.typeRow} style={{fontSize:'var(--text-2xl)',fontWeight:'var(--weight-bold)'}}>
            Heading 2XL · Bold
          </div>
          <div className={styles.typeRow} style={{fontSize:'var(--text-xl)',fontWeight:'var(--weight-semibold)'}}>
            Heading XL · Semibold
          </div>
          <div className={styles.typeRow} style={{fontSize:'var(--text-lg)',fontWeight:'var(--weight-semibold)'}}>
            Heading LG · Semibold
          </div>
          <div className={styles.typeRow} style={{fontSize:'var(--text-md)',fontWeight:'var(--weight-medium)'}}>
            Body MD · Medium
          </div>
          <div className={styles.typeRow} style={{fontSize:'var(--text-base)',color:'var(--color-text-secondary)'}}>
            Body Base · Regular — secondary colour
          </div>
          <div className={styles.typeRow} style={{fontSize:'var(--text-sm)',color:'var(--color-text-tertiary)'}}>
            Body SM · Regular — tertiary colour
          </div>
          <div className={styles.typeRow} style={{fontSize:'var(--text-xs)',fontFamily:'var(--font-mono)',color:'var(--color-accent)'}}>
            Mono XS · DM Mono — used for tokens, code, labels
          </div>
        </Card>
      </Section>

      {/* ── Buttons ── */}
      <Section title="Buttons" subtitle="5 variants × 3 sizes + loading + disabled states.">
        <Card title="Variants">
          <Row>
            <Btn variant="primary">Primary</Btn>
            <Btn variant="secondary">Secondary</Btn>
            <Btn variant="ghost">Ghost</Btn>
            <Btn variant="outline">Outline</Btn>
            <Btn variant="danger">Danger</Btn>
          </Row>
        </Card>
        <Card title="Sizes">
          <Row>
            <Btn size="sm">Small</Btn>
            <Btn size="md">Medium</Btn>
            <Btn size="lg">Large</Btn>
          </Row>
        </Card>
        <Card title="States">
          <Row>
            <Btn loading>Loading</Btn>
            <Btn disabled>Disabled</Btn>
            <Btn fullWidth>Full Width</Btn>
          </Row>
        </Card>
        <Card title="With icons">
          <Row>
            <Btn iconLeft={<span>↑</span>}>Upload</Btn>
            <Btn variant="secondary" iconRight={<span>→</span>}>Continue</Btn>
            <Btn variant="outline" iconLeft={<span>＋</span>}>Add item</Btn>
          </Row>
        </Card>
      </Section>

      {/* ── Inputs ── */}
      <Section title="Inputs" subtitle="With labels, icons, hints, and error states.">
        <div className={styles.inputGrid}>
          <Inp label="Default" placeholder="Enter value…" />
          <Inp label="With hint" placeholder="user@example.com" hint="We'll never share your email." />
          <Inp label="Error state" placeholder="Bad input" error="This field is required." />
          <Inp label="With icon" placeholder="Search…"
            iconLeft={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>} />
          <Inp label="Password" type="password" placeholder="Enter password"
            iconRight={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>} />
          <Inp label="Disabled" placeholder="Can't edit" disabled value="Read-only value" onChange={() => {}} />
        </div>
      </Section>

      {/* ── Badges ── */}
      <Section title="Badges" subtitle="Status and label badges in 5 semantic variants.">
        <Card>
          <Row>
            <Badge variant="default">Default</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="success">Active</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Error</Badge>
          </Row>
        </Card>
      </Section>

      {/* ── Avatars ── */}
      <Section title="Avatars" subtitle="Auto-coloured from name hash. Supports image src.">
        <Card>
          <Row>
            <Avatar name="Alice Chen"   size="sm" />
            <Avatar name="Bob Martinez" size="md" />
            <Avatar name="Carol White"  size="lg" />
            <Avatar name="David Park"   size="sm" />
            <Avatar name="Eva Johnson"  size="md" />
          </Row>
        </Card>
      </Section>

      {/* ── Toggles ── */}
      <Section title="Toggles" subtitle="Accessible switch components.">
        <Card>
          <Row>
            <Toggle label="Notifications" defaultOn />
            <Toggle label="Dark mode" />
            <Toggle label="Beta features" defaultOn />
          </Row>
        </Card>
      </Section>

      {/* ── Tags ── */}
      <Section title="Tags / Chips" subtitle="Interactive tags with removable state.">
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Row>
              {tags.map(tag => (
                <Tag key={tag} onRemove={() => setTags(t => t.filter(x => x !== tag))}>{tag}</Tag>
              ))}
            </Row>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <Inp
                placeholder="Add a tag…"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
              />
              <Btn size="sm" onClick={addTag}>Add</Btn>
            </div>
          </div>
        </Card>
      </Section>

      {/* ── Cards ── */}
      <Section title="Cards" subtitle="Surface container with optional title. Used throughout the app.">
        <div className={styles.cardGrid}>
          <Card title="Simple card">
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              A basic card with a title and body text. Use for grouping related content.
            </p>
          </Card>
          <Card title="With action">
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
              Cards can contain any components — inputs, buttons, lists.
            </p>
            <Btn size="sm" fullWidth>Open</Btn>
          </Card>
          <Card title="Stat card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-white)' }}>2,048</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Total simulations run</div>
              <Badge variant="success">↑ 12% this week</Badge>
            </div>
          </Card>
        </div>
      </Section>

      {/* ── Interactive example ── */}
      <Section title="Composed Example" subtitle="All components working together — a mini form.">
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 400 }}>
            <Inp label="Full name" placeholder="Jane Smith" value={inputVal} onChange={e => setInputVal(e.target.value)}
              hint={inputVal.length > 0 ? `${inputVal.length} characters` : undefined} />
            <Inp label="Email" type="email" placeholder="jane@example.com" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Toggle label="Email notifications" defaultOn />
              <Badge variant="accent">Admin</Badge>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Btn fullWidth variant="secondary">Cancel</Btn>
              <Btn fullWidth>Save changes</Btn>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
};