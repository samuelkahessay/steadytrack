import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://steadytrack.ca'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/plan/',
          '/curriculum/',
        ],
        disallow: [
          '/api/',
          '/parent/',       // Private parent dashboards
          '/share/',        // Private share links
          '/(dashboard)/',  // Protected dashboard routes
          '/plan/*/study',  // Protected study mode
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: ['/'],    // Opt out of AI training
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],    // Opt out of AI training
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
