import { storyVersionHandlers } from '$lib/server/story-versions';

const { one, rename } = storyVersionHandlers('chapter');
export { one as GET, rename as PUT };
