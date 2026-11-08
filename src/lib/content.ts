import type { Component } from 'svelte';

// The two writing surfaces. Articles are evergreen (reference explainers,
// ordered by title); blog posts are dated (reverse-chronological). Both are
// authored as .svx files under src/content/<collection>/ — git-versioned,
// no DB, deploys with the site. This module enumerates their frontmatter for
// the index/hub pages; the [slug] routes import the component directly.

export type Collection = 'articles' | 'blog';

export type PostMeta = {
	title: string;
	summary: string;
	/** ISO date — required for blog, absent for evergreen articles. */
	date?: string;
	/** Drafts are kept in the repo but never listed or routed-to publicly. */
	draft?: boolean;
};

export type PostEntry = PostMeta & { slug: string; collection: Collection };

type SvxModule = { metadata: PostMeta; default: Component };

const articleGlob = import.meta.glob<SvxModule>('/src/content/articles/*.svx', { eager: true });
const blogGlob = import.meta.glob<SvxModule>('/src/content/blog/*.svx', { eager: true });

function entries(glob: Record<string, SvxModule>, collection: Collection): PostEntry[] {
	return Object.entries(glob)
		.map(([path, mod]) => {
			const slug = path.split('/').at(-1)!.replace('.svx', '');
			return { slug, collection, ...mod.metadata };
		})
		.filter((e) => !e.draft);
}

export function listArticles(): PostEntry[] {
	return entries(articleGlob, 'articles').sort((a, b) => a.title.localeCompare(b.title));
}

export function listBlog(): PostEntry[] {
	return entries(blogGlob, 'blog').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** Human date for display, e.g. "14 June 2026". Returns '' for undated posts. */
export function formatDate(iso?: string): string {
	if (!iso) return '';
	const d = new Date(iso + 'T00:00:00Z');
	return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
