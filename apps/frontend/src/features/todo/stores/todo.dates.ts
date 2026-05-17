/**
 * 将日期相关值（Date / string / number）转换为 Date 对象
 * 如果无法转换为有效日期，返回 null
 */
export function toDate(value: Date | string | number | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
