<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
	import AnimatedBook from './AnimatedBook.svelte';
	import SiteHeader from './SiteHeader.svelte';
	import SiteFooter from './SiteFooter.svelte';

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

	const soon: { title: string; icon: IconName; body: string }[] = [
		{
			title: 'Text Editor',
			icon: 'pen',
			body: 'Richer formatting for your story text, right where you write it.'
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
					Book Builder is a free, open-source workshop for long-form stories. Shape your book into
					parts and chapters, keep its characters and systems close at hand, and share what you've
					written with readers.
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
						<div class="tree-cover" aria-hidden="true">IX</div>
						<div class="tree-book-text">
							<span class="tree-over">Book</span>
							<span class="tree-title">The War of Nine</span>
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
							<span class="tree-name">Part One <span class="tree-sub">— The Ninth Bell</span></span>
							<span class="tree-meta">3 chapters</span>
						</div>
						<div class="tree-chapter">
							<span class="tree-num">1</span><span>Salt and Iron</span>
						</div>
						<div class="tree-chapter current">
							<span class="tree-num">2</span><span class="grow">A Map Drawn in Ash</span><span
								class="tree-dot"
							></span>
						</div>
						<div class="tree-chapter"><span class="tree-num">3</span><span>The Crossing</span></div>
						<div class="tree-row">
							<Icon name="chevron-right" size={16} class="tree-icon" />
							<span class="tree-name">Part Two <span class="tree-sub">— The Ashen Coast</span></span
							>
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
			<p class="overline">02 — Example of a Part</p>
			<h2 class="section-title">
				<motion-headline by="words">Write where the story lives.</motion-headline>
			</h2>
			<p class="example-lede">
				Open a part and its story text is right there, set in a typeface made for long reading —
				nothing between you and the page.
			</p>
			<div class="checks">
				<motion-stagger interval={0.1} delay={0.2}>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Parts
						without chapters hold their own story text</span
					>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Edit
						titles and descriptions in place</span
					>
					<span class="check"
						><span class="check-dot"><Icon name="check" size={13} strokeWidth={3} /></span>Share
						finished books with readers</span
					>
				</motion-stagger>
			</div>
		</div>

		<motion-reveal class="preview-reveal" y={40} delay={0.1} duration={0.8}>
			<div class="preview">
				<div class="preview-bar">
					<span class="preview-crumbs"
						>The War of Nine <span class="sep">/</span> <span class="here">Prologue</span></span
					>
					<span class="preview-saved"><Icon name="check-circle" size={15} />Saved</span>
				</div>
				<div class="preview-body">
					<h3 class="preview-title">
						Prologue <span class="bullet">•</span> <span class="muted">The War of Nine</span>
					</h3>
					<p class="preview-desc">Prologue to The War of Nine</p>
					<p class="preview-pill">
						<Icon name="pen" size={14} />No chapters — this part holds its own story text
					</p>
					<div class="preview-text">
						<p>
							Lorem ipsum dolor sit amet consectetur adipiscing elit non dolor quidem imperdiet est
							quod voluptatum non quidem proident excepteur dolor pariatur eos do provident esse
							harum imperdiet dolore expedita.
						</p>
						<p>
							Deleniti vero est autem distinctio enim est quas elit temporibus pariatur deleniti
							fugiat non autem sunt est facere accusamus culpa vero ullamco similique est in
							temporibus amet possimus duis excepteur<span class="caret"></span>
						</p>
					</div>
				</div>
			</div>
		</motion-reveal>
	</section>

	<section id="soon" class="section">
		<p class="overline">03 — On the shelf next</p>
		<h2 class="section-title soon-title">
			<motion-headline by="words">Coming soon.</motion-headline>
		</h2>
		<div class="soon-grid">
			<motion-stagger interval={0.1}>
				{#each soon as item (item.title)}
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
		overflow: hidden;
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

	.preview-reveal {
		flex: 1 1 620px;
		min-width: 0;
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

	.preview-pill {
		margin-top: 18px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 14px;
		border-radius: var(--r-pill);
		background: var(--bb-sky-wash);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--bb-sky-text);
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

	.preview-text p + p {
		margin-top: 14px;
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
		.swash path {
			animation: none;
		}

		.swash path {
			stroke-dashoffset: 0;
		}
	}
</style>
