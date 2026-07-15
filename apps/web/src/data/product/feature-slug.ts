/** Converts a technical feature ID to a public, SEO-friendly kebab-case slug. */
export function toFeatureSlug(featureId: string): string {
  return featureId.trim().toLocaleLowerCase('en-US').replaceAll('_', '-')
}
