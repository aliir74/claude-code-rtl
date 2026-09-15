import { describe, expect, test } from 'claude-code/testing'

import { LruCache } from '../hooks/lru-cache'

describe('lru-cache', () => {
  test('the cache never grows past its capacity', () => {
    const cache = new LruCache<number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBe(undefined)
  })

  test('a get refreshes recency', () => {
    const cache = new LruCache<number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(undefined)
  })

  test('re-setting a key updates it without growing', () => {
    const cache = new LruCache<number>(2)
    cache.set('a', 1)
    cache.set('a', 9)
    expect(cache.size).toBe(1)
    expect(cache.get('a')).toBe(9)
  })

  test('a capacity below one is clamped to one', () => {
    const cache = new LruCache<number>(0)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.size).toBe(1)
    expect(cache.get('b')).toBe(2)
  })

  test('a missing key is undefined', () => {
    expect(new LruCache<number>(4).get('nope')).toBe(undefined)
  })
})
