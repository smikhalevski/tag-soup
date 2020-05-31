export type Maybe<T> = T | null | undefined;

export type Rewriter = (str: string) => string;

export type FromCharName = (name: string, terminated: boolean) => Maybe<string>;

export type FromCharCode = (charCode: number) => Maybe<string>;
