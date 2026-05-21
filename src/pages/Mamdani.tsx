import { useState, useMemo, ChangeEvent } from "react";
import Layout from "@/components/Layout";
import {
	RotateCcw,
	HelpCircle,
	X,
	Plus,
	Trash2,
	Download,
	Upload,
	BookOpen,
	ChevronDown,
	ChevronRight,
	Sparkles,
	Pencil,
	Check,
	Sigma,
	Zap,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════

type MFType = "triangular" | "trapezoidal";

interface FuzzySet {
	id: string;
	name: string;
	type: MFType;
	params: number[]; // [a,b,c] triangular | [a,b,c,d] trapezoidal
}

interface FuzzyVariable {
	id: string;
	name: string;
	unit: string;
	min: number;
	max: number;
	sets: FuzzySet[];
}

interface RuleAntecedent {
	variableId: string;
	setId: string;
}

interface FuzzyRule {
	id: string;
	antecedents: RuleAntecedent[];
	connector: "AND" | "OR";
	consequentSetId: string;
}

interface Preset {
	name: string;
	description: string;
	inputVars: FuzzyVariable[];
	outputVar: FuzzyVariable;
	rules: FuzzyRule[];
	initialInputs: Record<string, number>;
}

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

const uid = () => Math.random().toString(36).slice(2, 10);

const clamp = (v: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, v));

const triangularMF = (x: number, p: number[]): number => {
	const [a, b, c] = p;
	if (x <= a || x >= c) return 0;
	if (x === b) return 1;
	if (x < b) return b === a ? 1 : (x - a) / (b - a);
	return c === b ? 1 : (c - x) / (c - b);
};

const trapezoidalMF = (x: number, p: number[]): number => {
	const [a, b, c, d] = p;
	if (x <= a || x >= d) return 0;
	if (x >= b && x <= c) return 1;
	if (x < b) return b === a ? 1 : (x - a) / (b - a);
	return d === c ? 1 : (d - x) / (d - c);
};

const evalMF = (x: number, set: FuzzySet): number => {
	if (set.type === "triangular") return triangularMF(x, set.params);
	return trapezoidalMF(x, set.params);
};

/** Centro del conjunto difuso (para etiquetas) */
const setCenter = (set: FuzzySet): number => {
	if (set.type === "triangular") return set.params[1];
	return (set.params[1] + set.params[2]) / 2;
};

/** Mapea índice del conjunto → matiz (cian→morado). */
const setHue = (idx: number, total: number) =>
	180 + (idx / Math.max(1, total - 1)) * 100;

const formatNum = (n: number | null, digits = 2) =>
	n === null || isNaN(n) ? "—" : n.toFixed(digits);

// ════════════════════════════════════════════════════════════════════════
// PRESET EXAMPLES
// ════════════════════════════════════════════════════════════════════════

const tipExample: Preset = {
	name: "Calculadora de Propina",
	description:
		"Calcula el porcentaje de propina con base en la calidad del servicio y la comida del restaurante.",
	inputVars: [
		{
			id: "service",
			name: "Servicio",
			unit: "pts",
			min: 0,
			max: 10,
			sets: [
				{ id: "s_poor", name: "Malo", type: "triangular", params: [0, 0, 5] },
				{ id: "s_good", name: "Bueno", type: "triangular", params: [0, 5, 10] },
				{
					id: "s_exc",
					name: "Excelente",
					type: "triangular",
					params: [5, 10, 10],
				},
			],
		},
		{
			id: "food",
			name: "Comida",
			unit: "pts",
			min: 0,
			max: 10,
			sets: [
				{
					id: "f_bad",
					name: "Rancia",
					type: "trapezoidal",
					params: [0, 0, 2, 5],
				},
				{
					id: "f_del",
					name: "Deliciosa",
					type: "trapezoidal",
					params: [5, 8, 10, 10],
				},
			],
		},
	],
	outputVar: {
		id: "tip",
		name: "Propina",
		unit: "%",
		min: 0,
		max: 30,
		sets: [
			{ id: "t_low", name: "Baja", type: "triangular", params: [0, 5, 10] },
			{ id: "t_med", name: "Media", type: "triangular", params: [10, 15, 20] },
			{ id: "t_high", name: "Alta", type: "triangular", params: [20, 25, 30] },
		],
	},
	rules: [
		{
			id: "r1",
			antecedents: [
				{ variableId: "service", setId: "s_poor" },
				{ variableId: "food", setId: "f_bad" },
			],
			connector: "OR",
			consequentSetId: "t_low",
		},
		{
			id: "r2",
			antecedents: [{ variableId: "service", setId: "s_good" }],
			connector: "AND",
			consequentSetId: "t_med",
		},
		{
			id: "r3",
			antecedents: [
				{ variableId: "service", setId: "s_exc" },
				{ variableId: "food", setId: "f_del" },
			],
			connector: "OR",
			consequentSetId: "t_high",
		},
	],
	initialInputs: { service: 6.5, food: 8 },
};

const acExample: Preset = {
	name: "Aire Acondicionado",
	description:
		"Determina la velocidad del ventilador con base en la temperatura ambiente y la humedad.",
	inputVars: [
		{
			id: "temp",
			name: "Temperatura",
			unit: "°C",
			min: 10,
			max: 40,
			sets: [
				{
					id: "t_cold",
					name: "Fría",
					type: "trapezoidal",
					params: [10, 10, 15, 22],
				},
				{
					id: "t_warm",
					name: "Templada",
					type: "triangular",
					params: [18, 25, 32],
				},
				{
					id: "t_hot",
					name: "Calurosa",
					type: "trapezoidal",
					params: [28, 35, 40, 40],
				},
			],
		},
		{
			id: "hum",
			name: "Humedad",
			unit: "%",
			min: 0,
			max: 100,
			sets: [
				{
					id: "h_low",
					name: "Baja",
					type: "trapezoidal",
					params: [0, 0, 25, 50],
				},
				{ id: "h_med", name: "Media", type: "triangular", params: [30, 55, 80] },
				{
					id: "h_high",
					name: "Alta",
					type: "trapezoidal",
					params: [60, 85, 100, 100],
				},
			],
		},
	],
	outputVar: {
		id: "fan",
		name: "Ventilador",
		unit: "%",
		min: 0,
		max: 100,
		sets: [
			{ id: "f_off", name: "Apagado", type: "triangular", params: [0, 0, 25] },
			{ id: "f_low", name: "Lento", type: "triangular", params: [10, 30, 55] },
			{ id: "f_med", name: "Medio", type: "triangular", params: [40, 60, 85] },
			{
				id: "f_high",
				name: "Rápido",
				type: "triangular",
				params: [70, 100, 100],
			},
		],
	},
	rules: [
		{
			id: "ar1",
			antecedents: [{ variableId: "temp", setId: "t_cold" }],
			connector: "AND",
			consequentSetId: "f_off",
		},
		{
			id: "ar2",
			antecedents: [
				{ variableId: "temp", setId: "t_warm" },
				{ variableId: "hum", setId: "h_low" },
			],
			connector: "AND",
			consequentSetId: "f_low",
		},
		{
			id: "ar3",
			antecedents: [
				{ variableId: "temp", setId: "t_warm" },
				{ variableId: "hum", setId: "h_med" },
			],
			connector: "AND",
			consequentSetId: "f_med",
		},
		{
			id: "ar4",
			antecedents: [{ variableId: "temp", setId: "t_hot" }],
			connector: "AND",
			consequentSetId: "f_high",
		},
		{
			id: "ar5",
			antecedents: [
				{ variableId: "hum", setId: "h_high" },
				{ variableId: "temp", setId: "t_warm" },
			],
			connector: "AND",
			consequentSetId: "f_high",
		},
	],
	initialInputs: { temp: 28, hum: 70 },
};

const blankExample: Preset = {
	name: "Sistema en blanco",
	description:
		"Empieza desde cero. Define tus propias variables, conjuntos difusos y reglas para tu problema.",
	inputVars: [
		{
			id: "input1",
			name: "Entrada 1",
			unit: "",
			min: 0,
			max: 100,
			sets: [
				{ id: "b_low", name: "Bajo", type: "triangular", params: [0, 0, 50] },
				{
					id: "b_med",
					name: "Medio",
					type: "triangular",
					params: [0, 50, 100],
				},
				{
					id: "b_high",
					name: "Alto",
					type: "triangular",
					params: [50, 100, 100],
				},
			],
		},
	],
	outputVar: {
		id: "output",
		name: "Salida",
		unit: "",
		min: 0,
		max: 100,
		sets: [
			{ id: "bo_low", name: "Bajo", type: "triangular", params: [0, 0, 50] },
			{
				id: "bo_med",
				name: "Medio",
				type: "triangular",
				params: [0, 50, 100],
			},
			{
				id: "bo_high",
				name: "Alto",
				type: "triangular",
				params: [50, 100, 100],
			},
		],
	},
	rules: [],
	initialInputs: { input1: 50 },
};

const PRESETS: Preset[] = [tipExample, acExample, blankExample];

// ════════════════════════════════════════════════════════════════════════
// SVG PLOT: INPUT VARIABLE (membership functions + crisp value)
// ════════════════════════════════════════════════════════════════════════

interface InputPlotProps {
	variable: FuzzyVariable;
	crisp: number;
	fuzzified: Record<string, number>;
}

const InputPlot = ({ variable, crisp, fuzzified }: InputPlotProps) => {
	const W = 560,
		H = 220;
	const PL = 50,
		PR = 20,
		PT = 24,
		PB = 36;
	const innerW = W - PL - PR,
		innerH = H - PT - PB;

	const xScale = (v: number) =>
		PL + ((v - variable.min) / (variable.max - variable.min)) * innerW;
	const yScale = (mu: number) => PT + (1 - mu) * innerH;

	const samples = 200;
	const xTicks = 6;

	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
			{/* Grid */}
			{Array.from({ length: 5 }).map((_, i) => {
				const mu = i / 4;
				return (
					<line
						key={`hg-${i}`}
						x1={PL}
						x2={W - PR}
						y1={yScale(mu)}
						y2={yScale(mu)}
						stroke="hsl(240 30% 25%)"
						strokeWidth={0.5}
						strokeDasharray={i === 0 ? "0" : "2,3"}
					/>
				);
			})}
			{Array.from({ length: xTicks + 1 }).map((_, i) => {
				const v = variable.min + (i / xTicks) * (variable.max - variable.min);
				return (
					<g key={`xt-${i}`}>
						<line
							x1={xScale(v)}
							x2={xScale(v)}
							y1={yScale(0)}
							y2={yScale(0) + 4}
							stroke="hsl(240 30% 45%)"
							strokeWidth={1}
						/>
						<text
							x={xScale(v)}
							y={H - 18}
							fontSize={10}
							fill="hsl(240 20% 60%)"
							textAnchor="middle"
						>
							{Number(v.toFixed(2))}
						</text>
					</g>
				);
			})}

			{/* Y-axis label */}
			<text
				x={PL - 38}
				y={yScale(0.5)}
				fontSize={10}
				fill="hsl(240 20% 60%)"
				textAnchor="middle"
				transform={`rotate(-90, ${PL - 38}, ${yScale(0.5)})`}
			>
				μ(x)
			</text>
			<text x={PL - 8} y={yScale(0) + 3} fontSize={10} fill="hsl(240 20% 60%)" textAnchor="end">
				0
			</text>
			<text x={PL - 8} y={yScale(1) + 3} fontSize={10} fill="hsl(240 20% 60%)" textAnchor="end">
				1
			</text>

			{/* X-axis label */}
			<text
				x={(PL + W - PR) / 2}
				y={H - 4}
				fontSize={10}
				fill="hsl(240 20% 60%)"
				textAnchor="middle"
			>
				{variable.name} ({variable.unit})
			</text>

			{/* MF curves */}
			{variable.sets.map((set, i) => {
				const hue = setHue(i, variable.sets.length);
				const pts: string[] = [];
				for (let j = 0; j <= samples; j++) {
					const x =
						variable.min + (j / samples) * (variable.max - variable.min);
					const mu = evalMF(x, set);
					pts.push(`${xScale(x).toFixed(2)},${yScale(mu).toFixed(2)}`);
				}
				const fillPoints =
					`${xScale(variable.min)},${yScale(0)} ${pts.join(" ")} ${xScale(variable.max)},${yScale(0)}`;
				const labelX = xScale(setCenter(set));
				return (
					<g key={set.id}>
						<polygon points={fillPoints} fill={`hsl(${hue} 70% 50% / 0.12)`} />
						<polyline
							points={pts.join(" ")}
							fill="none"
							stroke={`hsl(${hue} 75% 60%)`}
							strokeWidth={2}
						/>
						<text
							x={labelX}
							y={yScale(1) - 6}
							fontSize={11}
							fontWeight={600}
							fill={`hsl(${hue} 70% 75%)`}
							textAnchor="middle"
						>
							{set.name}
						</text>
					</g>
				);
			})}

			{/* Crisp value vertical line */}
			<line
				x1={xScale(crisp)}
				x2={xScale(crisp)}
				y1={yScale(0)}
				y2={yScale(1) - 14}
				stroke="hsl(0 0% 95%)"
				strokeWidth={1.5}
				strokeDasharray="3,3"
			/>
			<text
				x={xScale(crisp)}
				y={yScale(1) - 18}
				fontSize={11}
				fontWeight={700}
				fill="hsl(0 0% 95%)"
				textAnchor="middle"
			>
				x₀ = {Number(crisp.toFixed(2))}
			</text>

			{/* μ markers at crisp value */}
			{variable.sets.map((set, i) => {
				const hue = setHue(i, variable.sets.length);
				const mu = fuzzified[set.id] ?? 0;
				if (mu < 0.005) return null;
				return (
					<g key={`mu-${set.id}`}>
						<line
							x1={PL}
							x2={xScale(crisp)}
							y1={yScale(mu)}
							y2={yScale(mu)}
							stroke={`hsl(${hue} 75% 60%)`}
							strokeWidth={1}
							strokeDasharray="2,2"
							opacity={0.7}
						/>
						<circle
							cx={xScale(crisp)}
							cy={yScale(mu)}
							r={4}
							fill={`hsl(${hue} 75% 60%)`}
							stroke="hsl(240 50% 8%)"
							strokeWidth={1.5}
						/>
						<text
							x={PL - 6}
							y={yScale(mu) + 3}
							fontSize={10}
							fontWeight={600}
							fill={`hsl(${hue} 70% 80%)`}
							textAnchor="end"
						>
							{mu.toFixed(2)}
						</text>
					</g>
				);
			})}
		</svg>
	);
};

// ════════════════════════════════════════════════════════════════════════
// SVG PLOT: OUTPUT AGGREGATION (rules → clipped consequents → aggregated)
// ════════════════════════════════════════════════════════════════════════

interface OutputPlotProps {
	variable: FuzzyVariable;
	rules: FuzzyRule[];
	firingStrengths: number[];
	aggregateXs: number[];
	aggregateYs: number[];
	centroid: number | null;
}

const OutputPlot = ({
	variable,
	rules,
	firingStrengths,
	aggregateXs,
	aggregateYs,
	centroid,
}: OutputPlotProps) => {
	const W = 760,
		H = 320;
	const PL = 50,
		PR = 24,
		PT = 30,
		PB = 40;
	const innerW = W - PL - PR,
		innerH = H - PT - PB;

	const xScale = (v: number) =>
		PL + ((v - variable.min) / (variable.max - variable.min)) * innerW;
	const yScale = (mu: number) => PT + (1 - mu) * innerH;
	const samples = 300;
	const xTicks = 8;

	// Map set id → index in variable.sets (for hue)
	const setIdx: Record<string, number> = {};
	variable.sets.forEach((s, i) => (setIdx[s.id] = i));

	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
			{/* Grid */}
			{Array.from({ length: 5 }).map((_, i) => {
				const mu = i / 4;
				return (
					<line
						key={`hg-${i}`}
						x1={PL}
						x2={W - PR}
						y1={yScale(mu)}
						y2={yScale(mu)}
						stroke="hsl(240 30% 25%)"
						strokeWidth={0.5}
						strokeDasharray={i === 0 ? "0" : "2,3"}
					/>
				);
			})}
			{Array.from({ length: xTicks + 1 }).map((_, i) => {
				const v = variable.min + (i / xTicks) * (variable.max - variable.min);
				return (
					<g key={`xt-${i}`}>
						<line
							x1={xScale(v)}
							x2={xScale(v)}
							y1={yScale(0)}
							y2={yScale(0) + 4}
							stroke="hsl(240 30% 45%)"
							strokeWidth={1}
						/>
						<text
							x={xScale(v)}
							y={H - 22}
							fontSize={10}
							fill="hsl(240 20% 60%)"
							textAnchor="middle"
						>
							{Number(v.toFixed(1))}
						</text>
					</g>
				);
			})}

			{/* Axis labels */}
			<text x={PL - 38} y={yScale(0.5)} fontSize={10} fill="hsl(240 20% 60%)" textAnchor="middle" transform={`rotate(-90, ${PL - 38}, ${yScale(0.5)})`}>
				μ(z)
			</text>
			<text x={PL - 8} y={yScale(0) + 3} fontSize={10} fill="hsl(240 20% 60%)" textAnchor="end">0</text>
			<text x={PL - 8} y={yScale(1) + 3} fontSize={10} fill="hsl(240 20% 60%)" textAnchor="end">1</text>
			<text x={(PL + W - PR) / 2} y={H - 6} fontSize={11} fill="hsl(240 20% 70%)" textAnchor="middle">
				{variable.name} ({variable.unit})
			</text>

			{/* Original output MFs (faded outlines) */}
			{variable.sets.map((set, i) => {
				const hue = setHue(i, variable.sets.length);
				const pts: string[] = [];
				for (let j = 0; j <= samples; j++) {
					const x =
						variable.min + (j / samples) * (variable.max - variable.min);
					const mu = evalMF(x, set);
					pts.push(`${xScale(x).toFixed(2)},${yScale(mu).toFixed(2)}`);
				}
				return (
					<g key={`base-${set.id}`}>
						<polyline
							points={pts.join(" ")}
							fill="none"
							stroke={`hsl(${hue} 60% 55% / 0.4)`}
							strokeWidth={1}
							strokeDasharray="3,3"
						/>
						<text
							x={xScale(setCenter(set))}
							y={yScale(1) - 6}
							fontSize={10}
							fontWeight={600}
							fill={`hsl(${hue} 50% 65%)`}
							textAnchor="middle"
						>
							{set.name}
						</text>
					</g>
				);
			})}

			{/* Clipped consequents per active rule */}
			{rules.map((rule, ri) => {
				const strength = firingStrengths[ri];
				if (strength < 0.005) return null;
				const set = variable.sets.find((s) => s.id === rule.consequentSetId);
				if (!set) return null;
				const hue = setHue(setIdx[set.id] ?? 0, variable.sets.length);
				const pts: string[] = [];
				for (let j = 0; j <= samples; j++) {
					const x =
						variable.min + (j / samples) * (variable.max - variable.min);
					const mu = Math.min(strength, evalMF(x, set));
					pts.push(`${xScale(x).toFixed(2)},${yScale(mu).toFixed(2)}`);
				}
				const fillPts = `${xScale(variable.min)},${yScale(0)} ${pts.join(" ")} ${xScale(variable.max)},${yScale(0)}`;
				return (
					<polygon
						key={`clip-${rule.id}`}
						points={fillPts}
						fill={`hsl(${hue} 70% 50% / 0.22)`}
						stroke={`hsl(${hue} 70% 60% / 0.7)`}
						strokeWidth={1}
					/>
				);
			})}

			{/* Aggregated curve (max of all clipped) - bold */}
			{aggregateXs.length > 0 && (
				<>
					<polygon
						points={`${xScale(variable.min)},${yScale(0)} ${aggregateXs
							.map((x, i) => `${xScale(x).toFixed(2)},${yScale(aggregateYs[i]).toFixed(2)}`)
							.join(" ")} ${xScale(variable.max)},${yScale(0)}`}
						fill="hsl(220 90% 60% / 0.18)"
					/>
					<polyline
						points={aggregateXs
							.map((x, i) => `${xScale(x).toFixed(2)},${yScale(aggregateYs[i]).toFixed(2)}`)
							.join(" ")}
						fill="none"
						stroke="hsl(220 100% 75%)"
						strokeWidth={2.5}
					/>
				</>
			)}

			{/* Centroid line */}
			{centroid !== null && (
				<g>
					<line
						x1={xScale(centroid)}
						x2={xScale(centroid)}
						y1={yScale(0)}
						y2={yScale(1) - 10}
						stroke="hsl(50 100% 60%)"
						strokeWidth={2}
					/>
					<polygon
						points={`${xScale(centroid) - 5},${yScale(1) - 10} ${xScale(centroid) + 5},${yScale(1) - 10} ${xScale(centroid)},${yScale(1) - 2}`}
						fill="hsl(50 100% 60%)"
					/>
					<text
						x={xScale(centroid)}
						y={yScale(1) - 14}
						fontSize={11}
						fontWeight={700}
						fill="hsl(50 100% 75%)"
						textAnchor="middle"
					>
						z* = {centroid.toFixed(2)}
					</text>
				</g>
			)}
		</svg>
	);
};

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════

const LogicaDifusa = () => {
	const [inputVars, setInputVars] = useState<FuzzyVariable[]>(
		JSON.parse(JSON.stringify(tipExample.inputVars)),
	);
	const [outputVar, setOutputVar] = useState<FuzzyVariable>(
		JSON.parse(JSON.stringify(tipExample.outputVar)),
	);
	const [rules, setRules] = useState<FuzzyRule[]>(
		JSON.parse(JSON.stringify(tipExample.rules)),
	);
	const [crispInputs, setCrispInputs] = useState<Record<string, number>>({
		...tipExample.initialInputs,
	});

	const [selectedPreset, setSelectedPreset] = useState(0);
	const [expandedVar, setExpandedVar] = useState<string | null>(null);
	const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
	const [showHelp, setShowHelp] = useState(false);
	const [showRules, setShowRules] = useState(true);

	// ── Computation ────────────────────────────────────────────────────────

	const calc = useMemo(() => {
		// 1) Fuzzification
		const fuzzified: Record<string, Record<string, number>> = {};
		for (const v of inputVars) {
			fuzzified[v.id] = {};
			const x = clamp(
				crispInputs[v.id] ?? (v.min + v.max) / 2,
				v.min,
				v.max,
			);
			for (const s of v.sets) fuzzified[v.id][s.id] = evalMF(x, s);
		}

		// 2) Rule firing strengths
		const firingStrengths = rules.map((rule) => {
			if (!rule.antecedents.length) return 0;
			const values = rule.antecedents.map((a) => {
				const fv = fuzzified[a.variableId];
				return fv ? fv[a.setId] ?? 0 : 0;
			});
			return rule.connector === "AND"
				? Math.min(...values)
				: Math.max(...values);
		});

		// 3) Aggregation (sampled grid for centroid + plot)
		const steps = 300;
		const xs: number[] = [];
		const ys: number[] = [];
		const step = (outputVar.max - outputVar.min) / steps;
		for (let i = 0; i <= steps; i++) {
			const x = outputVar.min + i * step;
			let maxMu = 0;
			rules.forEach((rule, idx) => {
				const cset = outputVar.sets.find((s) => s.id === rule.consequentSetId);
				if (!cset) return;
				const mu = Math.min(firingStrengths[idx], evalMF(x, cset));
				if (mu > maxMu) maxMu = mu;
			});
			xs.push(x);
			ys.push(maxMu);
		}

		// 4) Centroid defuzzification (∑ x·μ / ∑ μ)
		let num = 0,
			den = 0;
		for (let i = 0; i < xs.length; i++) {
			num += xs[i] * ys[i];
			den += ys[i];
		}
		const centroid = den > 1e-9 ? num / den : null;

		// 5) Linguistic interpretation (best matching output set at centroid)
		let linguistic = "—";
		let linguisticHue = 220;
		if (centroid !== null) {
			let bestMu = -1,
				bestSet: FuzzySet | null = null,
				bestIdx = 0;
			outputVar.sets.forEach((s, i) => {
				const mu = evalMF(centroid, s);
				if (mu > bestMu) {
					bestMu = mu;
					bestSet = s;
					bestIdx = i;
				}
			});
			if (bestSet) {
				linguistic = (bestSet as FuzzySet).name;
				linguisticHue = setHue(bestIdx, outputVar.sets.length);
			}
		}

		const anyFired = firingStrengths.some((f) => f > 0.005);

		return {
			fuzzified,
			firingStrengths,
			aggregateXs: xs,
			aggregateYs: ys,
			centroid,
			linguistic,
			linguisticHue,
			anyFired,
		};
	}, [inputVars, outputVar, rules, crispInputs]);

	// ── Preset loading ─────────────────────────────────────────────────────

	const loadPreset = (idx: number) => {
		const p = PRESETS[idx];
		setInputVars(JSON.parse(JSON.stringify(p.inputVars)));
		setOutputVar(JSON.parse(JSON.stringify(p.outputVar)));
		setRules(JSON.parse(JSON.stringify(p.rules)));
		setCrispInputs({ ...p.initialInputs });
		setSelectedPreset(idx);
		setExpandedVar(null);
		setEditingRuleId(null);
	};

	const resetInputs = () => {
		setCrispInputs({ ...PRESETS[selectedPreset].initialInputs });
	};

	// ── Add / Remove input variables ───────────────────────────────────────

	const addInputVar = () => {
		const newId = `var_${uid()}`;
		const idx = inputVars.length + 1;
		const newVar: FuzzyVariable = {
			id: newId,
			name: `Variable ${idx}`,
			unit: "",
			min: 0,
			max: 100,
			sets: [
				{ id: uid(), name: "Bajo", type: "triangular", params: [0, 0, 50] },
				{ id: uid(), name: "Medio", type: "triangular", params: [0, 50, 100] },
				{
					id: uid(),
					name: "Alto",
					type: "triangular",
					params: [50, 100, 100],
				},
			],
		};
		setInputVars((vs) => [...vs, newVar]);
		setCrispInputs((c) => ({ ...c, [newId]: 50 }));
		setExpandedVar(newId);
	};

	const removeInputVar = (id: string) => {
		if (inputVars.length <= 1) {
			alert("Debe haber al menos una variable de entrada.");
			return;
		}
		const v = inputVars.find((vv) => vv.id === id);
		if (!confirm(`¿Eliminar la variable "${v?.name}"? También se borrarán las reglas que la usen.`))
			return;
		setInputVars((vs) => vs.filter((v) => v.id !== id));
		setCrispInputs((c) => {
			const nc = { ...c };
			delete nc[id];
			return nc;
		});
		setRules((rs) =>
			rs
				.map((r) => ({
					...r,
					antecedents: r.antecedents.filter((a) => a.variableId !== id),
				}))
				.filter((r) => r.antecedents.length > 0),
		);
		if (expandedVar === id) setExpandedVar(null);
	};

	// ── Export / Import ────────────────────────────────────────────────────

	const handleExport = () => {
		const name = prompt(
			"Nombre del archivo:",
			`sistema-difuso-${PRESETS[selectedPreset].name.toLowerCase().replace(/\s+/g, "-")}`,
		);
		if (!name) return;
		const data = JSON.stringify(
			{ inputVars, outputVar, rules, crispInputs },
			null,
			2,
		);
		const blob = new Blob([data], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = name.endsWith(".json") ? name : `${name}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				const obj = JSON.parse(ev.target?.result as string);
				if (!obj.inputVars || !obj.outputVar || !obj.rules)
					throw new Error("formato inválido");
				setInputVars(obj.inputVars);
				setOutputVar(obj.outputVar);
				setRules(obj.rules);
				setCrispInputs(obj.crispInputs ?? {});
			} catch {
				alert("Archivo JSON inválido.");
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	};

	// ── Variable / Set editors ─────────────────────────────────────────────

	const updateInputVar = (id: string, patch: Partial<FuzzyVariable>) => {
		setInputVars((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
	};

	const updateOutputVar = (patch: Partial<FuzzyVariable>) => {
		setOutputVar((v) => ({ ...v, ...patch }));
	};

	const updateSetInVar = (
		varId: string | "OUTPUT",
		setId: string,
		patch: Partial<FuzzySet>,
	) => {
		const apply = (v: FuzzyVariable): FuzzyVariable => ({
			...v,
			sets: v.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
		});
		if (varId === "OUTPUT") setOutputVar(apply);
		else setInputVars((vs) => vs.map((v) => (v.id === varId ? apply(v) : v)));
	};

	const addSet = (varId: string | "OUTPUT") => {
		const newSet: FuzzySet = {
			id: uid(),
			name: "Nuevo",
			type: "triangular",
			params: [0, 0.5, 1],
		};
		if (varId === "OUTPUT") {
			const v = outputVar;
			const mid = (v.min + v.max) / 2;
			const span = (v.max - v.min) * 0.25;
			newSet.params = [mid - span, mid, mid + span];
			setOutputVar({ ...v, sets: [...v.sets, newSet] });
		} else {
			setInputVars((vs) =>
				vs.map((v) => {
					if (v.id !== varId) return v;
					const mid = (v.min + v.max) / 2;
					const span = (v.max - v.min) * 0.25;
					return {
						...v,
						sets: [
							...v.sets,
							{ ...newSet, params: [mid - span, mid, mid + span] },
						],
					};
				}),
			);
		}
	};

	const removeSet = (varId: string | "OUTPUT", setId: string) => {
		// Also remove rules referencing this set
		setRules((rs) =>
			rs.filter((r) => {
				if (r.consequentSetId === setId) return false;
				return !r.antecedents.some((a) => a.setId === setId);
			}),
		);
		if (varId === "OUTPUT")
			setOutputVar((v) => ({ ...v, sets: v.sets.filter((s) => s.id !== setId) }));
		else
			setInputVars((vs) =>
				vs.map((v) =>
					v.id === varId
						? { ...v, sets: v.sets.filter((s) => s.id !== setId) }
						: v,
				),
			);
	};

	// ── Rule editor helpers ────────────────────────────────────────────────

	const addRule = () => {
		if (!inputVars.length || !outputVar.sets.length) return;
		const v0 = inputVars[0];
		if (!v0.sets.length) return;
		const newRule: FuzzyRule = {
			id: uid(),
			antecedents: [{ variableId: v0.id, setId: v0.sets[0].id }],
			connector: "AND",
			consequentSetId: outputVar.sets[0].id,
		};
		setRules((rs) => [...rs, newRule]);
		setEditingRuleId(newRule.id);
	};

	const updateRule = (id: string, patch: Partial<FuzzyRule>) => {
		setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
	};

	const removeRule = (id: string) => {
		setRules((rs) => rs.filter((r) => r.id !== id));
		if (editingRuleId === id) setEditingRuleId(null);
	};

	const addAntecedent = (ruleId: string) => {
		const v0 = inputVars[0];
		if (!v0 || !v0.sets.length) return;
		updateRule(ruleId, {
			antecedents: [
				...rules.find((r) => r.id === ruleId)!.antecedents,
				{ variableId: v0.id, setId: v0.sets[0].id },
			],
		});
	};

	const removeAntecedent = (ruleId: string, idx: number) => {
		const rule = rules.find((r) => r.id === ruleId);
		if (!rule || rule.antecedents.length <= 1) return;
		updateRule(ruleId, {
			antecedents: rule.antecedents.filter((_, i) => i !== idx),
		});
	};

	const updateAntecedent = (
		ruleId: string,
		idx: number,
		patch: Partial<RuleAntecedent>,
	) => {
		const rule = rules.find((r) => r.id === ruleId);
		if (!rule) return;
		const newAnts = rule.antecedents.map((a, i) =>
			i === idx ? { ...a, ...patch } : a,
		);
		updateRule(ruleId, { antecedents: newAnts });
	};

	// ── Helpers for rule display ───────────────────────────────────────────

	const getVar = (id: string) => inputVars.find((v) => v.id === id);
	const getSetName = (varId: string, setId: string) => {
		const v = getVar(varId);
		if (!v) return "?";
		return v.sets.find((s) => s.id === setId)?.name ?? "?";
	};
	const getOutputSet = (setId: string) =>
		outputVar.sets.find((s) => s.id === setId);

	// ════════════════════════════════════════════════════════════════════
	// RENDER
	// ════════════════════════════════════════════════════════════════════

	return (
		<Layout>
			<div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">
				{/* ── HEADER BAR ─────────────────────────────────────────────── */}
				<div className="w-full bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
					<div className="max-w-7xl mx-auto w-full px-6 py-4 flex justify-between items-center">
						<div>
							<h1 className="text-xl font-bold text-white">
								Inferencia Difusa · Mamdani
							</h1>
							<p className="text-xs text-slate-400 mt-0.5">
								Fuzzificación · Reglas · Agregación · Centroide
							</p>
						</div>
						<div className="flex items-center gap-3">
							<label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 rounded-md transition-all hover:bg-slate-800 hover:text-white cursor-pointer">
								<Upload size={15} />
								Importar
								<input
									type="file"
									accept=".json"
									onChange={handleImport}
									className="hidden"
								/>
							</label>
							<button
								onClick={handleExport}
								className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 rounded-md transition-all hover:bg-slate-800 hover:text-white"
							>
								<Download size={15} />
								Exportar
							</button>
							<button
								onClick={resetInputs}
								className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 rounded-md transition-all hover:bg-slate-800 hover:text-white"
							>
								<RotateCcw size={15} />
								Reiniciar entradas
							</button>
							<div
								className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg"
								style={{
									background:
										"linear-gradient(135deg, hsl(248 70% 55%), hsl(200 90% 48%))",
								}}
							>
								<Zap size={15} />
								Calculando en vivo
							</div>
						</div>
					</div>
				</div>

				<div className="max-w-7xl mx-auto flex gap-6">
					{/* ─────────────────────────── LEFT SIDEBAR ─────────────────── */}
					<aside className="w-80 flex-shrink-0 space-y-4">
						{/* Examples */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
								<BookOpen size={13} />
								Ejemplos
							</h2>
							<div className="space-y-1.5">
								{PRESETS.map((p, i) => (
									<button
										key={p.name}
										onClick={() => loadPreset(i)}
										className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
										style={{
											background:
												selectedPreset === i
													? "hsl(248 70% 44%/0.35)"
													: "transparent",
											border: `1px solid ${selectedPreset === i ? "hsl(248 70% 58%/0.5)" : "transparent"}`,
											color:
												selectedPreset === i
													? "hsl(248 80% 88%)"
													: "hsl(240 20% 62%)",
										}}
									>
										<span
											className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
											style={{
												background:
													selectedPreset === i
														? "hsl(248 80% 72%)"
														: "hsl(240 20% 42%)",
											}}
										/>
										<div className="min-w-0">
											<div className="leading-tight">{p.name}</div>
											<div className="text-xs text-slate-500 mt-0.5 leading-snug">
												{p.description}
											</div>
										</div>
									</button>
								))}
							</div>
						</div>

						{/* Input variables editor */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<div className="flex items-center justify-between mb-3">
								<h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
									<Sparkles size={13} />
									Variables de entrada ({inputVars.length})
								</h2>
								<button
									onClick={addInputVar}
									className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20 rounded transition-all"
								>
									<Plus size={12} />
									Añadir
								</button>
							</div>
							<div className="space-y-2">
								{inputVars.map((v) => (
									<VariableEditor
										key={v.id}
										variable={v}
										expanded={expandedVar === v.id}
										onToggle={() =>
											setExpandedVar(expandedVar === v.id ? null : v.id)
										}
										onUpdate={(patch) => updateInputVar(v.id, patch)}
										onUpdateSet={(sid, patch) =>
											updateSetInVar(v.id, sid, patch)
										}
										onAddSet={() => addSet(v.id)}
										onRemoveSet={(sid) => removeSet(v.id, sid)}
										onDelete={
											inputVars.length > 1
												? () => removeInputVar(v.id)
												: undefined
										}
									/>
								))}
							</div>
						</div>

						{/* Output variable editor */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
								<Sigma size={13} />
								Variable de salida
							</h2>
							<VariableEditor
								variable={outputVar}
								expanded={expandedVar === outputVar.id}
								onToggle={() =>
									setExpandedVar(
										expandedVar === outputVar.id ? null : outputVar.id,
									)
								}
								onUpdate={(patch) => updateOutputVar(patch)}
								onUpdateSet={(sid, patch) =>
									updateSetInVar("OUTPUT", sid, patch)
								}
								onAddSet={() => addSet("OUTPUT")}
								onRemoveSet={(sid) => removeSet("OUTPUT", sid)}
							/>
						</div>

						{/* Rules editor */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<div className="flex items-center justify-between mb-3">
								<h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
									<button
										onClick={() => setShowRules(!showRules)}
										className="hover:text-slate-300 transition-colors"
									>
										{showRules ? (
											<ChevronDown size={13} />
										) : (
											<ChevronRight size={13} />
										)}
									</button>
									Reglas Difusas ({rules.length})
								</h2>
								<button
									onClick={addRule}
									className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20 rounded transition-all"
								>
									<Plus size={12} />
									Añadir
								</button>
							</div>
							{showRules && (
								<div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
									{rules.length === 0 && (
										<p className="text-xs text-slate-500 italic">
											Sin reglas todavía. Pulsa «Añadir».
										</p>
									)}
									{rules.map((rule, ri) => (
										<RuleEditor
											key={rule.id}
											rule={rule}
											ruleIndex={ri}
											firingStrength={calc.firingStrengths[ri]}
											inputVars={inputVars}
											outputVar={outputVar}
											isEditing={editingRuleId === rule.id}
											onStartEdit={() => setEditingRuleId(rule.id)}
											onFinishEdit={() => setEditingRuleId(null)}
											onUpdate={(patch) => updateRule(rule.id, patch)}
											onRemove={() => removeRule(rule.id)}
											onAddAntecedent={() => addAntecedent(rule.id)}
											onRemoveAntecedent={(idx) =>
												removeAntecedent(rule.id, idx)
											}
											onUpdateAntecedent={(idx, patch) =>
												updateAntecedent(rule.id, idx, patch)
											}
											getSetName={getSetName}
										/>
									))}
								</div>
							)}
						</div>
					</aside>

					{/* ─────────────────────────── MAIN AREA ────────────────────── */}
					<div className="flex-1 min-w-0 flex flex-col gap-4">
						{/* Crisp inputs panel */}
						<div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
							<h2 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
								Valores de entrada (crisp)
							</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
								{inputVars.map((v) => {
									const val = crispInputs[v.id] ?? (v.min + v.max) / 2;
									const stepSize = (v.max - v.min) / 100;
									return (
										<div key={v.id}>
											<div className="flex items-baseline justify-between mb-1.5">
												<label className="text-sm text-slate-300 font-medium">
													{v.name}
												</label>
												<span className="text-base font-bold font-mono text-indigo-300">
													{val.toFixed(2)}
													<span className="text-xs text-slate-500 ml-1">
														{v.unit}
													</span>
												</span>
											</div>
											<input
												type="range"
												min={v.min}
												max={v.max}
												step={stepSize}
												value={val}
												onChange={(e) =>
													setCrispInputs((c) => ({
														...c,
														[v.id]: parseFloat(e.target.value),
													}))
												}
												className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
											/>
											<div className="flex justify-between text-xs text-slate-500 mt-1">
												<span>{v.min}</span>
												<span>{v.max}</span>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* Result panel */}
						<div
							className="border rounded-xl p-5 flex items-center gap-5"
							style={{
								background:
									"linear-gradient(135deg, hsl(248 50% 18% / 0.4), hsl(200 60% 16% / 0.4))",
								borderColor: "hsl(220 50% 35% / 0.4)",
							}}
						>
							<div
								className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
								style={{
									background: calc.anyFired
										? "hsl(50 100% 55%/0.18)"
										: "hsl(240 30% 30%/0.4)",
									border: `2px solid ${calc.anyFired ? "hsl(50 100% 60%)" : "hsl(240 30% 50%)"}`,
								}}
							>
								<Sigma
									size={26}
									color={
										calc.anyFired ? "hsl(50 100% 75%)" : "hsl(240 30% 65%)"
									}
								/>
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
									Salida defuzzificada (centroide)
								</p>
								<div className="flex items-baseline gap-3 flex-wrap">
									<span className="text-3xl font-bold font-mono text-white">
										{formatNum(calc.centroid, 2)}
									</span>
									<span className="text-base text-slate-400 font-mono">
										{outputVar.unit}
									</span>
									<span className="text-base font-medium" style={{ color: `hsl(${calc.linguisticHue} 70% 78%)` }}>
										→ {calc.linguistic}
									</span>
								</div>
								<p className="text-xs text-slate-500 mt-1">
									{outputVar.name} · z* = ∫z·μ(z)dz / ∫μ(z)dz
								</p>
							</div>
							{!calc.anyFired && (
								<div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-200">
									⚠ Ninguna regla disparó. Ajusta las entradas o agrega reglas.
								</div>
							)}
						</div>

						{/* Fuzzification per input */}
						<div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
							<h2 className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
								Paso 1 · Fuzzificación de las entradas
							</h2>
							<p className="text-xs text-slate-500 mb-4">
								Para cada variable, evaluamos el valor crisp x₀ en cada función
								de membresía μ(x).
							</p>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								{inputVars.map((v) => (
									<div
										key={v.id}
										className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3"
									>
										<InputPlot
											variable={v}
											crisp={clamp(
												crispInputs[v.id] ?? (v.min + v.max) / 2,
												v.min,
												v.max,
											)}
											fuzzified={calc.fuzzified[v.id] ?? {}}
										/>
									</div>
								))}
							</div>
						</div>

						{/* Rule firing strengths */}
						<div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
							<h2 className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
								Paso 2 · Fuerza de disparo de cada regla
							</h2>
							<p className="text-xs text-slate-500 mb-4">
								α<sub>i</sub> = mín(μ<sub>antecedentes</sub>) para AND ·
								máx(μ<sub>antecedentes</sub>) para OR
							</p>
							<div className="space-y-2">
								{rules.length === 0 && (
									<p className="text-sm text-slate-500 italic">
										No hay reglas definidas.
									</p>
								)}
								{rules.map((rule, ri) => {
									const strength = calc.firingStrengths[ri];
									const cset = getOutputSet(rule.consequentSetId);
									const csetIdx = outputVar.sets.findIndex(
										(s) => s.id === rule.consequentSetId,
									);
									const hue = setHue(
										Math.max(0, csetIdx),
										outputVar.sets.length,
									);
									const active = strength > 0.005;
									return (
										<div
											key={rule.id}
											className="bg-slate-900/60 border rounded-lg p-3 transition-all"
											style={{
												borderColor: active
													? `hsl(${hue} 60% 45% / 0.5)`
													: "hsl(240 30% 25%)",
												opacity: active ? 1 : 0.55,
											}}
										>
											<div className="flex items-baseline justify-between gap-3 mb-2">
												<div className="text-sm text-slate-300 font-mono leading-snug min-w-0">
													<span className="text-slate-500 mr-2">
														R{ri + 1}:
													</span>
													<span className="text-indigo-300 font-semibold">SI</span>{" "}
													{rule.antecedents.map((a, i) => (
														<span key={i}>
															{i > 0 && (
																<span className="text-amber-300 font-semibold mx-1">
																	{rule.connector === "AND" ? "Y" : "O"}
																</span>
															)}
															<span className="text-slate-200">
																{getVar(a.variableId)?.name ?? "?"}
															</span>{" "}
															<span className="text-slate-500">es</span>{" "}
															<span
																className="font-semibold"
																style={{
																	color: `hsl(${setHue(
																		getVar(a.variableId)?.sets.findIndex(
																			(s) => s.id === a.setId,
																		) ?? 0,
																		getVar(a.variableId)?.sets.length ?? 1,
																	)} 70% 75%)`,
																}}
															>
																{getSetName(a.variableId, a.setId)}
															</span>
														</span>
													))}{" "}
													<span className="text-indigo-300 font-semibold">
														ENTONCES
													</span>{" "}
													<span className="text-slate-200">{outputVar.name}</span>{" "}
													<span className="text-slate-500">es</span>{" "}
													<span
														className="font-semibold"
														style={{ color: `hsl(${hue} 70% 75%)` }}
													>
														{cset?.name ?? "?"}
													</span>
												</div>
												<span
													className="text-sm font-mono font-bold flex-shrink-0"
													style={{
														color: active
															? `hsl(${hue} 70% 75%)`
															: "hsl(240 20% 50%)",
													}}
												>
													α = {strength.toFixed(3)}
												</span>
											</div>
											<div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
												<div
													className="h-full transition-all rounded-full"
													style={{
														width: `${strength * 100}%`,
														background: `hsl(${hue} 70% 55%)`,
														boxShadow: active
															? `0 0 8px hsl(${hue} 70% 60% / 0.6)`
															: "none",
													}}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* Output aggregation plot */}
						<div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
							<h2 className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
								Paso 3 · Agregación y defuzzificación
							</h2>
							<p className="text-xs text-slate-500 mb-4">
								Cada consecuente se recorta con su α (min), todos se unen con
								máximo, y el centroide z* da el resultado nítido.
							</p>
							<div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3">
								<OutputPlot
									variable={outputVar}
									rules={rules}
									firingStrengths={calc.firingStrengths}
									aggregateXs={calc.aggregateXs}
									aggregateYs={calc.aggregateYs}
									centroid={calc.centroid}
								/>
							</div>
							<div className="flex flex-wrap gap-3 mt-3 text-xs">
								<LegendItem color="hsl(240 30% 60%)" dashed label="MF original (sin recortar)" />
								<LegendItem color="hsl(220 60% 60%)" filled label="Consecuente recortado (por regla)" />
								<LegendItem color="hsl(220 100% 75%)" thick label="MF agregada (máximo)" />
								<LegendItem color="hsl(50 100% 60%)" thick label="z* centroide" />
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ── HELP BUTTON ──────────────────────────────────────────────────── */}
			<div className="fixed bottom-6 right-6 z-40">
				<button
					onClick={() => setShowHelp(true)}
					className="w-12 h-12 rounded-full border-2 border-slate-400 text-slate-400 flex items-center justify-center bg-transparent backdrop-blur-sm transition-all hover:bg-slate-400 hover:text-slate-900 shadow-lg"
					title="Ver guía"
				>
					<HelpCircle size={24} strokeWidth={2.5} />
				</button>
			</div>

			{/* ── HELP MODAL ───────────────────────────────────────────────────── */}
			{showHelp && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-2xl shadow-2xl relative">
						<button
							onClick={() => setShowHelp(false)}
							className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
						>
							<X size={18} />
						</button>
						<h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
							<HelpCircle size={20} className="text-slate-300" />
							Guía: Inferencia de Mamdani
						</h2>
						<div className="text-sm space-y-4 max-h-[65vh] overflow-y-auto pr-2">
							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									¿Qué hace este programa?
								</h3>
								<p className="text-slate-400 leading-relaxed">
									Implementa el método de inferencia difusa de{" "}
									<strong className="text-white">Mamdani</strong> de forma{" "}
									<strong className="text-white">totalmente genérica</strong>:
									no está atado a ningún problema en particular. Tú defines las
									variables (con sus etiquetas lingüísticas y rangos numéricos),
									los conjuntos difusos y las reglas SI-ENTONCES; el programa
									hace fuzzificación, evaluación de reglas, agregación y
									defuzzificación por centroide. Los ejemplos precargados
									(propina, aire acondicionado) son solo plantillas de inicio
									— para empezar desde cero usa el preset{" "}
									<strong className="text-white">«Sistema en blanco»</strong>.
								</p>
							</div>

							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									Cómo usarlo
								</h3>
								<ol className="list-decimal pl-5 space-y-1 text-slate-400">
									<li>
										Elige un punto de partida en el panel izquierdo: un
										ejemplo precargado o{" "}
										<strong className="text-white">«Sistema en blanco»</strong>{" "}
										si quieres construir todo a mano.
									</li>
									<li>
										Usa el botón{" "}
										<strong className="text-white">«Añadir»</strong> en el
										panel de variables de entrada para agregar cuantas variables
										necesites (1, 2, 3, … sin límite). Cada variable se puede{" "}
										<strong className="text-white">renombrar</strong>, ajustarle
										el <strong className="text-white">rango</strong> y la{" "}
										<strong className="text-white">unidad</strong>.
									</li>
									<li>
										Expande cualquier variable (entrada o salida) para editar
										sus <strong className="text-white">conjuntos difusos</strong>:
										nombre, tipo (triangular ▲ / trapezoidal ⏢) y parámetros.
									</li>
									<li>
										En el panel de reglas, pulsa{" "}
										<strong className="text-white">«Añadir»</strong> para crear
										reglas; cada una puede tener uno o más antecedentes
										conectados con <strong className="text-white">Y (AND)</strong>{" "}
										o <strong className="text-white">O (OR)</strong>.
									</li>
									<li>
										Mueve los <strong className="text-white">sliders</strong>{" "}
										de entrada crisp en el panel principal. Todo se recalcula
										en vivo.
									</li>
									<li>
										Exporta tu sistema completo como JSON para guardarlo o
										compartirlo.
									</li>
								</ol>
							</div>

							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									Pasos del algoritmo (los 3 paneles principales)
								</h3>
								<div className="space-y-2.5 text-slate-400">
									<div className="pl-3 border-l-2 border-indigo-500/40">
										<strong className="text-white">Paso 1 · Fuzzificación.</strong>{" "}
										Para cada variable de entrada, se evalúa el valor crisp x₀
										en cada función de membresía μ<sub>A</sub>(x). El resultado
										es un grado de pertenencia en [0, 1] para cada conjunto.
										La línea blanca punteada marca x₀.
									</div>
									<div className="pl-3 border-l-2 border-indigo-500/40">
										<strong className="text-white">Paso 2 · Evaluación.</strong>{" "}
										Cada regla calcula su fuerza de disparo α<sub>i</sub>:
										<ul className="list-disc pl-5 mt-1 space-y-0.5">
											<li>
												AND → α<sub>i</sub> = mín(μ<sub>antecedentes</sub>)
											</li>
											<li>
												OR → α<sub>i</sub> = máx(μ<sub>antecedentes</sub>)
											</li>
										</ul>
									</div>
									<div className="pl-3 border-l-2 border-indigo-500/40">
										<strong className="text-white">
											Paso 3 · Agregación y defuzzificación.
										</strong>{" "}
										El consecuente de cada regla se{" "}
										<em>recorta</em> a la altura α<sub>i</sub> (operación min).
										Todos los consecuentes recortados se{" "}
										<em>agregan</em> con el máximo punto a punto. Finalmente,
										el centroide de esa figura es la salida nítida z*.
									</div>
								</div>
							</div>

							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									Tipos de funciones de membresía
								</h3>
								<ul className="list-disc pl-5 space-y-1 text-slate-400">
									<li>
										<strong className="text-white">Triangular [a, b, c]:</strong>{" "}
										sube de a hasta el pico b, baja hasta c.
									</li>
									<li>
										<strong className="text-white">
											Trapezoidal [a, b, c, d]:
										</strong>{" "}
										sube de a a b, plano en 1 entre b y c, baja de c a d. Útil
										para «cualquier valor cercano a 0» (a=b) o «cualquier valor
										grande» (c=d).
									</li>
								</ul>
							</div>

							<p className="text-xs text-amber-200/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
								💡{" "}
								<em>
									Consejo: empieza siempre con un ejemplo. Cambia primero los
									sliders, después los conjuntos, y por último las reglas. Si
									ninguna regla dispara (α = 0 en todas), la salida no se puede
									defuzzificar — significa que las entradas caen fuera del
									dominio cubierto por las reglas.
								</em>
							</p>
						</div>
						<div className="mt-6 flex justify-end">
							<button
								onClick={() => setShowHelp(false)}
								className="px-5 py-2 bg-slate-200 hover:bg-white text-slate-900 font-medium rounded-lg transition-colors"
							>
								Entendido
							</button>
						</div>
					</div>
				</div>
			)}
		</Layout>
	);
};

// ════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: VARIABLE EDITOR (collapsible)
// ════════════════════════════════════════════════════════════════════════

interface VariableEditorProps {
	variable: FuzzyVariable;
	expanded: boolean;
	onToggle: () => void;
	onUpdate: (patch: Partial<FuzzyVariable>) => void;
	onUpdateSet: (setId: string, patch: Partial<FuzzySet>) => void;
	onAddSet: () => void;
	onRemoveSet: (setId: string) => void;
	onDelete?: () => void;
}

const VariableEditor = ({
	variable,
	expanded,
	onToggle,
	onUpdate,
	onUpdateSet,
	onAddSet,
	onRemoveSet,
	onDelete,
}: VariableEditorProps) => {
	return (
		<div className="bg-slate-900/60 border border-slate-700/50 rounded-lg flex flex-col">
			<div className="flex items-stretch">
				<button
					onClick={onToggle}
					className="flex-1 px-3 py-2 flex items-center gap-2 text-sm font-medium text-slate-200 hover:bg-slate-800/40 rounded-l-lg transition-colors min-w-0"
				>
					{expanded ? (
						<ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
					) : (
						<ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
					)}
					<span className="flex-1 text-left truncate">{variable.name}</span>
					<span className="text-xs text-slate-500 flex-shrink-0">
						[{variable.min}, {variable.max}]
						{variable.unit ? ` ${variable.unit}` : ""}
					</span>
					<span className="text-xs text-indigo-300 font-mono flex-shrink-0">
						{variable.sets.length}
					</span>
				</button>
				{onDelete && (
					<button
						onClick={onDelete}
						className="px-2.5 text-red-400 hover:bg-red-900/30 hover:text-red-300 rounded-r-lg transition-colors flex items-center"
						title="Eliminar variable"
					>
						<Trash2 size={13} />
					</button>
				)}
			</div>
			{expanded && (
				<div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2">
					{/* Variable settings */}
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="text-xs text-slate-500 block mb-0.5">Nombre</label>
							<input
								type="text"
								value={variable.name}
								onChange={(e) => onUpdate({ name: e.target.value })}
								className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs"
							/>
						</div>
						<div>
							<label className="text-xs text-slate-500 block mb-0.5">Unidad</label>
							<input
								type="text"
								value={variable.unit}
								onChange={(e) => onUpdate({ unit: e.target.value })}
								className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs"
							/>
						</div>
						<div>
							<label className="text-xs text-slate-500 block mb-0.5">Mín</label>
							<input
								type="number"
								value={variable.min}
								onChange={(e) =>
									onUpdate({ min: parseFloat(e.target.value) || 0 })
								}
								className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs"
							/>
						</div>
						<div>
							<label className="text-xs text-slate-500 block mb-0.5">Máx</label>
							<input
								type="number"
								value={variable.max}
								onChange={(e) =>
									onUpdate({ max: parseFloat(e.target.value) || 0 })
								}
								className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs"
							/>
						</div>
					</div>

					{/* Fuzzy sets */}
					<div className="space-y-1.5 mt-2">
						<div className="flex items-center justify-between">
							<span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
								Conjuntos difusos
							</span>
							<button
								onClick={onAddSet}
								className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
							>
								<Plus size={11} />
								Añadir
							</button>
						</div>
						{variable.sets.map((set, i) => {
							const hue = setHue(i, variable.sets.length);
							return (
								<div
									key={set.id}
									className="bg-slate-950/40 border rounded p-2 space-y-1.5"
									style={{ borderColor: `hsl(${hue} 50% 40% / 0.3)` }}
								>
									<div className="flex items-center gap-1.5">
										<span
											className="w-2 h-2 rounded-full flex-shrink-0"
											style={{ background: `hsl(${hue} 70% 60%)` }}
										/>
										<input
											type="text"
											value={set.name}
											onChange={(e) =>
												onUpdateSet(set.id, { name: e.target.value })
											}
											className="flex-1 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-xs font-medium"
										/>
										<select
											value={set.type}
											onChange={(e) => {
												const newType = e.target.value as MFType;
												const mid = (variable.min + variable.max) / 2;
												const span = (variable.max - variable.min) * 0.25;
												const newParams =
													newType === "triangular"
														? [mid - span, mid, mid + span]
														: [
																mid - span,
																mid - span * 0.4,
																mid + span * 0.4,
																mid + span,
															];
												onUpdateSet(set.id, {
													type: newType,
													params: newParams,
												});
											}}
											className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
										>
											<option value="triangular">▲</option>
											<option value="trapezoidal">⏢</option>
										</select>
										<button
											onClick={() => onRemoveSet(set.id)}
											className="text-red-400 hover:text-red-300 p-0.5"
										>
											<Trash2 size={11} />
										</button>
									</div>
									<div className="grid grid-cols-4 gap-1">
										{set.params.map((p, idx) => (
											<input
												key={idx}
												type="number"
												step={0.1}
												value={p}
												onChange={(e) => {
													const newParams = [...set.params];
													newParams[idx] = parseFloat(e.target.value) || 0;
													onUpdateSet(set.id, { params: newParams });
												}}
												title={
													set.type === "triangular"
														? ["a (inicio)", "b (pico)", "c (final)"][idx]
														: ["a", "b", "c", "d"][idx]
												}
												className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-xs font-mono"
											/>
										))}
										{set.type === "triangular" && <div />}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

// ════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: RULE EDITOR
// ════════════════════════════════════════════════════════════════════════

interface RuleEditorProps {
	rule: FuzzyRule;
	ruleIndex: number;
	firingStrength: number;
	inputVars: FuzzyVariable[];
	outputVar: FuzzyVariable;
	isEditing: boolean;
	onStartEdit: () => void;
	onFinishEdit: () => void;
	onUpdate: (patch: Partial<FuzzyRule>) => void;
	onRemove: () => void;
	onAddAntecedent: () => void;
	onRemoveAntecedent: (idx: number) => void;
	onUpdateAntecedent: (idx: number, patch: Partial<RuleAntecedent>) => void;
	getSetName: (varId: string, setId: string) => string;
}

const RuleEditor = ({
	rule,
	ruleIndex,
	firingStrength,
	inputVars,
	outputVar,
	isEditing,
	onStartEdit,
	onFinishEdit,
	onUpdate,
	onRemove,
	onAddAntecedent,
	onRemoveAntecedent,
	onUpdateAntecedent,
	getSetName,
}: RuleEditorProps) => {
	const active = firingStrength > 0.005;
	const csetIdx = outputVar.sets.findIndex((s) => s.id === rule.consequentSetId);
	const hue = setHue(Math.max(0, csetIdx), outputVar.sets.length);

	if (isEditing) {
		return (
			<div
				className="bg-slate-900/80 border rounded-lg p-2.5 space-y-2"
				style={{ borderColor: "hsl(248 60% 50% / 0.5)" }}
			>
				<div className="flex items-center justify-between mb-1">
					<span className="text-xs font-bold text-indigo-300">
						Editando Regla {ruleIndex + 1}
					</span>
					<div className="flex items-center gap-1">
						<button
							onClick={onFinishEdit}
							className="text-emerald-400 hover:text-emerald-300 p-1"
						>
							<Check size={13} />
						</button>
						<button
							onClick={onRemove}
							className="text-red-400 hover:text-red-300 p-1"
						>
							<Trash2 size={13} />
						</button>
					</div>
				</div>

				<div className="text-xs text-slate-500 font-semibold mb-1">SI</div>
				{rule.antecedents.map((ant, idx) => {
					const v = inputVars.find((vv) => vv.id === ant.variableId);
					return (
						<div key={idx} className="flex items-center gap-1">
							{idx > 0 && (
								<select
									value={rule.connector}
									onChange={(e) =>
										onUpdate({ connector: e.target.value as "AND" | "OR" })
									}
									className="px-1 py-0.5 bg-slate-900 border border-amber-500/40 rounded text-amber-300 text-xs font-bold"
								>
									<option value="AND">Y</option>
									<option value="OR">O</option>
								</select>
							)}
							<select
								value={ant.variableId}
								onChange={(e) => {
									const newVar = inputVars.find((v) => v.id === e.target.value);
									onUpdateAntecedent(idx, {
										variableId: e.target.value,
										setId: newVar?.sets[0]?.id ?? "",
									});
								}}
								className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-xs flex-shrink-0"
							>
								{inputVars.map((vv) => (
									<option key={vv.id} value={vv.id}>
										{vv.name}
									</option>
								))}
							</select>
							<span className="text-xs text-slate-500">es</span>
							<select
								value={ant.setId}
								onChange={(e) =>
									onUpdateAntecedent(idx, { setId: e.target.value })
								}
								className="px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white text-xs flex-1 min-w-0"
							>
								{v?.sets.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))}
							</select>
							{rule.antecedents.length > 1 && (
								<button
									onClick={() => onRemoveAntecedent(idx)}
									className="text-red-400 hover:text-red-300 p-0.5"
								>
									<X size={11} />
								</button>
							)}
						</div>
					);
				})}
				<button
					onClick={onAddAntecedent}
					className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 mt-1"
				>
					<Plus size={11} />
					Añadir antecedente
				</button>

				<div className="text-xs text-slate-500 font-semibold mt-2 mb-1">
					ENTONCES {outputVar.name} es
				</div>
				<select
					value={rule.consequentSetId}
					onChange={(e) => onUpdate({ consequentSetId: e.target.value })}
					className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs"
				>
					{outputVar.sets.map((s) => (
						<option key={s.id} value={s.id}>
							{s.name}
						</option>
					))}
				</select>
			</div>
		);
	}

	return (
		<div
			className="bg-slate-900/60 border rounded-lg p-2 group transition-all"
			style={{
				borderColor: active
					? `hsl(${hue} 60% 45% / 0.4)`
					: "hsl(240 30% 25%)",
				opacity: active ? 1 : 0.7,
			}}
		>
			<div className="flex items-start gap-1.5">
				<span className="text-xs text-slate-500 font-mono font-bold mt-0.5">
					R{ruleIndex + 1}
				</span>
				<div className="text-xs text-slate-300 flex-1 leading-tight font-mono min-w-0">
					<span className="text-indigo-300 font-semibold">SI</span>{" "}
					{rule.antecedents.map((a, i) => (
						<span key={i}>
							{i > 0 && (
								<span className="text-amber-300 font-bold mx-0.5">
									{rule.connector === "AND" ? "Y" : "O"}
								</span>
							)}
							<span>{inputVars.find((v) => v.id === a.variableId)?.name ?? "?"}</span>
							{" es "}
							<span className="text-slate-100 font-semibold">
								{getSetName(a.variableId, a.setId)}
							</span>
						</span>
					))}{" "}
					<span className="text-indigo-300 font-semibold">ENT</span>{" "}
					<span style={{ color: `hsl(${hue} 70% 75%)` }}>
						{outputVar.sets.find((s) => s.id === rule.consequentSetId)?.name ??
							"?"}
					</span>
				</div>
				<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						onClick={onStartEdit}
						className="text-slate-400 hover:text-white p-0.5"
					>
						<Pencil size={10} />
					</button>
					<button
						onClick={onRemove}
						className="text-red-400 hover:text-red-300 p-0.5"
					>
						<Trash2 size={10} />
					</button>
				</div>
			</div>
			<div className="flex items-center gap-2 mt-1">
				<div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
					<div
						className="h-full transition-all rounded-full"
						style={{
							width: `${firingStrength * 100}%`,
							background: `hsl(${hue} 70% 55%)`,
						}}
					/>
				</div>
				<span
					className="text-xs font-mono font-bold flex-shrink-0"
					style={{
						color: active ? `hsl(${hue} 70% 75%)` : "hsl(240 20% 50%)",
					}}
				>
					{firingStrength.toFixed(2)}
				</span>
			</div>
		</div>
	);
};

// ════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: LEGEND ITEM
// ════════════════════════════════════════════════════════════════════════

const LegendItem = ({
	color,
	label,
	dashed,
	filled,
	thick,
}: {
	color: string;
	label: string;
	dashed?: boolean;
	filled?: boolean;
	thick?: boolean;
}) => (
	<div className="flex items-center gap-1.5">
		<svg width={26} height={10}>
			{filled ? (
				<rect width={26} height={10} fill={color} opacity={0.35} stroke={color} />
			) : (
				<line
					x1={0}
					x2={26}
					y1={5}
					y2={5}
					stroke={color}
					strokeWidth={thick ? 3 : 1.5}
					strokeDasharray={dashed ? "3,3" : undefined}
				/>
			)}
		</svg>
		<span className="text-slate-400">{label}</span>
	</div>
);

export default LogicaDifusa;