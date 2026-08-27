export type SearchableProduct = {
  title: string;
  brand: string | null;
  sku: string | null;
  stock: number;
};

export function normalizeSearchText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function tokenizeQuery(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean);
}

export function matchesProductTokens(
  product: Pick<SearchableProduct, 'title' | 'brand' | 'sku'>,
  tokens: string[],
): boolean {
  if (!tokens.length) return false;

  const haystack = [product.title, product.brand ?? '', product.sku ?? '']
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export function rankProductForQuery(
  product: SearchableProduct,
  normalizedQuery: string,
  tokens: string[],
): number {
  const title = product.title.toLowerCase();
  let score = 0;

  if (title === normalizedQuery) score += 1000;
  else if (title.startsWith(normalizedQuery)) score += 500;

  score += tokens.filter((token) => title.includes(token)).length * 50;

  if (product.stock > 0) score += 10;

  return score;
}

export function sortProductsForPosSearch<T extends SearchableProduct>(
  products: T[],
  normalizedQuery: string,
  tokens: string[],
): T[] {
  return [...products].sort((left, right) => {
    const scoreDiff =
      rankProductForQuery(right, normalizedQuery, tokens) -
      rankProductForQuery(left, normalizedQuery, tokens);
    if (scoreDiff !== 0) return scoreDiff;

    return left.title.localeCompare(right.title, 'es');
  });
}
