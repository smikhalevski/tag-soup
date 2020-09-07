export const enum TagType {

  /**
   * Regular tags with no restrictions on how they are nested. This is the default model used for all tags.
   */
  FLOW = 1,

  /**
   * Content of tags with this model is treated as a plain text. `script`, `style` and `textarea` may use this model.
   */
  TEXT = 2,

  /**
   * Tags with this model cannot have any content and are always treated as self-closing. `img`, `hr` and `br` may use
   * this model.
   */
  VOID = 3,
}
