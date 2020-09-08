export const enum ContentMode {

  /**
   * Denotes tags with no restrictions.
   */
  FLOW = 1,

  /**
   * The content of tag with this type is treated as a plain text. `script`, `style` and `textarea` may use this type.
   */
  TEXT = 2,

  /**
   * Tags with this type cannot have any content and should be treated as self-closing. `img`, `hr` and `br` may use
   * this type.
   */
  VOID = 3,
}
