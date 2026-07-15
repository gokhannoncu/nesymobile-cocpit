/** Teknik feature ID'sini public, SEO uyumlu kebab-case slug'a dönüştürür. */
export function toFeatureSlug(featureId: string): string {
  return featureId.trim().toLocaleLowerCase('en-US').replaceAll('_', '-')
}
