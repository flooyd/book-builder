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
					<div class="rh">The War of Nine</div>
					<div class="pb">
						<p>
							Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
							incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
							exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
							dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
						</p>
						<p>
							Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
							mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit
							voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab
							illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
						</p>
						<p>
							“Nemo enim ipsam voluptatem,” quia voluptas sit aspernatur aut odit aut fugit, sed
							quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro
							quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed
							quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat
							voluptatem.
						</p>
					</div>
					<div class="pn">2</div>
				</div>

				<div class="pg pg-r">
					<div class="rh">The Ninth Bell</div>
					<div class="pb">
						<p>
							Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe
							eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum
							rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias
							consequatur aut perferendis doloribus asperiores repellat.
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
							Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus
							id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor
							repellendus. Similique sunt in culpa qui officia deserunt mollitia animi, id est
							laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio, at
							vero eos et accusamus et iusto odio dignissimos ducimus.
						</p>
					</div>
					<div class="pn">11</div>
				</div>

				<div class="leaf l4">
					<div class="pg pg-r face">
						<div class="rh">The Ninth Bell</div>
						<div class="pb">
							<p>
								Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil
								molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?
								At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
								praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
								excepturi sint occaecati cupiditate non provident.
							</p>
							<p>“Similique sunt in culpa.”</p>
							<p>
								Qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem
								rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est
								eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere
								possimus, omnis voluptas assumenda est, omnis dolor repellendus temporibus autem
								quibusdam.
							</p>
						</div>
						<div class="pn">9</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The War of Nine</div>
						<div class="pb">
							<p>
								Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit
								laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure
								reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel
								illum qui dolorem eum fugiat quo voluptas nulla pariatur.
							</p>
							<p>
								Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
								incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
								exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
								irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
								pariatur, excepteur sint occaecat cupidatat non proident.
							</p>
						</div>
						<div class="pn">10</div>
					</div>
				</div>

				<div class="leaf l3">
					<div class="pg pg-r face">
						<div class="rh">The Ninth Bell</div>
						<div class="pb">
							<p>
								Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
								doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
								veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam
								voluptatem quia voluptas sit aspernatur aut odit aut fugit.
							</p>
							<p>
								Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque
								porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
								velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam
								aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem
								ullam corporis suscipit laboriosam.
							</p>
							<p>“Nisi ut aliquid ex ea commodi consequatur?”</p>
						</div>
						<div class="pn">7</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The War of Nine</div>
						<div class="pb">
							<p>
								Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe
								eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum
								rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias
								consequatur aut perferendis doloribus asperiores repellat.
							</p>
							<p>
								Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo
								minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis
								dolor repellendus. At vero eos et accusamus et iusto odio dignissimos ducimus qui
								blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas
								molestias excepturi.
							</p>
						</div>
						<div class="pn">8</div>
					</div>
				</div>

				<div class="leaf l2">
					<div class="pg pg-r face">
						<div class="ck">Part One</div>
						<div class="ct">The Ninth Bell</div>
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
								Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
								incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
								exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
								irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
								pariatur.
							</p>
							<p>
								Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
								mollit anim id est laborum sed ut perspiciatis.
							</p>
						</div>
						<div class="pn">5</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The War of Nine</div>
						<div class="pb">
							<p>
								Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,
								adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore
								magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum
								exercitationem ullam corporis suscipit laboriosam.
							</p>
							<p>
								“Quis autem vel eum iure,” reprehenderit qui in ea voluptate velit esse quam nihil
								molestiae consequatur.
							</p>
							<p>
								Vel illum qui dolorem eum fugiat quo voluptas nulla pariatur? At vero eos et
								accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum
								deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati
								cupiditate non provident, similique sunt in culpa.
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
								Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
								fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa
								qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste
								natus error sit voluptatem accusantium doloremque laudantium.
							</p>
							<p>
								Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto
								beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit
								aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione
								voluptatem sequi nesciunt.
							</p>
							<p>
								Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,
								adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore
								magnam aliquam quaerat voluptatem.
							</p>
						</div>
						<div class="pn">3</div>
					</div>
					<div class="pg pg-l face back">
						<div class="rh">The War of Nine</div>
						<div class="pb">
							<p>
								At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
								praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias
								excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui
								officia deserunt mollitia animi, id est laborum et dolorum fuga.
							</p>
							<p>
								Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum
								soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime
								placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.
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
			<span class="tag-title">Salt and Iron</span>
			<span class="progress">
				<span class="on"></span><span class="on"></span><span></span><span></span>
			</span>
		</div>

		<div class="tag t3">
			<span class="monogram">MT</span>
			<span class="person">
				<span class="person-name">Maren Toll</span>
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
				<span class="tag-title">Tidecraft</span>
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
