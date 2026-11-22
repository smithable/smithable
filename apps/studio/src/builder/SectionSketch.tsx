/**
 * A small drawing of a section's arrangement choice (T1196), like a theme card's sample: what a
 * layout, a column count, a picture side, a height or a background looks like, in Studio's own
 * colors. A choice without a drawing is its words alone.
 */
const W = 64;
/** 0 to n − 1, as values (each a drawing's fixed part, its own key). */
const count = (n: number) => Array.from({ length: n }, (_, i) => i);
const H = 40;
const ink = "var(--color-muted)";
const pic = "var(--color-line-strong)";
const accent = "var(--color-accent)";

const Lines = ({
  x,
  y,
  w,
  n = 3,
  color = ink,
}: {
  x: number;
  y: number;
  w: number;
  n?: number;
  color?: string;
}) => (
  <>
    {count(n).map((i) => (
      <rect
        key={i}
        x={x}
        y={y + i * 5}
        width={i === 0 ? w : w * (i === n - 1 ? 0.6 : 0.85)}
        height={i === 0 ? 3 : 2}
        rx={1}
        fill={color}
      />
    ))}
  </>
);
const Picture = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={2} fill={pic} />
    <path
      d={`M${x + 2} ${y + h - 2} l${w * 0.3} ${-h * 0.45} l${w * 0.2} ${h * 0.25} l${w * 0.15} ${-h * 0.15} L${x + w - 2} ${y + h - 2}Z`}
      fill={ink}
      opacity={0.5}
    />
  </>
);
const Boxes = ({ n, y = 8, h = 24 }: { n: number; y?: number; h?: number }) => {
  const gap = 3;
  const w = (W - 8 - gap * (n - 1)) / n;
  return (
    <>
      {count(n).map((i) => (
        <rect
          key={i}
          x={4 + i * (w + gap)}
          y={y}
          width={w}
          height={h}
          rx={2}
          fill="none"
          stroke={ink}
        />
      ))}
    </>
  );
};
const Rows = ({ n, y = 6, chevron = false }: { n: number; y?: number; chevron?: boolean }) => (
  <>
    {count(n).map((i) => (
      <g key={i}>
        <rect x={6} y={y + i * 7} width={chevron ? 44 : 52} height={2.5} rx={1} fill={ink} />
        {chevron && <path d={`M54 ${y + i * 7} l2 2 l2 -2`} fill="none" stroke={ink} />}
      </g>
    ))}
  </>
);

const HERO: Record<string, React.ReactNode> = {
  split: (
    <>
      <Lines x={5} y={12} w={24} />
      <Picture x={34} y={5} w={26} h={30} />
    </>
  ),
  centered: (
    <>
      <Picture x={0} y={0} w={W} h={H} />
      <Lines x={18} y={14} w={28} color="var(--color-panel)" />
    </>
  ),
  plain: <Lines x={16} y={14} w={32} />,
  cover: (
    <>
      <rect width={W} height={H} fill={accent} />
      <Lines x={8} y={14} w={30} color="var(--color-panel)" />
    </>
  ),
  photo: (
    <>
      <Picture x={0} y={0} w={W} h={H} />
      <Lines x={6} y={16} w={26} color="var(--color-panel)" />
    </>
  ),
  inset: (
    <>
      <Lines x={5} y={12} w={24} />
      <rect x={34} y={7} width={25} height={26} rx={3} fill="var(--color-panel)" stroke={ink} />
      <Picture x={36} y={9} w={21} h={22} />
    </>
  ),
  stage: (
    <>
      <Lines x={5} y={12} w={22} />
      <rect x={31} y={6} width={29} height={28} rx={2} fill="none" stroke={ink} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={34} y={10 + i * 6} width={23} height={2} rx={1} fill={ink} />
      ))}
    </>
  ),
  tiles: (
    <>
      <Picture x={4} y={4} w={36} h={21} />
      <rect x={43} y={4} width={17} height={9.5} rx={2} fill={accent} />
      <rect x={43} y={15.5} width={17} height={9.5} rx={2} fill={accent} opacity={0.7} />
      <rect x={4} y={28} width={56} height={8} rx={2} fill={accent} opacity={0.45} />
    </>
  ),
};

const LAYOUTS: Record<string, React.ReactNode> = {
  // Records, testimonials, a picture with text, an FAQ.
  cards: <Boxes n={3} />,
  list: <Rows n={4} y={8} />,
  grid: (
    <>
      <Boxes n={4} y={5} h={13} />
      <Boxes n={4} y={22} h={13} />
    </>
  ),
  ledger: (
    <>
      <rect x={4} y={6} width={56} height={4} rx={1} fill={pic} />
      <Rows n={4} y={14} />
      <path d="M24 6v28M42 6v28" stroke={pic} />
    </>
  ),
  week: (
    <>
      {count(7).map((i) => (
        <rect key={i} x={4 + i * 8.2} y={6} width={7} height={28} rx={1} fill="none" stroke={ink} />
      ))}
      <rect x={12.5} y={12} width={6} height={6} rx={1} fill={accent} />
      <rect x={37} y={20} width={6} height={8} rx={1} fill={accent} />
    </>
  ),
  carousel: (
    <>
      <path d="M6 20l3-3M6 20l3 3M58 20l-3-3M58 20l-3 3" stroke={ink} />
      <rect x={14} y={7} width={36} height={22} rx={2} fill="none" stroke={ink} />
      <Lines x={18} y={12} w={26} n={2} />
      <circle cx={28} cy={34} r={1.3} fill={accent} />
      <circle cx={32} cy={34} r={1.3} fill={ink} />
      <circle cx={36} cy={34} r={1.3} fill={ink} />
    </>
  ),
  one: (
    <>
      <path d="M12 10q-3 0-3 4h3v3h-4" stroke={accent} fill="none" />
      <Lines x={16} y={12} w={36} n={3} />
    </>
  ),
  accordion: <Rows n={4} y={8} chevron />,
  stacked: (
    <>
      <Picture x={14} y={3} w={36} h={18} />
      <Lines x={14} y={25} w={36} n={2} />
    </>
  ),
};

const HEIGHTS: Record<string, React.ReactNode> = {
  auto: <rect x={4} y={14} width={56} height={12} rx={2} fill={pic} />,
  default: <rect x={4} y={8} width={56} height={24} rx={2} fill={pic} />,
  full: <rect x={4} y={2} width={56} height={36} rx={2} fill={pic} />,
};

const BANDS: Record<string, string> = {
  none: "var(--color-panel)",
  muted: "var(--color-subtle)",
  inverse: "var(--color-fg)",
  primary: accent,
};

function drawing(kind: string, key: string, value: string): React.ReactNode {
  if (key === "layout") {
    if (kind === "hero") return HERO[value];
    if (kind === "mediaText" && value === "split") return HERO.split;
    return LAYOUTS[value];
  }
  if (key === "columns") return <Boxes n={Number(value)} />;
  if (key === "image")
    return value === "left" ? (
      <>
        <Picture x={5} y={5} w={26} h={30} />
        <Lines x={35} y={12} w={24} />
      </>
    ) : (
      HERO.split
    );
  if (key === "height") return HEIGHTS[value];
  if (key === "band" && BANDS[value])
    return (
      <>
        <rect
          x={0}
          y={8}
          width={W}
          height={24}
          fill={BANDS[value]}
          stroke={value === "none" ? pic : "none"}
        />
        <Lines
          x={14}
          y={15}
          w={36}
          n={2}
          color={value === "inverse" || value === "primary" ? "var(--color-panel)" : ink}
        />
      </>
    );
  return undefined;
}

/** The drawing of one choice, or undefined when it has none (its words then stand alone). */
export function SectionSketch({
  kind,
  choice,
  value,
}: {
  kind: string;
  choice: string;
  value: string;
}) {
  const content = drawing(kind, choice, value);
  if (!content) return null;
  return (
    <svg
      aria-hidden="true"
      data-sketch=""
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full overflow-hidden rounded border border-line bg-panel"
    >
      {content}
    </svg>
  );
}
