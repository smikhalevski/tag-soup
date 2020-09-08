export const enum TagType {

  /**
   * Regular tags with no restrictions on how they are nested.
   */
  FLOW = 1,

  /**
   * Content of tags with this type are treated as plain text. `script`, `style` and `textarea` may use this type.
   */
  TEXT = 2,

  /**
   * Tags with this type cannot have any content and are always treated as self-closing. `img`, `hr` and `br` may use
   * this type.
   */
  VOID = 3,
}
