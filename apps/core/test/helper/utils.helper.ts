export const firstOfMap = <K, V>(map: Map<K, V>) => [...map.entries()]?.[0]
export const firstKeyOfMap = <K, V>(map: Map<K, V>) =>
  [...map.entries()]?.[0][0]
export const firstValueOfMap = <K, V>(map: Map<K, V>) =>
  [...map.entries()]?.[0][1]
