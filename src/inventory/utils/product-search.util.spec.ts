import {
  matchesProductTokens,
  normalizeSearchText,
  rankProductForQuery,
  sortProductsForPosSearch,
  tokenizeQuery,
} from './product-search.util';

describe('product-search.util', () => {
  it('normalizes and tokenizes queries', () => {
    expect(normalizeSearchText('  Filtro   Aceite ')).toBe('filtro aceite');
    expect(tokenizeQuery('  Filtro   Aceite ')).toEqual(['filtro', 'aceite']);
  });

  it('matches products when every token is present', () => {
    const product = {
      title: 'Filtro de aceite',
      brand: 'Mann',
      sku: 'FO-001',
    };

    expect(matchesProductTokens(product, ['filtro', 'aceite'])).toBe(true);
    expect(matchesProductTokens(product, ['mann'])).toBe(true);
    expect(matchesProductTokens(product, ['filtro', 'bujia'])).toBe(false);
  });

  it('ranks exact and prefix title matches higher', () => {
    const exact = {
      title: 'Filtro de aceite',
      brand: null,
      sku: null,
      stock: 5,
    };
    const prefix = {
      title: 'Filtro de aire',
      brand: null,
      sku: null,
      stock: 5,
    };
    const partial = {
      title: 'Aceite sintetico',
      brand: 'Filtro Plus',
      sku: null,
      stock: 5,
    };

    const ranked = sortProductsForPosSearch(
      [partial, prefix, exact],
      'filtro de aceite',
      ['filtro', 'de', 'aceite'],
    );

    expect(ranked.map((product) => product.title)).toEqual([
      'Filtro de aceite',
      'Filtro de aire',
      'Aceite sintetico',
    ]);
    expect(
      rankProductForQuery(exact, 'filtro de aceite', ['filtro', 'de', 'aceite']),
    ).toBeGreaterThan(
      rankProductForQuery(prefix, 'filtro de aceite', ['filtro', 'de', 'aceite']),
    );
  });
});
