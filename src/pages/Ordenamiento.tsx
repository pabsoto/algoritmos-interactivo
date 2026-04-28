import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { Play, RotateCcw, Shuffle, HelpCircle, X } from "lucide-react";

type SortAlg = "selection" | "insertion" | "merge";

const algoLabel: Record<SortAlg, string> = {
	selection: "Selección",
	insertion: "Inserción",
	merge: "Merge",
};

const algoDesc: Record<SortAlg, string> = {
	selection:
		"Busca el elemento mínimo del subarreglo no ordenado y lo coloca al inicio mediante un intercambio. Repite n-1 veces. Complejidad: O(n²) en todos los casos.",
	insertion:
		"Construye el subarreglo ordenado uno a uno. Toma cada elemento y lo inserta en su posición correcta desplazando los mayores. Complejidad: O(n²) promedio, O(n) mejor caso.",
	merge:
		"Divide el arreglo en mitades recursivamente, ordena cada mitad y las fusiona comparando elemento a elemento. Complejidad garantizada: O(n log n).",
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns hue in [180, 280]: 180 = cyan, 280 = purple */
const valueHue = (value: number, min: number, max: number) => {
	const t = max > min ? (value - min) / (max - min) : 0.5;
	return Math.round(180 + t * 100);
};



// ── Component ──────────────────────────────────────────────────────────────

const Ordenamiento = () => {
	const [array, setArray] = useState<number[]>([]);
	const [displayArray, setDisplayArray] = useState<number[]>([]);

	const [comparing, setComparing] = useState<number[]>([]);
	const [swapping, setSwapping] = useState<number[]>([]);
	const [minHighlight, setMinHighlight] = useState<number | null>(null);
	const [keyHighlight, setKeyHighlight] = useState<number | null>(null);
	const [sortedSet, setSortedSet] = useState<Set<number>>(new Set());
	const [mergeRange, setMergeRange] = useState<[number, number] | null>(null);

	const [algorithm, setAlgorithm] = useState<SortAlg>("selection");
	const [speed, setSpeed] = useState(50);
	const [isSorting, setIsSorting] = useState(false);
	const [statusMsg, setStatusMsg] = useState(
		"Genera un arreglo y presiona Iniciar.",
	);

	const [inputMode, setInputMode] = useState<"random" | "manual">("random");
	// String state so the input field is freely editable (no parse-on-empty bugs)
	const [randomCountStr, setRandomCountStr] = useState("20");
	const [randomMinStr, setRandomMinStr] = useState("1");
	const [randomMaxStr, setRandomMaxStr] = useState("99");
	const [manualInput, setManualInput] = useState("");
	const [inputError, setInputError] = useState("");
	const [showHelp, setShowHelp] = useState(false);

	const cancelRef = useRef({ cancelled: false });
	const speedRef = useRef(speed);
	const vizRef = useRef<HTMLDivElement>(null);
	const [vizWidth, setVizWidth] = useState(600);
	useEffect(() => { speedRef.current = speed; }, [speed]);

	// Measure visualization container width
	useEffect(() => {
		const measure = () => {
			if (vizRef.current) setVizWidth(vizRef.current.clientWidth);
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, []);

	const delay = () =>
		new Promise<void>((r) =>
			setTimeout(r, Math.max(8, (101 - speedRef.current) * 2)),
		);

	const resetHighlights = () => {
		setComparing([]);
		setSwapping([]);
		setMinHighlight(null);
		setKeyHighlight(null);
		setSortedSet(new Set());
		setMergeRange(null);
	};

	const generateRandom = () => {
		if (isSorting) return;
		const count = Math.min(60, Math.max(2, parseInt(randomCountStr) || 20));
		const lo = Math.max(1, parseInt(randomMinStr) || 1);
		const hi = Math.max(lo, parseInt(randomMaxStr) || 99);
		const range = hi - lo + 1;
		const arr = Array.from(
			{ length: count },
			() => Math.floor(Math.random() * range) + lo,
		);
		setArray(arr);
		setDisplayArray(arr);
		resetHighlights();
		setStatusMsg(
			`Arreglo de ${count} elementos generado. Presiona Iniciar para ordenar.`,
		);
	};

	const applyManual = () => {
		if (isSorting) return;
		const parts = manualInput.split(/[\s,;]+/).filter(Boolean);
		const nums = parts.map((p) => parseInt(p, 10));
		if (!nums.length || nums.some(isNaN)) {
			setInputError("Ingresa solo números separados por comas o espacios.");
			return;
		}
		if (nums.length > 60) {
			setInputError("Máximo 60 elementos.");
			return;
		}
		const clamped = nums.map((n) => Math.min(999, Math.max(1, Math.abs(n))));
		setArray(clamped);
		setDisplayArray(clamped);
		setInputError("");
		resetHighlights();
		setStatusMsg(`Arreglo de ${clamped.length} elementos cargado.`);
	};

	const resetSort = () => {
		cancelRef.current.cancelled = true;
		setIsSorting(false);
		setDisplayArray([...array]);
		resetHighlights();
		setStatusMsg("Reiniciado. Presiona Iniciar para volver a ordenar.");
	};

	useEffect(() => {
		generateRandom();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// ── SELECTION SORT ────────────────────────────────────────────────────────
	const runSelection = async (arr: number[], tok: { cancelled: boolean }) => {
		const n = arr.length;
		for (let i = 0; i < n - 1; i++) {
			if (tok.cancelled) return;
			let minIdx = i;
			setMinHighlight(i);
			setStatusMsg(`Pasada ${i + 1}: buscando mínimo desde posición ${i}`);
			for (let j = i + 1; j < n; j++) {
				if (tok.cancelled) return;
				setComparing([j]);
				if (arr[j] < arr[minIdx]) {
					minIdx = j;
					setMinHighlight(minIdx);
				}
				await delay();
			}
			if (minIdx !== i) {
				setSwapping([i, minIdx]);
				setStatusMsg(`Intercambiando ${arr[i]} ↔ ${arr[minIdx]}`);
				[arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
				setDisplayArray([...arr]);
				await delay();
			}
			setSortedSet((prev) => new Set([...prev, i]));
			setMinHighlight(null);
			setComparing([]);
			setSwapping([]);
		}
		setSortedSet(new Set(arr.map((_, i) => i)));
		setStatusMsg("¡Ordenamiento por Selección completado!");
	};

	// ── INSERTION SORT ────────────────────────────────────────────────────────
	const runInsertion = async (arr: number[], tok: { cancelled: boolean }) => {
		const n = arr.length;
		setSortedSet(new Set([0]));
		for (let i = 1; i < n; i++) {
			if (tok.cancelled) return;
			const key = arr[i];
			setKeyHighlight(i);
			setStatusMsg(`Insertando ${key} en su posición correcta…`);
			await delay();
			let j = i - 1;
			while (j >= 0 && arr[j] > key) {
				if (tok.cancelled) return;
				setComparing([j, j + 1]);
				setStatusMsg(`${arr[j]} > ${key}: desplazando ${arr[j]} a la derecha`);
				arr[j + 1] = arr[j];
				setDisplayArray([...arr]);
				await delay();
				j--;
			}
			arr[j + 1] = key;
			setDisplayArray([...arr]);
			setSortedSet(new Set(Array.from({ length: i + 1 }, (_, k) => k)));
			setKeyHighlight(null);
			setComparing([]);
			setStatusMsg(`${key} insertado en posición ${j + 1}`);
			await delay();
		}
		setSortedSet(new Set(arr.map((_, i) => i)));
		setStatusMsg("¡Ordenamiento por Inserción completado!");
	};

	// ── MERGE SORT ────────────────────────────────────────────────────────────
	const runMerge = async (arr: number[], tok: { cancelled: boolean }) => {
		const mergeFn = async (left: number, mid: number, right: number) => {
			if (tok.cancelled) return;
			const L = arr.slice(left, mid + 1);
			const R = arr.slice(mid + 1, right + 1);
			setMergeRange([left, right]);
			setStatusMsg(`Fusionando [${left}…${mid}] con [${mid + 1}…${right}]`);
			let i = 0,
				j = 0,
				k = left;
			while (i < L.length && j < R.length) {
				if (tok.cancelled) return;
				setComparing([left + i, mid + 1 + j]);
				setStatusMsg(
					`Comparando ${L[i]} y ${R[j]}: colocando ${L[i] <= R[j] ? L[i] : R[j]}`,
				);
				await delay();
				if (L[i] <= R[j]) arr[k++] = L[i++];
				else arr[k++] = R[j++];
				setDisplayArray([...arr]);
			}
			while (i < L.length) {
				if (tok.cancelled) return;
				arr[k++] = L[i++];
				setDisplayArray([...arr]);
				setComparing([k - 1]);
				await delay();
			}
			while (j < R.length) {
				if (tok.cancelled) return;
				arr[k++] = R[j++];
				setDisplayArray([...arr]);
				setComparing([k - 1]);
				await delay();
			}
			setSortedSet((prev) => {
				const s = new Set(prev);
				for (let x = left; x <= right; x++) s.add(x);
				return s;
			});
			setMergeRange(null);
			setComparing([]);
		};

		const sortFn = async (left: number, right: number) => {
			if (tok.cancelled || left >= right) return;
			const mid = Math.floor((left + right) / 2);
			setStatusMsg(
				`Dividiendo [${left}…${right}] → [${left}…${mid}] y [${mid + 1}…${right}]`,
			);
			await delay();
			await sortFn(left, mid);
			await sortFn(mid + 1, right);
			await mergeFn(left, mid, right);
		};

		await sortFn(0, arr.length - 1);
		if (!tok.cancelled) {
			setSortedSet(new Set(arr.map((_, i) => i)));
			setMergeRange(null);
			setComparing([]);
			setStatusMsg("¡Ordenamiento por Mezcla completado!");
		}
	};

	// ── START ─────────────────────────────────────────────────────────────────
	const startSorting = async () => {
		if (isSorting || !array.length) return;
		const tok = { cancelled: false };
		cancelRef.current = tok;
		const arr = [...array];
		setDisplayArray(arr);
		resetHighlights();
		setIsSorting(true);
		try {
			if (algorithm === "selection") await runSelection(arr, tok);
			else if (algorithm === "insertion") await runInsertion(arr, tok);
			else await runMerge(arr, tok);
		} finally {
			if (!tok.cancelled) setIsSorting(false);
		}
	};

	// ── VISUALS ───────────────────────────────────────────────────────────────

	const minVal = displayArray.length ? Math.min(...displayArray) : 1;
	const maxVal = displayArray.length ? Math.max(...displayArray) : 99;

	// Compute per-box sizes proportional to their values, fitting in one row
	const gap = 4; // px gap between boxes
	const padding = 40; // container horizontal padding (p-5 = 20px each side)
	const n = displayArray.length || 1;
	const availableWidth = vizWidth - padding - gap * Math.max(0, n - 1);
	const sumValues = displayArray.reduce((s, v) => s + v, 0) || 1;
	const boxSizes = displayArray.map((v) => Math.max(8, Math.floor((v / sumValues) * availableWidth)));

	type Colors = { bg: string; border: string; text: string; glow?: string };

	const getColors = (idx: number, value: number): Colors => {
		const hue = valueHue(value, minVal, maxVal);
		const inMerge = mergeRange && idx >= mergeRange[0] && idx <= mergeRange[1];
		const isSorted = sortedSet.has(idx);

		// Fixed-color overrides for active operations
		if (swapping.includes(idx))
			return {
				bg: "hsl(25 100% 32%/0.9)",
				border: "hsl(25 100% 58%)",
				text: "hsl(25 100% 94%)",
				glow: "0 0 18px hsl(25 100% 54%/0.8)",
			};
		if (keyHighlight === idx)
			return {
				bg: "hsl(325 90% 36%/0.9)",
				border: "hsl(325 90% 62%)",
				text: "hsl(325 90% 94%)",
				glow: "0 0 18px hsl(325 90% 58%/0.75)",
			};
		if (minHighlight === idx)
			return {
				bg: "hsl(50 100% 30%/0.9)",
				border: "hsl(50 100% 55%)",
				text: "hsl(50 100% 94%)",
				glow: "0 0 18px hsl(50 100% 52%/0.75)",
			};

		// Comparing: element's own hue, maximally bright so any hue pops
		if (comparing.includes(idx))
			return {
				bg: `hsl(${hue} 85% 40%/0.92)`,
				border: `hsl(${hue} 90% 78%)`,
				text: "hsl(0 0% 100%)",
				glow: `0 0 18px hsl(${hue} 85% 68%/0.85)`,
			};

		// Merge active range: value color, moderately bright
		if (inMerge)
			return {
				bg: `hsl(${hue} 75% 32%/0.82)`,
				border: `hsl(${hue} 80% 58%)`,
				text: `hsl(${hue} 40% 90%)`,
			};

		// Sorted: value color, full brightness → gradient appears on completion
		if (isSorted)
			return {
				bg: `hsl(${hue} 72% 28%/0.85)`,
				border: `hsl(${hue} 80% 55%)`,
				text: `hsl(${hue} 40% 90%)`,
			};

		// Unsorted: same hue but dimmer
		return {
			bg: `hsl(${hue} 55% 18%/0.7)`,
			border: `hsl(${hue} 55% 36%)`,
			text: `hsl(${hue} 30% 70%)`,
		};
	};

	return (
		<Layout>
			<div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-10 px-6">
				{/* ── HEADER BAR ─────────────────────────────────────────────────── */}
				<div className="w-full bg-slate-900 border-b border-slate-700 -mx-6 -mt-10 mb-6">
					<div className="max-w-7xl mx-auto w-full px-6 py-4 flex justify-between items-center">
						<div>
							<h1 className="text-xl font-bold text-white">
								Visualizador de Ordenamiento
							</h1>
							<p className="text-xs text-slate-400 mt-0.5">
								Selección - Inserción - Merge
							</p>
						</div>
						<div className="flex items-center gap-3">
							<button
								onClick={resetSort}
								disabled={!array.length}
								className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 rounded-md transition-all hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
							>
								<RotateCcw size={15} />
								Reiniciar
							</button>
							<button
								onClick={startSorting}
								disabled={isSorting || !array.length}
								className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
								style={{
									background:
										"linear-gradient(135deg, hsl(248 70% 55%), hsl(200 90% 48%))",
								}}
							>
								<Play size={15} />
								{isSorting ? "Ordenando…" : "Iniciar"}
							</button>
						</div>
					</div>
				</div>

				<div className="max-w-7xl mx-auto flex gap-6">
					{/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
					<aside className="w-72 flex-shrink-0 space-y-4">
						{/* Algorithm selector */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
								Algoritmo
							</h2>
							<div className="space-y-1.5">
								{(["selection", "insertion", "merge"] as SortAlg[]).map(
									(alg) => (
										<button
											key={alg}
											onClick={() => {
												if (!isSorting) {
													setAlgorithm(alg);
													resetHighlights();
													setDisplayArray([...array]);
													setStatusMsg(
														"Algoritmo cambiado. Presiona Iniciar para ordenar.",
													);
												}
											}}
											disabled={isSorting}
											className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
											style={{
												background:
													algorithm === alg
														? "hsl(248 70% 44%/0.35)"
														: "transparent",
												border: `1px solid ${algorithm === alg ? "hsl(248 70% 58%/0.5)" : "transparent"}`,
												color:
													algorithm === alg
														? "hsl(248 80% 88%)"
														: "hsl(240 20% 62%)",
											}}
										>
											<span
												className="w-1.5 h-1.5 rounded-full flex-shrink-0"
												style={{
													background:
														algorithm === alg
															? "hsl(248 80% 72%)"
															: "hsl(240 20% 42%)",
												}}
											/>
											Ordenamiento por {algoLabel[alg]}
										</button>
									),
								)}
							</div>
						</div>

						{/* Speed */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
								Velocidad
							</h2>
							<input
								type="range"
								min={1}
								max={100}
								value={speed}
								onChange={(e) => setSpeed(parseInt(e.target.value))}
								className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
							/>
							<div className="flex justify-between text-xs text-slate-500 mt-1.5">
								<span>Lento</span>
								<span className="font-semibold text-indigo-300">{speed}%</span>
								<span>Rápido</span>
							</div>
						</div>

						{/* Array input */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
								Arreglo
							</h2>
							<div className="flex rounded-lg overflow-hidden border border-slate-700 mb-4">
								{(["random", "manual"] as const).map((mode) => (
									<button
										key={mode}
										onClick={() => !isSorting && setInputMode(mode)}
										disabled={isSorting}
										className="flex-1 py-1.5 text-xs font-semibold transition-all"
										style={{
											background:
												inputMode === mode
													? "hsl(248 60% 40%/0.5)"
													: "transparent",
											color:
												inputMode === mode
													? "hsl(248 80% 88%)"
													: "hsl(240 20% 55%)",
										}}
									>
										{mode === "random" ? "Aleatorio" : "Manual"}
									</button>
								))}
							</div>

							{inputMode === "random" ? (
								<div className="space-y-3">
									<div>
										<label className="text-xs text-slate-400 block mb-1.5">
											Cantidad de elementos
										</label>
										<input
											type="number"
											min={2}
											max={60}
											value={randomCountStr}
											onChange={(e) => setRandomCountStr(e.target.value)}
											onBlur={(e) => {
												const v = parseInt(e.target.value);
												if (isNaN(v)) setRandomCountStr("20");
												else
													setRandomCountStr(
														String(Math.min(60, Math.max(2, v))),
													);
											}}
											disabled={isSorting}
											className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
										/>
										<p className="text-xs text-slate-600 mt-1">
											Mín: 2 · Máx: 60 · Por defecto: 20
										</p>
									</div>
									<div className="flex gap-2">
										<div className="flex-1">
											<label className="text-xs text-slate-400 block mb-1.5">Valor mínimo</label>
											<input
												type="number"
												min={1}
												value={randomMinStr}
												onChange={(e) => setRandomMinStr(e.target.value)}
												onBlur={(e) => {
													const v = parseInt(e.target.value);
													if (isNaN(v)) setRandomMinStr("1");
													else setRandomMinStr(String(Math.max(1, v)));
												}}
												disabled={isSorting}
												className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
											/>
										</div>
										<div className="flex-1">
											<label className="text-xs text-slate-400 block mb-1.5">Valor máximo</label>
											<input
												type="number"
												min={1}
												value={randomMaxStr}
												onChange={(e) => setRandomMaxStr(e.target.value)}
												onBlur={(e) => {
													const v = parseInt(e.target.value);
													if (isNaN(v)) setRandomMaxStr("99");
													else setRandomMaxStr(String(Math.max(1, v)));
												}}
												disabled={isSorting}
												className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
											/>
										</div>
									</div>
									<button
										onClick={generateRandom}
										disabled={isSorting}
										className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
										style={{
											background: "hsl(200 75% 36%/0.75)",
											border: "1px solid hsl(200 75% 50%/0.4)",
										}}
									>
										<Shuffle size={14} />
										Generar Arreglo
									</button>
								</div>
							) : (
								<div className="space-y-3">
									<div>
										<label className="text-xs text-slate-400 block mb-1.5">
											Números separados por comas
										</label>
										<textarea
											value={manualInput}
											onChange={(e) => setManualInput(e.target.value)}
											disabled={isSorting}
											placeholder="ej: 42, 15, 7, 23, 8, 34"
											className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
											rows={3}
										/>
										{inputError && (
											<p className="text-xs text-red-400 mt-1">{inputError}</p>
										)}
									</div>
									<button
										onClick={applyManual}
										disabled={isSorting}
										className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
										style={{
											background: "hsl(200 75% 36%/0.75)",
											border: "1px solid hsl(200 75% 50%/0.4)",
										}}
									>
										Aplicar Arreglo
									</button>
								</div>
							)}
						</div>

						{/* Legend */}
						<div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
							<h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
								Leyenda
							</h2>
							<div className="space-y-2.5">
								{/* Gradient strip */}
								<div>
									<div
										className="h-4 w-full rounded-sm mb-1"
										style={{
											background:
												"linear-gradient(to right, hsl(180 80% 40%), hsl(280 80% 50%))",
										}}
									/>
									<p className="text-xs text-slate-400">
										Color por valor: cian (bajo) → morado (alto)
									</p>
								</div>
								<div className="border-t border-slate-700/60 pt-2 space-y-2">
									{[
										{
											color: "hsl(200 85% 42%)",
											label: "Comparando (brillo del color del elemento)",
										},
										{
											color: "hsl(50 100% 48%)",
											label: "Mínimo actual (Selección)",
										},
										{
											color: "hsl(325 90% 48%)",
											label: "Elemento clave (Inserción)",
										},
										{ color: "hsl(25 100% 48%)", label: "Intercambiando" },
									].map(({ color, label }) => (
										<div key={label} className="flex items-center gap-2.5">
											<div
												className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
												style={{ background: color }}
											/>
											<span className="text-xs text-slate-400 leading-tight">
												{label}
											</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</aside>

					{/* ── MAIN AREA ──────────────────────────────────────────────────── */}
					<div className="flex-1 min-w-0 flex flex-col gap-4">
						{/* Status bar */}
						<div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-3 flex items-center gap-3">
							<span
								className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
								style={{
									background: isSorting
										? "hsl(150 80% 50%)"
										: "hsl(240 30% 48%)",
									boxShadow: isSorting
										? "0 0 8px hsl(150 80% 50%/0.7)"
										: "none",
								}}
							/>
							<p className="text-sm text-slate-300 font-mono leading-tight">
								{statusMsg}
							</p>
						</div>

						{/* Visualization */}
						<div
							ref={vizRef}
							className="border border-slate-700/50 rounded-2xl p-5 flex flex-nowrap items-end justify-center min-h-[320px]"
							style={{
								background:
									"radial-gradient(ellipse at 50% 60%, hsl(248 50% 7%) 0%, hsl(248 50% 3%) 100%)",
								gap: `${gap}px`,
							}}
						>
							{displayArray.map((val, idx) => {
								const c = getColors(idx, val);
								const sz = boxSizes[idx];
								// Font size scales with the box size
								const fs = sz < 16 ? 0 : Math.round(Math.min(sz * 0.4, 18));
								return (
									<div
										key={idx}
										className="flex items-center justify-center font-bold transition-all duration-150 select-none flex-shrink-0"
										style={{
											width: sz,
											height: sz,
											fontSize: fs > 0 ? `${fs}px` : "0px",
											background: c.bg,
											border: `2px solid ${c.border}`,
											color: c.text,
											boxShadow: c.glow ?? "none",
										}}
									>
										{fs > 0 ? val : null}
									</div>
								);
							})}
							{!displayArray.length && (
								<p className="text-slate-500 text-sm italic self-center mb-16">
									Genera o ingresa un arreglo para comenzar.
								</p>
							)}
						</div>

						{/* Algorithm info */}
						<div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
							<p className="text-xs font-semibold text-indigo-300 mb-1">
								Ordenamiento por {algoLabel[algorithm]}
							</p>
							<p className="text-xs text-slate-400 leading-relaxed">
								{algoDesc[algorithm]}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* ── FLOATING HELP ─────────────────────────────────────────────────── */}
			<div className="fixed bottom-6 right-6 z-40">
				<button
					onClick={() => setShowHelp(true)}
					className="w-12 h-12 rounded-full border-2 border-slate-400 text-slate-400 flex items-center justify-center bg-transparent backdrop-blur-sm transition-all hover:bg-slate-400 hover:text-slate-900 shadow-lg"
					title="Ver guía de uso"
				>
					<HelpCircle size={24} strokeWidth={2.5} />
				</button>
			</div>

			{/* ── HELP MODAL ────────────────────────────────────────────────────── */}
			{showHelp && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative">
						<button
							onClick={() => setShowHelp(false)}
							className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
						>
							<X size={18} />
						</button>
						<h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
							<HelpCircle size={20} className="text-slate-300" />
							Guía: Algoritmos de Ordenamiento
						</h2>
						<div className="text-sm space-y-4 max-h-[60vh] overflow-y-auto pr-1">
							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									¿Cómo usar el visualizador?
								</h3>
								<ul className="list-disc pl-5 space-y-1 text-slate-400">
									<li>
										Selecciona el{" "}
										<strong className="text-white">algoritmo</strong> en el
										panel izquierdo.
									</li>
									<li>
										Usa modo <strong className="text-white">Aleatorio</strong>{" "}
										para generar números al azar (especifica la cantidad, por
										defecto 20), o{" "}
										<strong className="text-white">Manual</strong> para escribir
										los tuyos separados por comas.
									</li>
									<li>
										Ajusta la <strong className="text-white">velocidad</strong>{" "}
										con el deslizador antes o durante la animación.
									</li>
									<li>
										Presiona <strong className="text-white">Iniciar</strong>{" "}
										para arrancar la visualización paso a paso.
									</li>
									<li>
										Usa <strong className="text-white">Reiniciar</strong> para
										detener y restablecer el arreglo original.
									</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									Visualización de colores
								</h3>
								<p className="text-slate-400">
									Cada cuadro tiene un color según su{" "}
									<strong className="text-white">valor</strong>:{" "}
									<span
										className="font-medium"
										style={{ color: "hsl(180 80% 55%)" }}
									>
										cian
									</span>{" "}
									para valores bajos y{" "}
									<span
										className="font-medium"
										style={{ color: "hsl(280 80% 70%)" }}
									>
										morado
									</span>{" "}
									para valores altos. Cuando el arreglo esté ordenado, los
									colores formarán un gradiente continuo de izquierda a derecha.
									El <strong className="text-white">tamaño</strong> de cada
									cuadro también es proporcional a su valor.
								</p>
							</div>
							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									Ordenamiento por Selección
								</h3>
								<p className="text-slate-400">
									En cada pasada busca el elemento{" "}
									<span className="font-medium text-yellow-400">mínimo</span>{" "}
									del subarreglo no ordenado y lo intercambia (
									<span className="font-medium text-orange-400">naranja</span>)
									con el primer elemento sin ordenar. Siempre{" "}
									<strong className="text-white">O(n²)</strong>.
								</p>
							</div>
							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									Ordenamiento por Inserción
								</h3>
								<p className="text-slate-400">
									Toma cada elemento (
									<span className="font-medium text-pink-400">rosa</span>) y lo
									desplaza hacia la izquierda hasta encontrar su lugar en la
									parte ya ordenada. Muy eficiente con arreglos casi ordenados.{" "}
									<strong className="text-white">O(n²)</strong> promedio.
								</p>
							</div>
							<div>
								<h3 className="font-semibold text-indigo-300 mb-2">
									MergeSort
								</h3>
								<p className="text-slate-400">
									Divide el arreglo recursivamente en mitades, las ordena y
									luego las fusiona comparando elemento a elemento. Complejidad
									garantizada <strong className="text-white">O(n log n)</strong>
									, eficiente con arreglos grandes.
								</p>
							</div>
							<p className="text-xs text-amber-200/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
								💡{" "}
								<em>
									Consejo: para entender cada paso con claridad, usa velocidad
									baja (10–25%) y un arreglo pequeño de 6–10 elementos.
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

export default Ordenamiento;
