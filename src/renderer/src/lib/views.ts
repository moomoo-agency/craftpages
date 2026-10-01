import type { Key } from '../i18n'
import type { ViewId } from '../components/Sidebar'

/** The name of each view, in the sidebar and as the top bar heading. */
export const VIEW_TITLES: Record<ViewId, Key> = {
  pages: 'app.viewPages',
  blog: 'app.viewBlog',
  components: 'app.viewComponents',
  media: 'app.viewMedia',
  seo: 'app.viewSeo',
  search: 'app.viewSearch',
  ai: 'app.viewAi',
  publish: 'app.viewPublish',
  project: 'app.viewProject',
  settings: 'app.viewSettings'
}
