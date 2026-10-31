<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import AnimatedBook from './AnimatedBook.svelte';
	import SiteHeader from './SiteHeader.svelte';
	import SiteFooter from './SiteFooter.svelte';
	import { SOON } from './soon';

	// The corkboard picture in "03 — The outline". Statuses are the outline's colours (see .board).
	const board: {
		label: string;
		title: string;
		cards: {
			label: string;
			title: string;
			status: string;
			statusLabel: string;
			lifted?: boolean;
		}[];
	}[] = [
		{
			label: 'Part One',
			title: 'The Drowned Moon',
			cards: [
				{ label: 'Chapter 1', title: 'Salvage Rights', status: 'done', statusLabel: 'Done' },
				{
					label: 'Chapter 2',
					title: 'A Map of Dead Stars',
					status: 'drafting',
					statusLabel: 'Drafting',
					lifted: true
				},
				{ label: 'Chapter 3', title: 'Burn Through', status: 'revising', statusLabel: 'Revising' }
			]
		},
		{
			label: 'Part Two',
			title: 'The Hollow Sun',
			cards: [
				{ label: 'Chapter 4', title: 'Ghostlight', status: 'outlined', statusLabel: 'Outlined' },
				{ label: 'Chapter 5', title: 'The Lantern Gate', status: 'idea', statusLabel: 'Idea' }
			]
		},
		{
			label: 'Story text',
			title: 'Epilogue',
			cards: [{ label: 'Epilogue', title: 'Last Light', status: 'idea', statusLabel: 'Idea' }]
		}
	];

	const GITHUB = 'https://github.com/flooyd/book-builder';

	const homeFor: { label: string; icon: IconName }[] = [
		{ label: 'Books', icon: 'book' },
		{ label: 'Parts', icon: 'layers' },
		{ label: 'Chapters', icon: 'file-text' },
		{ label: 'Characters', icon: 'users' },
		{ label: 'Systems', icon: 'share-2' }
	];

	// The marquee renders this list twice; the track slides by -50% for a seamless loop.
	const marquee: { word: string; outline: boolean; italic?: boolean }[] = [
		{ word: 'Books', outline: false },
		{ word: 'Parts', outline: true },
		{ word: 'Chapters', outline: false },
		{ word: 'Characters', outline: true },
		{ word: 'Systems', outline: false },
		{ word: 'Story Text', outline: true, italic: true }
	];

	const features: { title: string; icon: IconName; body: string }[] = [
		{
			title: 'Parts',
			icon: 'layers',
			body: 'Split a book into acts, eras or books-within-books. A part can hold chapters, or carry its own story text.'
		},
		{
			title: 'Chapters',
			icon: 'file-text',
			body: 'Every chapter knows the part it belongs to, so the whole book stays in order as it grows.'
		},
		{
			title: 'Characters',
			icon: 'users',
			body: 'Keep the people of your story in one place — and carry them into every book they walk through.'
		},
		{
			title: 'Systems',
			icon: 'share-2',
			body: 'Write down the rules of your magic, politics or trade once, and keep them consistent everywhere.'
		}
	];
</script>

<svelte:head>
	<title>Book Builder — Build worlds. Bind them into books.</title>
	<meta
		name="description"
		content="Book Builder is a free, open-source workshop for long-form stories."
	/>
</svelte:head>

<div id="top" class="home">
	<div class="dots" aria-hidden="true"></div>

	<SiteHeader onHome />

	<section class="hero">
		<div class="hero-copy">
			<motion-stagger interval={0.09} y={18} duration={0.7}>
				<p class="badge"><span class="badge-dot"></span>Free and open source</p>
				<h1 class="hero-title">
					Build worlds.<br /><span class="bind"
						><em>Bind</em><svg
							aria-hidden="true"
							viewBox="0 0 200 24"
							preserveAspectRatio="none"
							class="swash"><path d="M4 16C46 6 118 3 196 11" pathLength="1" /></svg
						></span
					>
					them<br />into books.
				</h1>
				<p class="lede">
					Book Builder is a free, open-source workshop for long-form stories. Plan your book on a
					corkboard, write it in an editor set like the finished page, keep its characters and
					systems close at hand, and share it with readers.
				</p>
				<div class="cta-row">
					<motion-magnetic strength={0.2}>
						<Button variant="primary" size="xl" glow href={resolve('/login')}>
							Get started for free<Icon name="arrow-right" size={18} />
						</Button>
					</motion-magnetic>
					<Button size="xl" href={GITHUB}>
						<Icon name="git-branch" size={18} strokeWidth={1.8} />View on GitHub
					</Button>
				</div>
				<div class="home-for">
					<span class="home-for-label">One home for</span>
					{#each homeFor as item (item.label)}
						<span class="chip"><Icon name={item.icon} size={15} />{item.label}</span>
					{/each}
				</div>
			</motion-stagger>
		</div>

		<motion-reveal class="hero-art" delay={0.3} y={28} duration={0.9}>
			<AnimatedBook />
		</motion-reveal>
	</section>

	<div class="marquee" aria-hidden="true">
		<div class="marquee-track">
			{#each [0, 1] as half (half)}
				{#each marquee as item, i (item.word)}
					<span class="marquee-word" class:outline={item.outline} class:italic={item.italic}
						>{item.word}</span
					><svg class="star" width="30" height="30" viewBox="0 0 24 24"
						><path
							d="M12 0C12.8 6.5 17.5 11.2 24 12C17.5 12.8 12.8 17.5 12 24C11.2 17.5 6.5 12.8 0 12C6.5 11.2 11.2 6.5 12 0Z"
							style:fill={i % 2 === 0 ? 'var(--bb-sky)' : 'var(--bb-royal)'}
						/></svg
					>
				{/each}
			{/each}
		</div>
	</div>

	<section id="features" class="section">
		<div class="section-head">
			<div class="section-head-main">
				<p class="overline">01 — How it's organized</p>
				<h2 class="section-title">
					<motion-headline by="words">Every piece of your story has a shelf.</motion-headline>
				</h2>
			</div>
			<motion-reveal class="section-aside" delay={0.25}>
				A book breaks into parts, a part into chapters — or a part holds its own story text, the way
				a prologue does. Characters and systems live right beside them.
			</motion-reveal>
		</div>

		<div class="features">
			<motion-tilt class="tree-tilt" max={3} scale={1.01} gloss={true}>
				<div class="tree-card">
					<div class="tree-book">
						<div class="tree-cover" aria-hidden="true">I</div>
						<div class="tree-book-text">
							<span class="tree-over">Book</span>
							<span class="tree-title">The Glass Armada</span>
						</div>
					</div>
					<div class="tree-rows">
						<div class="tree-row">
							<Icon name="layers" size={16} class="tree-icon" />
							<span class="tree-name">Prologue</span>
							<span class="tree-pill">Story text</span>
						</div>
						<div class="tree-row">
							<Icon name="chevron-down" size={16} class="tree-icon" />
							<span class="tree-name"
								>Part One <span class="tree-sub">— The Drowned Moon</span></span
							>
							<span class="tree-meta">3 chapters</span>
						</div>
						<div class="tree-chapter">
							<span class="tree-num">1</span><span>Salvage Rights</span>
						</div>
						<div class="tree-chapter current">
							<span class="tree-num">2</span><span class="grow">A Map of Dead Stars</span><span
								class="tree-dot"
							></span>
						</div>
						<div class="tree-chapter"><span class="tree-num">3</span><span>Burn Through</span></div>
						<div class="tree-row">
							<Icon name="chevron-right" size={16} class="tree-icon" />
							<span class="tree-name">Part Two <span class="tree-sub">— The Hollow Sun</span></span>
							<span class="tree-meta">4 chapters</span>
						</div>
					</div>
					<div class="tree-foot">
						<span class="tree-count"><span>6</span> Characters</span>
						<span class="tree-count"><span>2</span> Systems</span>
					</div>
				</div>
			</motion-tilt>

			<div class="feature-grid">
				<motion-stagger interval={0.08}>
					{#each features as feature (feature.title)}
						<!-- A soft glow follows the pointer across each card. -->
						<motion-spotlight class="feature" size={320}>
							<span class="feature-icon"
								><Icon name={feature.icon} size={22} strokeWidth={1.8} /></span
							>
							<h3>{feature.title}</h3>
							<p>{feature.body}</p>
						</motion-spotlight>
					{/each}
				</motion-stagger>
			</div>
		</div>
	</section>

	<section id="example" class="section example">
		<div class="example-copy">
			<p class="overline">02 — The editor</p>
			<h2 class="section-title">
				<motion-headline by="words">Write where the story lives.</motion-headline>
			</h2>
			<p class="example-lede">
				Open a chapter and write in an editor set like the finished page, or go full screen in focus
				mode. Then read it back, or share it, in reading mode.
			</p>
			<div class="checks">
				<motion-stagger interval={0.1} delay={0.2}>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Fonts,
						sizes, colours and highlights</span
					>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>A drop,
						raised or boxed first letter</span
					>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Reading
						mode, with a link to share</span
					>
				</motion-stagger>
			</div>
		</div>

		<motion-reveal class="preview-reveal" y={40} delay={0.1} duration={0.8}>
			<div class="preview">
				<div class="preview-bar">
					<span class="preview-crumbs"
						>The Glass Armada <span class="sep">/</span> Part One <span class="sep">/</span>
						<span class="here">A Map of Dead Stars</span></span
					>
					<span class="preview-saved"><Icon name="check-circle" size={15} />Saved</span>
				</div>
				<div class="preview-body">
					<h3 class="preview-title">
						A Map of Dead Stars <span class="bullet">•</span> <span class="muted">Chapter 2</span>
					</h3>
					<p class="preview-desc">In which the beacon wakes</p>
					<!-- A picture of the editor's toolbar, not a working one. -->
					<div class="preview-tools" aria-hidden="true">
						<span class="tool-pick">Paragraph</span>
						<span class="tool-pick">Book</span>
						<span class="tool-sep"></span>
						<span class="tool-glyph bold">B</span>
						<span class="tool-glyph italic on">I</span>
						<span class="tool-glyph underline">U</span>
						<span class="tool-sep"></span>
						<span class="tool-glyph ink">A</span>
						<span class="tool-icon"><Icon name="highlighter" size={15} /></span>
						<span class="tool-sep"></span>
						<span class="tool-icon on"><Icon name="align-left" size={15} /></span>
						<span class="tool-icon"><Icon name="scene-break" size={16} /></span>
						<span class="tool-glyph cap">A<span class="cap-lines"></span></span>
					</div>
					<!-- Set with the editor's own styles (prose.css), first letter and all. -->
					<div
						class="preview-text bb-prose cap-drop"
						style="--cap-lines: 2; --cap-font: var(--font-display); --cap-color: var(--ink-accent)"
					>
						<p>
							The beacon had been calling for
							<span style="color: var(--ink-ruby)">three hundred years</span> before anyone thought
							to answer. By the time the <em>Meridian</em> dropped out of the lane the signal had
							gone quiet, and Captain Juno Halley set down her coffee and
							<mark style="background-color: var(--mark-yellow)">looked into the dark</mark>.
						</p>
						<p><em>“That isn't a distress call,”</em> she said, though no one had asked her.</p>
						<hr />
						<p>
							By the next watch the whole crew had a theory and none of them had a plan<span
								class="caret"
							></span>
						</p>
					</div>
				</div>
			</div>
		</motion-reveal>
	</section>

	<section id="outline" class="section example outline-section">
		<!-- A picture of the corkboard: a column per part, a card per chapter. -->
		<motion-reveal class="board-reveal" y={40} delay={0.1} duration={0.8}>
			<div class="board" aria-hidden="true">
				{#each board as column (column.title)}
					<div class="board-column">
						<span class="board-over">{column.label}</span>
						<span class="board-title">{column.title}</span>
						{#each column.cards as card (card.title)}
							<div
								class={['board-card', { lifted: card.lifted }]}
								style:--stripe="var(--{card.status})"
							>
								<span class="board-num"><Icon name="grip" size={12} />{card.label}</span>
								<span class="board-card-title">{card.title}</span>
								<span class="board-status"><span class="dot"></span>{card.statusLabel}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</motion-reveal>

		<div class="example-copy">
			<p class="overline">03 — The outline</p>
			<h2 class="section-title">
				<motion-headline by="words">See the whole book at once.</motion-headline>
			</h2>
			<p class="example-lede">
				Lay your book out as a list or a corkboard. Drag chapters between parts, give each a status
				and a cast, and write synopses right on the cards.
			</p>
			<div class="checks">
				<motion-stagger interval={0.1} delay={0.2}>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Drag
						parts and chapters into place</span
					>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Track
						every chapter from idea to done</span
					>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Paste in
						an outline you already have</span
					>
				</motion-stagger>
			</div>
		</div>
	</section>

	<section id="focus" class="section">
		<p class="overline">04 — Focus and share</p>
		<h2 class="section-title duo-title">
			<motion-headline by="words">Close the door, then open the book.</motion-headline>
		</h2>
		<div class="duo">
			<motion-stagger interval={0.12}>
				<article class="duo-card">
					<!-- A picture of focus mode: the page alone, the line being written bright. -->
					<div class="focus-demo" data-scheme="dark" aria-hidden="true">
						<div class="focus-demo-bar">
							<span><Icon name="arrow-left" size={13} />Leave</span>
							<span class="focus-demo-stats"
								><span class="up">+412 this session</span><span
									><Icon name="clock" size={13} />24:12</span
								></span
							>
						</div>
						<div class="focus-demo-page">
							<p class="faded">The engines had gone quiet twice before she reached the airlock.</p>
							<p>
								Juno counted the stars again, and this time she was sure<span class="caret"></span>
							</p>
							<p class="faded">Behind her, the station lights went out one by one.</p>
						</div>
					</div>
					<h3>Focus mode</h3>
					<p>
						A full-screen page with nothing but your words: typewriter scrolling, dimmed paragraphs,
						and a timer for writing sprints.
					</p>
				</article>

				<article class="duo-card">
					<!-- A picture of a public author page. -->
					<div class="author-demo" aria-hidden="true">
						<span class="author-demo-face">OV</span>
						<span class="author-demo-name">Oriel Vance</span>
						<span class="author-demo-bio"
							>Writes about lost fleets and the people who chase them.</span
						>
						<span class="author-demo-address"
							><Icon name="globe" size={13} />book-builder/author/oriel-vance</span
						>
						<span class="author-demo-books">
							<BookCover id={2} title="The Glass Armada" size="sm" />
							<BookCover id={3} title="Lanterns of Vesper" size="sm" />
							<BookCover id={5} title="Starwake" size="sm" />
						</span>
					</div>
					<h3>Your author page</h3>
					<p>
						Your name, a short bio and every book you've shared, at an address of your own. Private
						until you switch it on.
					</p>
					<div class="duo-action">
						<Button href={resolve('/author/[handle]', { handle: 'demo-author' })}>
							See the demo author<Icon name="arrow-right" size={16} />
						</Button>
					</div>
				</article>
			</motion-stagger>
		</div>
	</section>

	{#if SOON.length > 0}
		<section id="soon" class="section">
			<p class="overline">05 — On the shelf next</p>
			<h2 class="section-title soon-title">
				<motion-headline by="words">Coming soon.</motion-headline>
			</h2>
			<div class="soon-grid">
				<motion-stagger interval={0.1}>
					{#each SOON as item (item.title)}
						<div class="soon-card">
							<div class="soon-top">
								<span class="soon-icon"><Icon name={item.icon} size={22} strokeWidth={1.8} /></span>
								<span class="soon-tag">Soon</span>
							</div>
							<h3>{item.title}</h3>
							<p>{item.body}</p>
						</div>
					{/each}
				</motion-stagger>
			</div>
		</section>
	{/if}

	<section class="closing">
		<motion-stagger interval={0.12} y={20} duration={0.7}>
			<div class="closing-rule" aria-hidden="true">
				<span></span>
				<svg width="34" height="34" viewBox="0 0 32 32"
					><path d="M3 7.5c4.4-2.2 8.6-2 12.2.9V27c-3.6-2.9-7.8-3.1-12.2-.9z" fill="#2B63F5" /><path
						d="M29 7.5c-4.4-2.2-8.6-2-12.2.9V27c3.6-2.9 7.8-3.1 12.2-.9z"
						fill="#7CB4FF"
					/></svg
				>
				<span></span>
			</div>
			<h2 class="closing-title">
				Every saga starts<br />as a
				<em
					><motion-underline shape="wave" delay={0.5} duration={0.9}>single page.</motion-underline
					></em
				>
			</h2>
			<p class="closing-lede">
				Build books and share them with others. Free to use, open source, and yours to shape.
			</p>
			<!-- Plain wrapper: the cascade animates it, the magnetic pull animates its child. -->
			<div>
				<motion-magnetic strength={0.2}>
					<Button variant="primary" size="xl" glow href={resolve('/login')}>
						Get started for free<Icon name="arrow-right" size={18} />
					</Button>
				</motion-magnetic>
			</div>
		</motion-stagger>
	</section>

	<SiteFooter />
</div>

<style>
	.home {
		position: relative;
		/* clip, unlike hidden, doesn't make a scroll container, so the sticky header still works. */
		overflow: clip;
		min-height: 100vh;
		background: var(--bb-night);
		color: var(--bb-text);
	}

	.dots {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 1000px;
		pointer-events: none;
		background-image: radial-gradient(
			light-dark(rgba(43, 99, 245, 0.13), rgba(124, 180, 255, 0.16)) 1px,
			transparent 1.3px
		);
		background-size: 26px 26px;
		-webkit-mask-image: linear-gradient(to bottom, #000 30%, transparent 95%);
		mask-image: linear-gradient(to bottom, #000 30%, transparent 95%);
	}

	/* Hero */
	.hero {
		position: relative;
		max-width: 1240px;
		margin: 0 auto;
		padding: 36px 32px 24px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 24px 40px;
	}

	.hero-copy {
		flex: 1 1 520px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 28px;
		position: relative;
		z-index: 2;
	}

	.badge {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 7px 14px 7px 10px;
		border: 1px solid var(--bb-line);
		border-radius: var(--r-pill);
		background: var(--bb-ink);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--bb-text-2);
	}

	.badge-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--bb-sky);
		box-shadow: 0 0 0 4px light-dark(rgba(43, 99, 245, 0.14), rgba(124, 180, 255, 0.16));
	}

	.hero-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(54px, 6.2vw, 90px);
		line-height: 0.98;
		letter-spacing: -0.015em;
		color: var(--bb-text-strong);
	}

	.bind {
		position: relative;
		display: inline-block;
	}

	.bind em {
		font-family: var(--font-read);
		font-style: italic;
		font-weight: 400;
		color: var(--bb-sky);
	}

	.swash {
		position: absolute;
		left: -3%;
		bottom: -0.04em;
		width: 106%;
		height: 0.2em;
		max-width: none;
		overflow: visible;
	}

	/* The swash under "Bind" draws itself once the headline is in. */
	.swash path {
		fill: none;
		stroke: var(--bb-sky);
		stroke-width: 5;
		stroke-linecap: round;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: swash-draw 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.9s forwards;
	}

	@keyframes swash-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	.lede {
		max-width: 540px;
		font-size: 19px;
		line-height: 1.6;
		color: var(--bb-text-2);
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}

	.home-for {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding-top: 22px;
		border-top: 1px solid var(--bb-line-soft);
	}

	.home-for-label {
		margin-right: 6px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-text-4);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 12px;
		border-radius: var(--r-chip);
		background: var(--bb-ink-2);
		border: 1px solid var(--bb-line-mid);
		font-size: 14px;
		font-weight: 500;
		color: var(--bb-text-label);
	}

	.chip :global(svg) {
		color: var(--bb-sky);
	}

	.hero-art {
		flex: 1 1 560px;
		min-width: 0;
		position: relative;
	}

	/* Marquee */
	.marquee {
		position: relative;
		margin-top: 24px;
		padding: 30px 0;
		border-top: 1px solid var(--bb-line-faint);
		border-bottom: 1px solid var(--bb-line-faint);
		overflow: hidden;
		background: light-dark(#efe8db, #0c122c);
	}

	/* Per-item spacing (no gap) keeps both halves identical, so -50% loops seamlessly. */
	.marquee-track {
		display: flex;
		align-items: center;
		width: max-content;
		animation: marq 42s linear infinite;
	}

	@keyframes marq {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	.marquee-word {
		font-family: var(--font-display);
		font-size: 104px;
		line-height: 1;
		padding-right: 44px;
		color: var(--bb-text-label);
		white-space: nowrap;
	}

	.marquee-word.outline {
		color: transparent;
		-webkit-text-stroke: 1.3px light-dark(#9ba5cc, #3b4e95);
	}

	.marquee-word.italic {
		font-family: var(--font-read);
		font-style: italic;
	}

	.star {
		flex: none;
		margin-right: 44px;
	}

	/* Sections */
	.section {
		max-width: 1240px;
		margin: 0 auto;
		padding: 120px 32px 40px;
		/* Keeps in-page links from landing under the sticky header. */
		scroll-margin-top: 40px;
	}

	.overline {
		margin: 0 0 16px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.section-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(40px, 4.4vw, 60px);
		line-height: 1.04;
		letter-spacing: -0.01em;
		color: var(--bb-text-strong);
	}

	.section-head {
		display: flex;
		flex-wrap: wrap;
		gap: 20px 64px;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 52px;
	}

	.section-head-main {
		flex: 1 1 560px;
		min-width: 0;
	}

	.section-aside {
		flex: 1 1 360px;
		max-width: 460px;
		font-size: 17px;
		line-height: 1.65;
		color: var(--bb-text-2);
	}

	.features {
		display: flex;
		flex-wrap: wrap;
		gap: 24px;
		align-items: stretch;
	}

	/* Tree card, tilting gently toward the pointer. */
	.tree-tilt {
		flex: 1 1 440px;
		min-width: 0;
		display: block;
		border-radius: 22px;
	}

	.tree-card {
		padding: 26px;
		border-radius: 22px;
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-mid);
		box-shadow: var(--shadow-card);
	}

	.tree-book {
		display: flex;
		align-items: center;
		gap: 16px;
		padding-bottom: 20px;
		border-bottom: 1px solid var(--bb-line-soft);
	}

	.tree-cover {
		flex: none;
		width: 48px;
		height: 64px;
		border-radius: 3px 6px 6px 3px;
		background: linear-gradient(90deg, #0c1748 0 6px, #1d3184 6px);
		box-shadow: inset 0 0 0 1px rgba(124, 180, 255, 0.4);
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-size: 16px;
		color: #7cb4ff;
	}

	.tree-book-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tree-over {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-text-4);
	}

	.tree-title {
		font-family: var(--font-display);
		font-size: 25px;
		color: var(--bb-text);
	}

	.tree-rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 16px;
	}

	.tree-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 11px 12px;
		border-radius: 10px;
	}

	.tree-row :global(.tree-icon) {
		color: var(--bb-text-4);
	}

	.tree-name {
		flex: 1;
		font-weight: 600;
		font-size: 15.5px;
		color: var(--bb-text);
	}

	.tree-sub {
		color: var(--bb-text-4);
		font-weight: 400;
	}

	.tree-pill {
		padding: 3px 10px;
		border-radius: var(--r-pill);
		border: 1px solid var(--bb-line-dashed);
		font-size: 12px;
		font-weight: 600;
		color: var(--bb-sky-text);
	}

	.tree-meta {
		font-size: 13px;
		color: var(--bb-text-4);
	}

	.tree-chapter {
		display: flex;
		align-items: baseline;
		gap: 14px;
		padding: 9px 12px 9px 40px;
		border-radius: 10px;
		font-family: var(--font-read);
		font-size: 17px;
		color: var(--bb-text-read);
	}

	.tree-chapter.current {
		background: var(--bb-raised);
		color: var(--bb-text-strong);
	}

	.tree-num {
		width: 14px;
		font-family: var(--font-display);
		font-size: 15px;
		color: var(--bb-text-4);
	}

	.current .tree-num {
		color: var(--bb-sky);
	}

	.grow {
		flex: 1;
	}

	.tree-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--bb-sky);
		align-self: center;
	}

	.tree-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 18px;
		padding-top: 18px;
		border-top: 1px solid var(--bb-line-soft);
	}

	.tree-count {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 12px;
		border-radius: var(--r-chip);
		background: var(--bb-hover);
		font-size: 13.5px;
		color: var(--bb-text-label);
	}

	.tree-count span {
		font-family: var(--font-display);
		color: var(--bb-sky);
	}

	/* Feature cards */
	.feature-grid {
		flex: 1 1 560px;
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
		gap: 16px;
	}

	.feature,
	.soon-card {
		padding: 26px;
		border-radius: var(--r-card);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.feature {
		--mc-spotlight-color: light-dark(rgba(43, 99, 245, 0.07), rgba(124, 180, 255, 0.12));
		background: light-dark(#fdfbf7, #0e1534);
		border: 1px solid var(--bb-line-soft);
	}

	.feature-icon,
	.soon-icon {
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 12px;
		color: var(--bb-sky);
	}

	.feature-icon {
		background: var(--bb-sky-wash);
	}

	.feature h3,
	.soon-card h3 {
		margin: 6px 0 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 26px;
		color: var(--bb-text-strong);
	}

	.feature p,
	.soon-card p {
		font-size: 15.5px;
		line-height: 1.6;
		color: var(--bb-text-2);
	}

	/* Example */
	.example {
		display: flex;
		flex-wrap: wrap;
		gap: 48px 64px;
		align-items: center;
	}

	.example-copy {
		flex: 1 1 360px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.example-copy .overline {
		margin: 0;
	}

	.example .section-title {
		font-size: clamp(40px, 4.4vw, 58px);
	}

	.example-lede {
		font-size: 17px;
		line-height: 1.65;
		color: var(--bb-text-2);
	}

	.checks {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 6px;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 16px;
		color: var(--bb-text-label);
	}

	.check-dot {
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--bb-sky-wash);
		color: var(--bb-sky);
	}

	.preview-reveal,
	.board-reveal {
		flex: 1 1 620px;
		min-width: 0;
	}

	/* 04: focus mode and the author page, side by side. */
	.duo-title {
		margin: 0 0 40px;
		font-size: clamp(38px, 4.2vw, 56px);
	}

	.duo {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
		gap: 18px;
	}

	.duo-card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px 18px 24px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.duo-card h3 {
		margin: 10px 8px 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 26px;
		color: var(--bb-text-strong);
	}

	.duo-card > p {
		margin: 0 8px;
		font-size: 15.5px;
		line-height: 1.6;
		color: var(--bb-text-2);
	}

	.duo-action {
		margin: 6px 8px 0;
	}

	/* Focus mode: always a night page, as on a dark screen. */
	.focus-demo {
		display: flex;
		flex-direction: column;
		height: 280px;
		border-radius: 14px;
		background: var(--bb-night);
		border: 1px solid var(--bb-line-soft);
		overflow: hidden;
	}

	.focus-demo-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		font-size: 12px;
		font-weight: 600;
		color: var(--bb-text-3);
	}

	.focus-demo-bar span,
	.focus-demo-stats > span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.focus-demo-stats {
		gap: 12px;
	}

	.focus-demo-stats .up {
		color: var(--bb-sky-text);
	}

	.focus-demo-page {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 10px;
		padding: 0 30px 18px;
		font-family: var(--font-read);
		font-size: 17px;
		line-height: 1.5;
		color: var(--bb-text-read);
	}

	.focus-demo-page .faded {
		opacity: 0.28;
	}

	/* The author page */
	.author-demo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		height: 280px;
		padding: 16px;
		justify-content: center;
		border-radius: 14px;
		background: var(--bb-panel);
		border: 1px solid var(--bb-line-faint);
		text-align: center;
	}

	.author-demo-face {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		margin-bottom: 4px;
		border-radius: 50%;
		background: light-dark(#141c45, var(--bb-paper));
		color: light-dark(var(--bb-paper), #141c45);
		font-family: var(--font-display);
		font-size: 19px;
		box-shadow:
			0 0 0 3px var(--bb-panel),
			0 0 0 4px var(--bb-sky);
	}

	.author-demo-name {
		font-family: var(--font-display);
		font-size: 24px;
		color: var(--bb-text-strong);
	}

	.author-demo-bio {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 15px;
		color: var(--bb-text-desc);
	}

	.author-demo-address {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 2px;
		padding: 3px 10px;
		border-radius: var(--r-pill);
		background: var(--bb-sky-wash);
		font-size: 11.5px;
		font-weight: 600;
		color: var(--bb-sky-text);
	}

	.author-demo-books {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	@media (max-width: 600px) {
		.focus-demo-page {
			padding: 0 18px 14px;
			font-size: 15px;
		}
	}

	/* A picture of the corkboard: status colours as in the outline. */
	.board {
		--done: var(--ink-moss);
		--drafting: var(--ink-gold);
		--revising: var(--ink-violet);
		--outlined: var(--bb-sky);
		--idea: var(--bb-text-4);
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: start;
		gap: 14px;
		padding: 18px;
		border-radius: 22px;
		background: var(--bb-panel);
		border: 1px solid var(--bb-line);
		box-shadow:
			0 40px 80px -40px var(--bb-drop),
			0 0 0 6px rgba(43, 99, 245, 0.06);
	}

	.board-column {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
		padding: 10px;
		border-radius: 16px;
		background: var(--bb-night);
		border: 1px solid var(--bb-line-faint);
	}

	.board-over {
		padding: 2px 4px 0;
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.board-title {
		padding: 0 4px 4px;
		font-family: var(--font-display);
		font-size: 18px;
		line-height: 1.2;
		color: var(--bb-text-strong);
	}

	.board-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 9px 10px 10px;
		border-radius: 12px;
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		box-shadow:
			inset 0 3px 0 var(--stripe),
			0 8px 18px -14px var(--bb-drop);
	}

	/* Mid-drag. */
	.board-card.lifted {
		position: relative;
		z-index: 1;
		border-color: var(--bb-line-control);
		box-shadow:
			inset 0 3px 0 var(--stripe),
			0 26px 40px -18px var(--bb-drop);
		transform: translate(12px, 4px) rotate(-2.5deg);
		animation: lifted 4s ease-in-out infinite;
	}

	@keyframes lifted {
		50% {
			transform: translate(20px, -2px) rotate(-1deg);
		}
	}

	.board-num {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bb-text-4);
	}

	.board-card-title {
		font-family: var(--font-read);
		font-size: 16px;
		line-height: 1.3;
		color: var(--bb-text);
		overflow-wrap: anywhere;
	}

	.board-status {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 9px;
		border-radius: var(--r-pill);
		background: var(--bb-ink-2);
		border: 1px solid var(--bb-line-soft);
		font-size: 11px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.board-status .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--stripe);
	}

	/* Copy first when the section stacks, as in the editor section above. */
	@media (max-width: 1060px) {
		.board-reveal {
			order: 2;
		}
	}

	@media (max-width: 600px) {
		.board {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 12px;
			gap: 10px;
		}

		.board-column:nth-child(3) {
			display: none;
		}
	}

	.preview {
		border-radius: 22px;
		background: var(--bb-ink);
		border: 1px solid var(--bb-line);
		box-shadow:
			0 40px 80px -40px var(--bb-drop),
			0 0 0 6px rgba(43, 99, 245, 0.06);
		overflow: hidden;
	}

	.preview-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 22px;
		border-bottom: 1px solid var(--bb-line-soft);
		background: var(--bb-panel);
	}

	.preview-crumbs {
		font-size: 13.5px;
		color: var(--bb-text-4);
	}

	.preview-crumbs .sep {
		padding: 0 6px;
	}

	.preview-crumbs .here {
		color: var(--bb-text-label);
	}

	.preview-saved {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		color: var(--bb-sky-text);
	}

	.preview-body {
		padding: 30px 34px 34px;
	}

	.preview-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 40px;
		line-height: 1.05;
		color: var(--bb-text-strong);
	}

	.preview-title .bullet {
		color: var(--bb-sky);
	}

	.preview-title .muted {
		color: var(--bb-text-2);
	}

	.preview-desc {
		margin-top: 10px;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 19px;
		color: var(--bb-text-2);
	}

	/* A picture of the editor's toolbar. */
	.preview-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-top: 20px;
		padding: 6px;
		border-radius: 12px;
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-night);
		color: var(--bb-text-label);
	}

	.tool-pick {
		padding: 5px 10px;
		border-radius: 7px;
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-ink);
		font-size: 12px;
		font-weight: 600;
	}

	.tool-sep {
		width: 1px;
		height: 20px;
		margin: 0 4px;
		background: var(--bb-line-soft);
	}

	.tool-glyph,
	.tool-icon {
		display: grid;
		place-items: center;
		min-width: 28px;
		height: 28px;
		border-radius: 7px;
		font-size: 15px;
	}

	.tool-glyph.on,
	.tool-icon.on {
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.tool-glyph.bold {
		font-weight: 800;
	}

	.tool-glyph.italic {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 17px;
	}

	.tool-glyph.underline {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.tool-glyph.ink {
		min-width: 18px;
		height: 22px;
		margin: 0 5px;
		border-radius: 0;
		border-bottom: 3px solid var(--ink-ruby);
		font-family: var(--font-display);
	}

	.tool-glyph.cap {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		padding: 0 4px 5px;
		font-family: var(--font-display);
		font-size: 19px;
		color: var(--bb-sky);
	}

	.cap-lines {
		width: 8px;
		height: 10px;
		margin-bottom: 2px;
		background: repeating-linear-gradient(
			to bottom,
			var(--bb-text-label) 0 1.5px,
			transparent 1.5px 4px
		);
	}

	.preview-text {
		margin-top: 26px;
		padding-top: 24px;
		border-top: 1px solid var(--bb-line-soft);
		font-family: var(--font-read);
		font-size: 18px;
		line-height: 1.75;
		color: var(--bb-text-read);
	}

	.caret {
		display: inline-block;
		width: 2px;
		height: 1.1em;
		margin-left: 2px;
		vertical-align: -0.18em;
		background: var(--bb-sky);
		animation: blink 1.1s steps(1) infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	/* Coming soon */
	.soon-title {
		margin: 0 0 44px;
		font-size: clamp(40px, 4.4vw, 58px);
	}

	.soon-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
		gap: 18px;
	}

	.soon-card {
		padding: 28px;
		gap: 14px;
		border: 1.5px dashed var(--bb-line-dashed);
	}

	.soon-card h3 {
		margin-top: 4px;
	}

	.soon-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.soon-icon {
		background: var(--bb-hover);
	}

	.soon-tag {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	/* Closing CTA */
	.closing {
		position: relative;
		max-width: 1240px;
		margin: 0 auto;
		padding: 140px 32px 130px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 26px;
	}

	.closing-rule {
		display: flex;
		align-items: center;
		gap: 18px;
		width: 100%;
		max-width: 420px;
	}

	.closing-rule span {
		flex: 1;
		height: 1px;
		background: var(--bb-line);
	}

	.closing-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(44px, 5.6vw, 80px);
		line-height: 1.02;
		letter-spacing: -0.015em;
		color: var(--bb-text-strong);
	}

	.closing-title em {
		--mc-mark-color: var(--bb-sky);
		--mc-mark-thickness: 3px;
		font-family: var(--font-read);
		font-style: italic;
		color: var(--bb-sky);
	}

	.closing-lede {
		max-width: 520px;
		font-size: 18px;
		line-height: 1.6;
		color: var(--bb-text-2);
	}

	@media (max-width: 600px) {
		.hero {
			padding: 20px 20px 16px;
		}

		.hero-title {
			font-size: 46px;
		}

		.section {
			padding: 80px 20px 32px;
		}

		.closing {
			padding: 100px 20px 90px;
		}

		.marquee-word {
			font-size: 72px;
		}

		.tree-card,
		.preview-body {
			padding: 20px;
		}

		.preview-title {
			font-size: 32px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee-track,
		.caret,
		.swash path,
		.board-card.lifted {
			animation: none;
		}

		.swash path {
			stroke-dashoffset: 0;
		}
	}
</style>
