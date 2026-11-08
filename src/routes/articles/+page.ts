import { listArticles } from '$lib/content';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({ posts: listArticles() });
