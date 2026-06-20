// Animated visual of the overlap engine: one shared ingredient pack flowing to
// several dinners. The connector lines draw in (and a pulse sweeps along them)
// when an ancestor with [data-shown] enters view — so wrap this in <Reveal>.
// Pure SVG + CSS; see .flow-line / .flow-pulse in globals.css.

const MEAL_Y = [70, 150, 230];
const PATHS = [
  "M236 150 C 384 150 376 70 524 70",
  "M236 150 C 384 150 384 150 524 150",
  "M236 150 C 384 150 376 230 524 230",
];

export default function OverlapDiagram({
  ingredientTop = "1 pack",
  ingredientBottom = "chicken thighs",
  meals,
}: {
  ingredientTop?: string;
  ingredientBottom?: string;
  meals: string[];
}) {
  const three = meals.slice(0, 3);
  return (
    <svg
      viewBox="0 0 760 300"
      className="h-auto w-full"
      role="img"
      aria-label={`One pack of ${ingredientBottom} flows into ${three.join(", ")}`}
    >
      {/* connector lines (draw in) */}
      {PATHS.map((d, i) => (
        <path
          key={`l${i}`}
          d={d}
          className={`flow-line ${i === 1 ? "l2" : i === 2 ? "l3" : ""}`}
          style={{ ["--len" as string]: 330 }}
          fill="none"
          stroke="var(--basil-bright)"
          strokeOpacity={0.6}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
      {/* travelling pulse along each line */}
      {PATHS.map((d, i) => (
        <path
          key={`p${i}`}
          d={d}
          className={`flow-pulse ${i === 1 ? "p2" : i === 2 ? "p3" : ""}`}
          fill="none"
          stroke="var(--ember)"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}

      {/* endpoint dots on the meal side */}
      {MEAL_Y.map((y, i) => (
        <circle key={`d${i}`} cx={524} cy={y} r={4} fill="var(--basil-bright)" />
      ))}

      {/* ingredient node */}
      <g>
        <circle cx={128} cy={150} r={70} fill="var(--basil-bright)" opacity={0.16} className="bob" style={{ ["--r" as string]: "0deg" }} />
        <rect x={20} y={112} width={216} height={76} rx={20} fill="var(--basil-bright)" />
        <circle cx={128} cy={150} r={78} fill="none" stroke="var(--basil-bright)" strokeOpacity={0.4} />
        <text
          x={128}
          y={144}
          textAnchor="middle"
          fill="var(--oat)"
          style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 800, fontSize: 22 }}
        >
          {ingredientTop}
        </text>
        <text
          x={128}
          y={168}
          textAnchor="middle"
          fill="#dff0e4"
          style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 500, fontSize: 14 }}
        >
          {ingredientBottom}
        </text>
      </g>

      {/* meal nodes */}
      {three.map((title, i) => (
        <g key={`m${i}`}>
          <rect
            x={524}
            y={MEAL_Y[i] - 28}
            width={216}
            height={56}
            rx={14}
            fill="#ffffff"
            stroke="var(--sage-line)"
          />
          <text
            x={544}
            y={MEAL_Y[i] + 5}
            fill="var(--forest)"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 600, fontSize: 14.5 }}
          >
            {title.length > 26 ? title.slice(0, 25) + "…" : title}
          </text>
        </g>
      ))}
    </svg>
  );
}
