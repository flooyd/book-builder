import { storyVersionHandlers } from '$lib/server/story-versions';

const { one, rename } = storyVersionHandlers('part');
export { one as GET, rename as PUT };
