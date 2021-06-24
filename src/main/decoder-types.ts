export type Rewriter = (str: string) => string;

export type FromCharName = (name: string, terminated: boolean) => string | null | undefined;

export type FromCharCode = (charCode: number) => string | null | undefined;
