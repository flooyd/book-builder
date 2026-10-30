// Pointer dragging for the outline and the corkboard (mouse, pen and touch). A copy of the item
// follows the pointer while the view reorders itself live (the views ask `locate` where the
// pointer is), the window scrolls near its edges, and Esc cancels.

/** Layout position of an element inside `container` (ignores transforms from animations). */
export function layoutRect(element: HTMLElement, container: HTMLElement) {
	const box = container.getBoundingClientRect();
	const top = box.top + element.offsetTop - container.scrollTop;
	const left = box.left + element.offsetLeft - container.scrollLeft;
	return {
		top,
		left,
		midY: top + element.offsetHeight / 2,
		midX: left + element.offsetWidth / 2
	};
}

/** How many of `items` lie before the point along the axis (by their layout midpoints). */
export function indexAt(items: HTMLElement[], container: HTMLElement, at: number, axis: 'x' | 'y') {
	let index = 0;
	for (const item of items) {
		const rect = layoutRect(item, container);
		if ((axis === 'y' ? rect.midY : rect.midX) < at) index++;
	}
	return index;
}

type DragOptions<T> = {
	event: PointerEvent;
	/** The element to copy as the moving ghost (the row or card). */
	item: HTMLElement;
	/** Where the ghost lives: inside the outline, so it keeps the outline's colours. */
	layer: HTMLElement;
	/** Where the pointer would drop the item; null keeps the last place. */
	locate: (x: number, y: number) => T | null;
	/** Same place as last time? Then the view isn't asked to move anything. */
	same: (a: T, b: T) => boolean;
	/** The pointer has moved far enough for this to be a drag, not a click. */
	onstart: () => void;
	onmove: (place: T) => void;
	ondrop: () => void;
	oncancel: () => void;
	/** An element that scrolls sideways (the corkboard), scrolled near its edges too. */
	scroller?: HTMLElement | null;
};

const EDGE = 64;
/** Pixels the pointer moves before a press becomes a drag. */
const SLOP = 5;

export function startDrag<T>(options: DragOptions<T>) {
	const { event, item, layer } = options;
	if (event.button !== 0) return;
	// No text selection or focus change from the press.
	event.preventDefault();

	let x = event.clientX;
	let y = event.clientY;
	let ghost: HTMLElement | null = null;
	let rect: DOMRect;
	let offsetX = 0;
	let offsetY = 0;
	let last: T | null = null;
	let frame = 0;

	function begin() {
		rect = item.getBoundingClientRect();
		offsetX = event.clientX - rect.left;
		offsetY = event.clientY - rect.top;
		ghost = item.cloneNode(true) as HTMLElement;
		// Clones don't carry what was typed into fields.
		const fields = item.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
		ghost
			.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
			.forEach((field, i) => {
				field.value = fields[i]?.value ?? '';
			});
		ghost.removeAttribute('id');
		ghost.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
		ghost.setAttribute('aria-hidden', 'true');
		ghost.classList.add('drag-ghost');
		Object.assign(ghost.style, {
			position: 'fixed',
			left: `${rect.left}px`,
			top: `${rect.top}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			margin: '0',
			zIndex: '60',
			pointerEvents: 'none'
		});
		layer.append(ghost);
		document.documentElement.classList.add('outline-dragging');
		options.onstart();
		frame = requestAnimationFrame(tick);
	}

	function update() {
		if (!ghost) return;
		ghost.style.transform = `translate(${x - offsetX - rect.left}px, ${y - offsetY - rect.top}px) rotate(-1deg)`;
		const place = options.locate(x, y);
		if (place && !(last && options.same(last, place))) {
			last = place;
			options.onmove(place);
		}
	}

	// Scroll while the pointer rests near an edge.
	function tick() {
		let scrolled = false;
		const speed = (distance: number) => Math.ceil(((EDGE - Math.max(0, distance)) / EDGE) * 18);
		if (y < EDGE) {
			scrollBy(0, -speed(y));
			scrolled = true;
		} else if (y > innerHeight - EDGE) {
			scrollBy(0, speed(innerHeight - y));
			scrolled = true;
		}
		const scroller = options.scroller;
		if (scroller) {
			const box = scroller.getBoundingClientRect();
			if (y > box.top && y < box.bottom) {
				if (x < box.left + EDGE) {
					scroller.scrollLeft -= speed(x - box.left);
					scrolled = true;
				} else if (x > box.right - EDGE) {
					scroller.scrollLeft += speed(box.right - x);
					scrolled = true;
				}
			}
		}
		if (scrolled) update();
		frame = requestAnimationFrame(tick);
	}

	const onmove = (e: PointerEvent) => {
		if (e.pointerId !== event.pointerId) return;
		x = e.clientX;
		y = e.clientY;
		if (!ghost) {
			if (Math.hypot(x - event.clientX, y - event.clientY) < SLOP) return;
			begin();
		}
		update();
	};
	const onup = (e: PointerEvent) => {
		if (e.pointerId === event.pointerId) finish(true);
	};
	const oncancel = (e: PointerEvent) => {
		if (e.pointerId === event.pointerId) finish(false);
	};
	const onkey = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && ghost) {
			e.preventDefault();
			finish(false);
		}
	};

	// On the window, not the handle: moving a chapter to another part re-creates its element.
	addEventListener('pointermove', onmove);
	addEventListener('pointerup', onup);
	addEventListener('pointercancel', oncancel);
	addEventListener('keydown', onkey, true);

	function finish(drop: boolean) {
		removeEventListener('pointermove', onmove);
		removeEventListener('pointerup', onup);
		removeEventListener('pointercancel', oncancel);
		removeEventListener('keydown', onkey, true);
		if (!ghost) return; // a click, not a drag
		cancelAnimationFrame(frame);
		ghost.remove();
		document.documentElement.classList.remove('outline-dragging');
		if (drop) options.ondrop();
		else options.oncancel();
	}
}
