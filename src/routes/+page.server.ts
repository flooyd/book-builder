import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';

export const load: PageServerLoad = (event) => {
    if(event.locals.user) {
        return { user: event.locals.user };
    } else {
        //do nothing
        return { user: null };
    }
};