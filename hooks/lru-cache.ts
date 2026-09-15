/**
 * A bounded least-recently-used cache.
 *
 * Render hooks re-run on every redraw and every resize, so a shaped message
 * must not pay for fribidi again each time. Map preserves insertion order, so
 * deleting and re-inserting a key on every touch makes the oldest key the
 * first one the iterator yields.
 */
export class LruCache<V> {
  private readonly capacity: number
  private readonly entries = new Map<string, V>()

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.trunc(capacity))
  }

  get size(): number {
    return this.entries.size
  }

  get(key: string): V | undefined {
    if (!this.entries.has(key)) return undefined

    const value = this.entries.get(key) as V
    this.entries.delete(key)
    this.entries.set(key, value)

    return value
  }

  set(key: string, value: V): void {
    if (this.entries.has(key)) this.entries.delete(key)
    this.entries.set(key, value)

    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next()
      if (oldest.done === true) break
      this.entries.delete(oldest.value)
    }
  }
}
