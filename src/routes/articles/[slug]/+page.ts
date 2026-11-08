import { error } from '@sveltejs/kit';
import type { PostMeta } from '$lib/content';
import type { PageLoad } from './$types';

// Universal load: the .svx compiles to a Svelte component, which we import by
// slug and hand to the page. (Vite turns this template-literal import into a
// scoped glob over the articles dir, so only real .svx files resolve.)
export const load: PageLoad = async ({ params }) => {
	try {
		const post = await import(`../../../content/articles/${params.slug}.svx`);
		const meta = post.metadata as PostMeta;
		if (meta.draft) throw error(404, 'Article not found');
		return { Content: post.default, meta };
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(404, 'Article not found');
	}
};
