import { storyVersionHandlers } from '$lib/server/story-versions';

const { list, keep } = storyVersionHandlers('chapter');
export { list as GET, keep as POST };
