
export interface Hashable {
  hash(): string
}

export class HashSet<T extends Hashable> {
  private map = new Map<string, T>()

  add(item: T) {
    this.map.set(item.hash(), item)
  }

  delete(item: T) {
    this.map.delete(item.hash())
  }

  has(item: T) {
    return this.map.has(item.hash())
  }

  values() {
    return Array.from(this.map.values())
  }
}

export class HashMap<K extends Hashable, V> {
  private map = new Map<string, V>()
  private keyMap = new Map<string, K>()

  set(key: K, value: V) {
    this.map.set(key.hash(), value)
    this.keyMap.set(key.hash(), key)
  }

  get(key: K): V | undefined {
    return this.map.get(key.hash())
  }

  delete(key: K) {
    this.map.delete(key.hash())
    this.keyMap.delete(key.hash())
  }

  has(key: K) {
    return this.map.has(key.hash())
  }

  entries() {
    return Array.from(this.map.entries()).map(([hash, value]) => {
      const key = this.keyMap.get(hash)
      if (!key) throw new Error(`Key not found for hash: ${hash}`)
      return [key, value] as [K, V]
    })
  }
}