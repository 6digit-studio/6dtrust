import { listArticles, listBlog } from '$lib/content';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	articles: listArticles(),
	blog: listBlog()
});
