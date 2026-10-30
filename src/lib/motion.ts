// Registers the motion-components custom elements this app uses (https://www.motion-components.dev).
//
// Import this only in the browser, after hydration (the root layout does it in onMount). The
// text-splitting elements rewrite their own children, which must not happen while Svelte is still
// hydrating the server-rendered markup. Until the elements are defined, motion-components'
// preload.css (imported by the layout) hides the content that is about to animate in.
import 'motion-components/motion-reveal';
import 'motion-components/motion-stagger';
import 'motion-components/motion-headline';
import 'motion-components/motion-counter';
import 'motion-components/motion-underline';
import 'motion-components/motion-press';
import 'motion-components/motion-magnetic';
import 'motion-components/motion-tilt';
import 'motion-components/motion-spotlight';
import 'motion-components/motion-icon';
