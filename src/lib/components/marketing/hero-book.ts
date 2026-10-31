// The story printed in the hero's animated book. Each flow is poured into its pages in order, the
// way a typesetter would: a page fills to the foot, a paragraph that doesn't fit carries over to
// the next page, and the last page of a flow stops wherever its text runs out (the Prologue ends
// partway down page 4). Text left over after a flow's last page is dropped.

export type PieceKind = 'open' | 'p' | 'dc' | 'break' | 'end';

export type Piece = {
	kind: PieceKind;
	text: string;
	/** Carries on from the page before, so it isn't indented. */
	cont?: boolean;
	/** Carries on overleaf, so its last line is set full width. */
	runsOn?: boolean;
};

export const isMark = (piece: Piece) => piece.kind === 'break' || piece.kind === 'end';

export function pieceClass(piece: Piece) {
	return [piece.kind, piece.cont && 'cont', piece.runsOn && 'runs-on'].filter(Boolean).join(' ');
}

const open = (text: string): Piece => ({ kind: 'open', text });
const p = (text: string): Piece => ({ kind: 'p', text });

// Page 2, facing the Prologue: a passage from later in the book, as paperbacks often open with.
const TEASER: Piece[] = [
	open(
		'The Meridian came out of the lane with her running lights dark and her hull still ringing from the jump. Below her turned Kesh, a drowned moon under a skin of frozen sea, and above it, where no beacon had any right to be, something was still calling.'
	),
	p(
		'Juno Halley had flown salvage for eleven years. She knew the sound of a dead ship, the slow tick of cooling metal, the hush of air with nowhere left to go. This was not that. This was a voice, patient and precise, repeating the same seven notes.'
	),
	p(
		'“Tell me that’s an echo,” she said, and Ade did not answer, which was its own kind of answer. On the long screen the signal climbed and fell like breath, and the stars behind it seemed, for one unsteady moment, to lean in and listen.'
	),
	p(
		'“Then give me a source. A wreck, a buoy, a drunk on a mining rig with a radio. Anything I can put a name to.”'
	),
	p(
		'Ade had already started the slow pull of the scanners across the ice. He worked the way he always did, shoulders hunched, humming under his breath, and Juno let him. Eleven years had taught her that a quiet bridge was a frightened bridge, and that a frightened crew made the kind of mistakes no salvage contract could ever pay for.'
	)
];

const PROLOGUE: Piece[] = [
	open(
		'Three hundred years before the Meridian, a fleet of glass ships sailed out from the inner worlds to find the edge of the sky. They navigated by song, each pilot singing her ship from star to star, and for a hundred years the songs came back.'
	),
	p(
		'Then one season they did not. The last message from the Glass Armada was seven notes, sent from somewhere past the Lantern Gate, and after that there was nothing at all.'
	),
	p('The inner worlds mourned, and then forgot. The gate was sealed. The songs became stories.'),
	p(
		'Only the pilots who stayed behind kept the songs alive. They sang them in dockside bars and on long night watches, to children who would never sail, and they taught them the one rule every pilot learns first: a song that is answered must be finished.'
	),
	p(
		'And far out in the cold, on a drowned moon nobody visited, something went on singing to itself.'
	),
	p(
		'It sang for three centuries. It sang through the fall of the inner worlds and the rise of the free stations, through wars no one now remembered and treaties no one now kept. It sang to empty space, patient and precise.'
	),
	p(
		'Then, one ordinary morning, a salvage ship came out of the lane with her running lights dark, and something under the ice of Kesh stopped singing, and began, very carefully, to listen.'
	),
	{ kind: 'end', text: '' }
];

// Part One, chapter one: Salvage Rights.
const CHAPTER: Piece[] = [
	{
		kind: 'dc',
		text: 'Salvage law was older than the Armada and simpler than its pilots liked to admit. A ship that stopped singing belonged to whoever found it. Juno had built a life on that one sentence, and on the quiet hours it bought her between wrecks.'
	},
	p(
		'She had read the old reports, the way every salvager read them, late at night and half for luck. None of them mentioned Kesh. None of them mentioned a beacon under the ice. And none of them, she would realise much later, had been written by anyone who came back.'
	),
	p(
		'The beacon did not care about salvage law. It had been waiting a long time for someone to come.'
	),
	p(
		'It reached them on the edge of Kesh space, eleven hours out from Vesper, a thread of sound so faint that the hull had to be listening for it. Ade caught it first. He always did. He had the kind of ear that heard engines dying a week before they died.'
	),
	p('“That isn’t a distress call,” Juno said, though no one had asked her.'),
	p(
		'On the long screen the signal turned over and over, seven notes, never the same twice and never quite different, like a word in a language that had been waiting a very long time for someone to answer it.'
	),
	p(
		'She made him play it back, and then again, and felt the hair rise on her arms. She had heard those notes before, once, as a child on Vesper, sung by an old pilot in a dockside bar who had wept when she reached the end of them and would never say why.'
	),
	p(
		'“Log it,” she said. “Mark it, and plot us a course for the ice. If it’s a wreck, it’s ours. If it isn’t—” She stopped, because she did not know how that sentence ended, and because Ade was already looking at her as if he did.'
	),
	p(
		'By the time they reached Kesh, Ade had run the numbers twice and then a third time, lips moving, the way he did when he did not trust the answer. The beacon was not on the moon. It was inside it, under eleven kilometres of ice, and it had been built by someone who expected to be found.'
	),
	p('“So we leave.”'),
	p(
		'Nobody moved. Outside, the drowned moon turned its white face toward them, slow and incurious, and somewhere beneath the ice the seven notes began again, closer now, as if the voice had heard them talking and wanted to be part of it.'
	),
	p(
		'Juno set down her cup. The coffee had gone cold an hour ago and she had not noticed. “Wake the others,” she said. “Tell them we’re not leaving yet. Tell them to bring the cold suits and the long drill, and tell Pell to stop pretending he can’t hear that signal through the walls.”'
	),
	p(
		'There were rules for this. Juno had written half of them herself, in the years after Tamsin, when the crew needed something firmer than her word. Never answer a signal you cannot name. Never follow a light into the dark. Never trust a map made by the dead.'
	),
	p(
		'She broke the first rule before breakfast. By the second watch she had broken the second, and the third lay open on the chart table between them: a map of dead stars, drawn in a hand that was not quite human, and still faintly warm.'
	),
	p(
		'Ade traced one of its lines with a fingertip and pulled his hand back as if it had stung him. “It’s moving,” he said. The stars on the map were turning, slow as clock hands, wheeling around a point none of them could see, and every turn brought the gate a little closer to the centre.'
	),
	p(
		'Juno did not touch it. She leaned in close instead and read the margin, where someone long dead had written a single line in the old pilots’ script: sing me home.'
	),
	p(
		'The map should not have worked. Half its stars had burned out before the Armada was built, and the rest had wandered so far that no pilot alive could have sung a course between them. Yet when Ade laid it over the live sky, every line held.'
	),
	p(
		'Every one of them pointed inward, toward the gate, and the gate, as if it had been waiting for exactly this, began to open. The light that came through was older than the station, older than the fleet, and it sounded like a choir heard through water.'
	),
	p('“Did you do that?”'),
	p(
		'“I didn’t do anything,” Ade said. “I put a map on a screen.” His voice was steady. His hands were not. Juno watched the gate widen by degrees, slow as a tide, and felt the old fear rise in her, the one she had spent eleven years outrunning.'
	),
	p(
		'She thought of Tamsin, and of the ship that had come back singing. Then she thought of the crew, and the fuel, and the long way home, and found that none of it mattered quite as much as she had always told herself it did.'
	),
	p(
		'“Bring her about,” she said at last. “Slow. Nothing above a whisper on the drives.” The Meridian turned on her axis like a held breath, the drowned moon slid away beneath them, white and blind, and the gate filled the viewport, wide enough now, just, for one small ship.'
	),
	{ kind: 'break', text: '' },
	open(
		'The Lantern Gate had been closed for three centuries. Every chart in the Armada said so, every pilot’s song ended at its edge, and every child on Vesper Station knew the story of the ships that had sailed through and come back singing.'
	),
	p(
		'Juno had never believed the story. She believed in fuel margins and hull integrity and the plain arithmetic of distance. But now, with the gate glowing faint as breath on glass across every screen, she found she was holding very still, as if the light might notice her.'
	),
	p(
		'She keyed the long-range array and listened. Under the hiss of the gate there was the beacon again, seven notes, steady as a heartbeat, and under that something else: a low, slow chord, as if the ships of the old fleet were still out there past the light, holding the last note of a song nobody had ever finished.'
	),
	p('“Captain,” Pell whispered. “The ship is singing.”'),
	p(
		'It was. It came up through the deck plates and the hull ribs and the soles of her boots, a single note, clear and low, and every light on the bridge brightened by a hair, and Juno understood, far too late, that the Meridian had been answering all along.'
	),
	p(
		'Ahead of them the gate opened the rest of the way, all at once, the way an eye opens, and the light came pouring through. It filled the bridge and the corridors and the cold holds full of other people’s wreckage, and it found every one of them. And from somewhere beyond it, very faint and very far away, a second voice began to sing back.'
	)
];

export const FLOWS: { pages: number[]; pieces: Piece[] }[] = [
	{ pages: [2], pieces: TEASER },
	{ pages: [3, 4], pieces: PROLOGUE },
	{ pages: [5, 6, 7, 8, 9, 10, 11], pieces: CHAPTER }
];

export type Fits = (page: number, pieces: Piece[]) => boolean;

/** Lays every flow out with `fits`, which says whether some pieces fit on a page. */
export function layOut(fits: Fits) {
	const layout: Record<number, Piece[]> = {};
	for (const flow of FLOWS) {
		const queue = [...flow.pieces];
		for (const page of flow.pages) {
			const here: Piece[] = (layout[page] = []);
			while (queue.length) {
				const next = queue[0];
				if (fits(page, [...here, next])) {
					here.push(queue.shift()!);
					continue;
				}
				// Split the paragraph after the most words that fit; a mark moves whole.
				if (!isMark(next)) {
					const words = next.text.split(' ');
					const head = (count: number): Piece => ({
						...next,
						text: words.slice(0, count).join(' '),
						runsOn: true
					});
					let low = 0;
					let high = words.length - 1;
					while (low < high) {
						const mid = Math.ceil((low + high) / 2);
						if (fits(page, [...here, head(mid)])) low = mid;
						else high = mid - 1;
					}
					if (low > 0) {
						here.push(head(low));
						queue[0] = {
							kind: next.kind === 'dc' ? 'p' : next.kind,
							text: words.slice(low).join(' '),
							cont: true
						};
					}
				}
				break;
			}
		}
	}
	return layout;
}

/**
 * A word-count stand-in for measuring, for the server render and before the fonts load. It
 * overfills a little, so the first spread only ever loses words below the fold when the measured
 * layout replaces it.
 */
export const roughFits: Fits = (page, pieces) => {
	let words = 0;
	for (const piece of pieces) words += isMark(piece) ? 20 : piece.text.split(' ').length + 4;
	return words <= (page === 5 ? 110 : 205);
};
