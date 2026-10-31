<!--
	Decorative 3D book for the signed-out hero (Main.dc.html .stage).
	3D rules: `perspective` lives on .bob (the book's direct parent), and nothing on .bob, .book or
	a .leaf may use filter, opacity < 1 or overflow: hidden, because each of those flattens
	preserve-3d. Leaves stack by animating translateZ together with rotateY.
-->
<div class="stage-wrap" aria-hidden="true">
	<div class="stage">
		<div class="glow"></div>
		<div class="bob">
			<div class="book">
				<div class="cover"></div>

				<div class="pg pg-l">
					<div class="rh">The Glass Armada</div>
					<div class="pb">
						<p>
							The Meridian came out of the lane with her running lights dark and her hull still
							ringing from the jump. Below her turned Kesh, a drowned moon under a skin of frozen
							sea, and above it, where no beacon had any right to be, something was still calling.
						</p>
						<p>
							Juno Halley had flown salvage for eleven years. She knew the sound of a dead ship, the
							slow tick of cooling metal, the hush of air with nowhere left to go. This was not
							that. This was a voice, patient and precise, repeating the same seven notes.
						</p>
						<p>
							“Tell me that's an echo,” she said, and Ade did not answer, which was its own kind of
							answer. On the long screen the signal climbed and fell like breath, and the stars
							behind it seemed, for one unsteady moment, to lean in and listen.
						</p>
					</div>
					<div class="pn">2</div>
				</div>

				<div class="pg pg-r">
					<div class="rh">The Drowned Moon</div>
					<div class="pb">
						<p>
							The Lantern Gate had been closed for three centuries. Every chart in the Armada said
							so, every pilot's song ended at its edge, and every child on Vesper Station knew the
							story of the ships that had sailed through and come back singing.
						</p>
						<div class="orn" style:margin="12px 0">
							<svg width="40" height="8" viewBox="0 0 40 8"
								><circle cx="8" cy="4" r="1.4" fill="#9C8F74" /><path
									d="M20 0l4 4-4 4-4-4z"
									fill="#2B63F5"
								/><circle cx="32" cy="4" r="1.4" fill="#9C8F74" /></svg
							>
						</div>
						<p>
							Juno had never believed the story. She believed in fuel margins and hull integrity and
							the plain arithmetic of distance. But when the gate began to glow, faint as breath on
							glass, she found she was holding very still, as if the light might notice her.
						</p>
					</div>
					<div class="pn">11</div>
				</div>

				<div class="leaf l4">
					<div class="pg pg-r face">
						<div class="rh">The Drowned Moon</div>
						<div class="pb">
							<p>
								Ade ran the numbers twice and then a third time, lips moving, the way he did when he
								did not trust the answer. The beacon was not on the moon. It was inside it, under
								eleven kilometres of ice, and it had been built by someone who expected to be found.
							</p>
							<p>“So we leave.”</p>
							<p>
								Nobody moved. Outside, the drowned moon turned its white face toward them, slow and
								incurious, and somewhere beneath the ice the seven notes began again, closer now, as
								if the voice had heard them talking and wanted to be part of it.
							</p>
						</div>
						<div class="pn">9</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The Glass Armada</div>
						<div class="pb">
							<p>
								There were rules for this. Juno had written half of them herself, in the years after
								Tamsin, when the crew needed something firmer than her word. Never answer a signal
								you cannot name. Never follow a light into the dark. Never trust a map made by the
								dead.
							</p>
							<p>
								She broke the first rule before breakfast. By the second watch she had broken the
								second, and the third lay open on the chart table between them: a map of dead stars,
								drawn in a hand that was not quite human, and still faintly warm.
							</p>
						</div>
						<div class="pn">10</div>
					</div>
				</div>

				<div class="leaf l3">
					<div class="pg pg-r face">
						<div class="rh">The Drowned Moon</div>
						<div class="pb">
							<p>
								The map should not have worked. Half its stars had burned out before the Armada was
								built, and the rest had wandered so far that no pilot alive could have sung a course
								between them. Yet when Ade laid it over the live sky, every line held.
							</p>
							<p>
								Every one of them pointed inward, toward the gate, and the gate, as if it had been
								waiting for exactly this, began to open. The light that came through was older than
								the station, older than the fleet, and it sounded like a choir heard through water.
							</p>
							<p>“Did you do that?”</p>
						</div>
						<div class="pn">7</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The Glass Armada</div>
						<div class="pb">
							<p>
								“I didn't do anything,” Ade said. “I put a map on a screen.” His voice was steady.
								His hands were not. Juno watched the gate widen by degrees, slow as a tide, and felt
								the old fear rise in her, the one she had spent eleven years outrunning.
							</p>
							<p>
								She thought of Tamsin, and of the ship that had come back singing. Then she thought
								of the crew, and the fuel, and the long way home, and found that none of it mattered
								quite as much as she had always told herself it did.
							</p>
						</div>
						<div class="pn">8</div>
					</div>
				</div>

				<div class="leaf l2">
					<div class="pg pg-r face">
						<div class="ck">Part One</div>
						<div class="ct">The Drowned Moon</div>
						<div class="orn">
							<svg width="70" height="8" viewBox="0 0 70 8"
								><path d="M0 4h27M43 4h27" stroke="#9C8F74" stroke-width="0.8" /><path
									d="M35 0l4 4-4 4-4-4z"
									fill="#2B63F5"
								/></svg
							>
						</div>
						<div class="pb">
							<p class="dc">
								Salvage law was older than the Armada and simpler than its pilots liked to admit. A
								ship that stopped singing belonged to whoever found it. Juno had built a life on
								that one sentence, and on the quiet hours it bought her between wrecks.
							</p>
							<p>
								The beacon did not care about salvage law. It had been waiting a long time for
								someone to come.
							</p>
						</div>
						<div class="pn">5</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The Glass Armada</div>
						<div class="pb">
							<p>
								It reached them on the edge of Kesh space, eleven hours out from Vesper, a thread of
								sound so faint that the hull had to be listening for it. Ade caught it first. He
								always did. He had the kind of ear that heard engines dying a week before they died.
							</p>
							<p>“That isn't a distress call,” Juno said, though no one had asked her.</p>
							<p>
								On the long screen the signal turned over and over, seven notes, never the same
								twice and never quite different, like a word in a language that had been waiting a
								very long time for someone to answer it.
							</p>
						</div>
						<div class="pn">6</div>
					</div>
				</div>

				<div class="leaf l1">
					<div class="pg pg-r face">
						<div class="rh">Prologue</div>
						<div class="pb">
							<p>
								Three hundred years before the Meridian, a fleet of glass ships sailed out from the
								inner worlds to find the edge of the sky. They navigated by song, each pilot singing
								her ship from star to star, and for a hundred years the songs came back.
							</p>
							<p>
								Then one season they did not. The last message from the Glass Armada was seven
								notes, sent from somewhere past the Lantern Gate, and after that there was nothing
								at all.
							</p>
							<p>
								The inner worlds mourned, and then forgot. The gate was sealed. The songs became
								stories. And far out in the cold, on a drowned moon nobody visited, something went
								on singing to itself.
							</p>
						</div>
						<div class="pn">3</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The Glass Armada</div>
						<div class="pb">
							<p>
								It sang for three centuries. It sang through the fall of the inner worlds and the
								rise of the free stations, through wars no one now remembered and treaties no one
								now kept. It sang to empty space, patient and precise.
							</p>
							<p>
								Then, one ordinary morning, a salvage ship came out of the lane with her running
								lights dark, and something under the ice of Kesh stopped singing, and began, very
								carefully, to listen.
							</p>
							<div class="orn" style:margin="14px 0 0">
								<svg width="40" height="8" viewBox="0 0 40 8"
									><circle cx="8" cy="4" r="1.4" fill="#9C8F74" /><path
										d="M20 0l4 4-4 4-4-4z"
										fill="#2B63F5"
									/><circle cx="32" cy="4" r="1.4" fill="#9C8F74" /></svg
								>
							</div>
						</div>
						<div class="pn">4</div>
					</div>
				</div>
			</div>
		</div>

		<div class="tag t1">
			<span class="tag-icon">
				<svg
					width="17"
					height="17"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 17 10 5 10-5" /><path
						d="m2 12 10 5 10-5"
					/></svg
				>
			</span>
			<span class="tag-text">
				<span class="tag-over">Part · No chapters</span>
				<span class="tag-title">Prologue</span>
			</span>
		</div>

		<div class="tag t2">
			<span class="tag-over">Chapter · Part One</span>
			<span class="tag-title">Salvage Rights</span>
			<span class="progress">
				<span class="on"></span><span class="on"></span><span></span><span></span>
			</span>
		</div>

		<div class="tag t3">
			<span class="monogram">JH</span>
			<span class="person">
				<span class="person-name">Juno Halley</span>
				<span class="person-meta">Character · in 2 books</span>
			</span>
		</div>

		<div class="tag t4">
			<span class="tag-icon">
				<svg
					width="17"
					height="17"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle
						cx="18"
						cy="19"
						r="3"
					/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg
				>
			</span>
			<span class="tag-text">
				<span class="tag-over">System · Magic</span>
				<span class="tag-title">Starsinging</span>
			</span>
		</div>
	</div>
</div>

<style>
	.stage-wrap {
		position: relative;
		height: 640px;
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.stage {
		position: relative;
		flex: none;
		width: 640px;
		height: 640px;
	}

	.glow {
		position: absolute;
		left: 30px;
		right: 30px;
		top: 330px;
		height: 290px;
		border-radius: 50%;
		background: radial-gradient(
			closest-side,
			rgba(124, 180, 255, 0.24),
			rgba(43, 99, 245, 0.12) 55%,
			rgba(43, 99, 245, 0) 100%
		);
	}

	/* perspective sits on the book's direct parent; see the note at the top. */
	.bob {
		position: absolute;
		inset: 0;
		perspective: 2000px;
		animation: bob 8s ease-in-out infinite;
	}

	@keyframes bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-14px);
		}
	}

	.book {
		position: absolute;
		left: 50%;
		top: 372px;
		width: 580px;
		height: 390px;
		margin-left: -290px;
		margin-top: -195px;
		transform-style: preserve-3d;
		transform: rotateX(40deg) rotateZ(-9deg);
	}

	.cover {
		position: absolute;
		left: -14px;
		top: -8px;
		width: 608px;
		height: 406px;
		border-radius: 6px;
		background: linear-gradient(
			90deg,
			#142463 0%,
			#1d3184 46%,
			#0c1748 50%,
			#1d3184 54%,
			#142463 100%
		);
		transform: translateZ(-4px);
		box-shadow:
			0 50px 80px -24px var(--bb-drop),
			0 0 0 1px rgba(124, 180, 255, 0.35);
	}

	.pg {
		position: absolute;
		top: 0;
		width: 290px;
		height: 390px;
		box-sizing: border-box;
		padding: 26px 26px 18px;
		background-color: #f5f0e6;
		color: #2a2930;
		font-family: var(--font-read);
		font-size: 9.6px;
		line-height: 1.52;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.pg-l {
		left: 0;
		background-image: linear-gradient(
			to left,
			rgba(60, 40, 10, 0.26),
			rgba(60, 40, 10, 0.06) 9%,
			rgba(60, 40, 10, 0) 18%
		);
		box-shadow:
			-1px 1px 0 #e4dccb,
			-2px 2px 0 #f2ecdf,
			-3px 3px 0 #dcd2be,
			-4px 4px 0 #efe8da,
			-5px 5px 0 #d2c7b1;
	}

	.pg-r {
		left: 290px;
		background-image: linear-gradient(
			to right,
			rgba(60, 40, 10, 0.26),
			rgba(60, 40, 10, 0.06) 9%,
			rgba(60, 40, 10, 0) 18%
		);
		box-shadow:
			1px 1px 0 #e4dccb,
			2px 2px 0 #f2ecdf,
			3px 3px 0 #dcd2be,
			4px 4px 0 #efe8da,
			5px 5px 0 #d2c7b1;
	}

	.leaf {
		position: absolute;
		left: 290px;
		top: 0;
		width: 290px;
		height: 390px;
		transform-style: preserve-3d;
		transform-origin: 0 50%;
	}

	.face {
		left: 0;
		box-shadow: none;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.back {
		transform: rotateY(180deg);
	}

	.rh {
		font-family: var(--font-ui);
		font-size: 6.4px;
		font-weight: 600;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: #8c836f;
		text-align: center;
		margin-bottom: 12px;
	}

	.pb {
		flex: 1;
		overflow: hidden;
	}

	.pb p {
		margin: 0;
		text-align: justify;
		-webkit-hyphens: auto;
		hyphens: auto;
	}

	.pb p + p {
		text-indent: 1.5em;
	}

	.pn {
		font-family: var(--font-ui);
		font-size: 7px;
		color: #8c836f;
		text-align: center;
		margin-top: 8px;
		letter-spacing: 0.12em;
	}

	.ck {
		font-family: var(--font-ui);
		font-size: 6.8px;
		font-weight: 700;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: #2b63f5;
		text-align: center;
		margin-top: 40px;
	}

	.ct {
		font-family: var(--font-display);
		font-size: 29px;
		color: #141c45;
		text-align: center;
		line-height: 1.05;
		margin: 8px 0 10px;
	}

	.orn {
		display: flex;
		justify-content: center;
		margin-bottom: 18px;
	}

	.orn svg {
		display: block;
	}

	.dc::first-letter {
		font-family: var(--font-display);
		float: left;
		font-size: 38px;
		line-height: 0.8;
		padding: 4px 6px 0 0;
		color: #2b63f5;
	}

	/* Leaves turn one by one over a 14s loop, then riffle back. Keep these exactly as designed. */
	.l1 {
		transform: translateZ(6px);
		animation: f1 14s infinite;
	}

	.l2 {
		transform: translateZ(4.5px);
		animation: f2 14s infinite;
	}

	.l3 {
		transform: translateZ(3px);
		animation: f3 14s infinite;
	}

	.l4 {
		transform: translateZ(1.5px);
		animation: f4 14s infinite;
	}

	@keyframes f1 {
		0%,
		5.714% {
			transform: translateZ(6px) rotateY(0deg);
			animation-timing-function: cubic-bezier(0.55, 0.06, 0.3, 1);
		}
		16.429%,
		84.286% {
			transform: translateZ(1.5px) rotateY(-180deg);
			animation-timing-function: cubic-bezier(0.5, 0, 0.4, 1);
		}
		89.286%,
		100% {
			transform: translateZ(6px) rotateY(0deg);
		}
	}

	@keyframes f2 {
		0%,
		24.286% {
			transform: translateZ(4.5px) rotateY(0deg);
			animation-timing-function: cubic-bezier(0.55, 0.06, 0.3, 1);
		}
		35%,
		82.857% {
			transform: translateZ(3px) rotateY(-180deg);
			animation-timing-function: cubic-bezier(0.5, 0, 0.4, 1);
		}
		87.857%,
		100% {
			transform: translateZ(4.5px) rotateY(0deg);
		}
	}

	@keyframes f3 {
		0%,
		42.857% {
			transform: translateZ(3px) rotateY(0deg);
			animation-timing-function: cubic-bezier(0.55, 0.06, 0.3, 1);
		}
		53.571%,
		81.429% {
			transform: translateZ(4.5px) rotateY(-180deg);
			animation-timing-function: cubic-bezier(0.5, 0, 0.4, 1);
		}
		86.429%,
		100% {
			transform: translateZ(3px) rotateY(0deg);
		}
	}

	@keyframes f4 {
		0%,
		61.429% {
			transform: translateZ(1.5px) rotateY(0deg);
			animation-timing-function: cubic-bezier(0.55, 0.06, 0.3, 1);
		}
		72.143%,
		80% {
			transform: translateZ(6px) rotateY(-180deg);
			animation-timing-function: cubic-bezier(0.5, 0, 0.4, 1);
		}
		85%,
		100% {
			transform: translateZ(1.5px) rotateY(0deg);
		}
	}

	/* Floating tags (static marketing copy). */
	.tag {
		position: absolute;
		z-index: 3;
		background: light-dark(rgba(253, 251, 247, 0.92), rgba(18, 25, 53, 0.9));
		border: 1px solid light-dark(#d9d0bd, #2a3870);
		box-shadow: 0 22px 40px -18px light-dark(rgba(74, 56, 28, 0.3), rgba(0, 0, 0, 0.85));
		animation: float 7s ease-in-out infinite;
	}

	.t1 {
		left: 6px;
		top: 74px;
		padding: 12px 16px 12px 14px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.t2 {
		right: 0;
		top: 150px;
		padding: 12px 16px;
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 180px;
		animation-delay: -1.8s;
	}

	.t3 {
		left: 0;
		bottom: 70px;
		padding: 10px 16px 10px 10px;
		border-radius: 999px;
		background: light-dark(rgba(253, 251, 247, 0.94), rgba(18, 25, 53, 0.92));
		display: flex;
		align-items: center;
		gap: 12px;
		animation-delay: -3.6s;
	}

	.t4 {
		right: 18px;
		bottom: 34px;
		padding: 12px 16px 12px 14px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		gap: 12px;
		animation-delay: -5.2s;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-9px);
		}
	}

	.tag-icon {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 9px;
		background: light-dark(#e3e9f8, #1a2550);
		color: var(--bb-sky);
	}

	.tag-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tag-over {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.tag-title {
		font-family: var(--font-display);
		font-size: 18px;
		color: var(--bb-text);
	}

	.progress {
		display: flex;
		gap: 4px;
		margin-top: 4px;
	}

	.progress span {
		width: 26px;
		height: 4px;
		border-radius: 2px;
		background: light-dark(#ddd4c2, #2a3870);
	}

	.progress .on {
		background: var(--bb-sky);
	}

	.monogram {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--bb-paper);
		color: #141c45;
		font-family: var(--font-display);
		font-size: 16px;
		box-shadow:
			0 0 0 2px var(--bb-night),
			0 0 0 3px var(--bb-sky);
	}

	.person {
		display: flex;
		flex-direction: column;
	}

	.person-name {
		font-weight: 700;
		font-size: 15px;
		color: var(--bb-text);
	}

	.person-meta {
		font-size: 12.5px;
		color: var(--bb-text-2);
	}

	@media (max-width: 760px) {
		.stage-wrap {
			height: 380px;
			overflow: hidden;
		}

		.stage {
			transform: scale(0.56);
			transform-origin: 50% 0;
		}
	}

	/* 0.56 of 640px still overhangs a 390px phone; tighten one more step. */
	@media (max-width: 420px) {
		.stage-wrap {
			height: 340px;
		}

		.stage {
			transform: scale(0.5);
		}
	}

	/* Rests closed on page 3. */
	@media (prefers-reduced-motion: reduce) {
		.bob,
		.leaf,
		.tag {
			animation: none;
		}
	}
</style>
