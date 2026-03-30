// Created by James David

export interface CanvasPathStyle {
	strokeColor?: string;
	fillColor?: string;
	lineWidth?: number;
	lineDash?: number[];
}

const pathKeys: Record<string, keyof CanvasRenderingContext2D> = {
	M: 'moveTo',
	L: 'lineTo',
	C: 'bezierCurveTo',
	Z: 'closePath',
};

/** Parse SVG path strings into tokens for {@link drawCanvasPath} (avoids naive split/join bugs). */
export function svgPathStringToDrawArray(path: string): (string | number)[] {
	const out: (string | number)[] = [];
	if (!path.trim()) return out;
	const spaced = path
		.replace(/([MLCZ])/gi, ' $1 ')
		.replace(/,/g, ' ')
		.trim();
	const parts = spaced.split(/\s+/).filter((p) => p.length > 0);
	for (const p of parts) {
		if (/^[MLCZ]$/i.test(p)) {
			out.push(p.toUpperCase());
		} else {
			const n = parseFloat(p);
			if (!Number.isNaN(n)) out.push(n);
		}
	}
	return out;
}

function argsCountForPathFunc(func: keyof CanvasRenderingContext2D): number {
	switch (func) {
		case 'moveTo':
		case 'lineTo':
			return 2;
		case 'bezierCurveTo':
			return 6;
		case 'closePath':
			return 0;
		default:
			return -1;
	}
}

export function drawCanvasPath(
	ctx: CanvasRenderingContext2D,
	d: (string | number)[],
	style: CanvasPathStyle,
): void {
	const defaultOptions = {
		strokeColor: 'transparent',
		fillColor: 'transparent',
		lineWidth: 1,
		lineDash: [] as number[],
	};

	const merged = { ...defaultOptions, ...style };

	const all: { func: keyof CanvasRenderingContext2D; vals: number[] }[] = [];
	let obj: { func: keyof CanvasRenderingContext2D; vals: number[] } = {
		func: 'moveTo',
		vals: [],
	};

	for (let i = 0; i < d.length; i++) {
		const val = d[i];

		if (typeof val === 'string' && val in pathKeys) {
			if (i > 0) {
				all.push(obj);
			}
			obj = { func: pathKeys[val]!, vals: [] };
		} else if (typeof val === 'number') {
			obj.vals.push(val);
		}

		if (i === d.length - 1) {
			all.push(obj);
		}
	}

	ctx.beginPath();
	ctx.lineWidth = merged.lineWidth;
	ctx.setLineDash(merged.lineDash);
	ctx.strokeStyle = merged.strokeColor;
	ctx.fillStyle = merged.fillColor;

	for (const loop of all) {
		const need = argsCountForPathFunc(loop.func);
		if (need >= 0 && loop.vals.length !== need) continue;
		const ctxFunc = ctx[loop.func] as (...a: number[]) => void;
		ctxFunc.apply(ctx, loop.vals);
	}

	ctx.fill();
	ctx.stroke();
}
