// Minimal ambient declaration for fast-formula-parser (MIT), which ships no TypeScript types.
// Only the surface we use in tests (the FormulaParser constructor + parse) is declared.
declare module 'fast-formula-parser' {
  interface CellRef { sheet?: string; row: number; col: number; }
  interface RangeRef { sheet?: string; from: { row: number; col: number }; to: { row: number; col: number }; }

  interface FormulaParserConfig {
    onCell?: (ref: CellRef) => number | string | boolean | null;
    onRange?: (ref: RangeRef) => (number | string | boolean | null)[][];
    functions?: Record<string, (...args: any[]) => any>;
    onVariable?: (name: string, sheetName?: string) => any;
  }

  interface Position { sheet: string; row: number; col: number; }

  class FormulaParser {
    constructor(config?: FormulaParserConfig);
    parse(formula: string, position: Position): number | string | boolean | object;
  }

  export const FormulaHelpers: {
    flattenParams: (
      params: any[],
      valueType: any,
      allowUnion: boolean,
      hook: (value: any, info?: any) => void,
      defValue?: any,
      minSize?: number
    ) => void;
    accept: (param: any, type: any, defValue?: any) => any;
  };

  export const Types: { NUMBER: any; STRING: any; BOOLEAN: any; [k: string]: any };

  export default FormulaParser;
}
