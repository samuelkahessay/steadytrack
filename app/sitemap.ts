import { MetadataRoute } from 'next'
import { getAllSubjectsWithMetadata } from '@/lib/utils/curriculum'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://steadytrack.ca'

  // Static public pages
  const routes = [
    '',           // Homepage
    '/privacy',   // Privacy policy
    '/terms',     // Terms of service
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }))

  // Curriculum pages (public) - dynamically generated from actual curriculum data
  const subjects = getAllSubjectsWithMetadata()
  const curriculumRoutes = subjects.map((subject) => ({
    url: `${baseUrl}/curriculum/${subject.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [
    ...routes,
    ...curriculumRoutes,
  ]
}
