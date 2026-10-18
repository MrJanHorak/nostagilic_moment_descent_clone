/** Editor-owned drafts are mutable; runtime snapshots keep their readonly API. */
type Mutable<T> = T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
export type EditorLevelDocument = Mutable<import('../levelDocument.js').LevelDocument>;
export type EditorRoom = Mutable<import('../levelDocument.js').RoomDocument>;
