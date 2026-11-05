import { storyVersionHandlers } from '$lib/server/story-versions';

const { list, keep } = storyVersionHandlers('part');
export { list as GET, keep as POST };
