// CodeMirror TASM Mode (IDEAL/TASM + x86), Notepad++-style
// Path: /dosbox/tasm.js
// Use:  mode: "tasm"

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") mod(require("codemirror"));
  else if (typeof define == "function" && define.amd) define(["codemirror"], mod);
  else mod(CodeMirror);
})(function(CodeMirror) {

  CodeMirror.defineMode("tasm", function() {

    // core token sets
    const registers = /^(?:ax|bx|cx|dx|si|di|bp|sp|al|ah|bl|bh|cl|ch|dl|dh|cs|ds|ss|es|fs|gs|ip|eip|eax|ebx|ecx|edx|esi|edi|esp|ebp)\b/i;

    // IDEAL/TASM segment + global directives (bare) and MASM-style dotted ones
    const dirBare = /^(?:IDEAL|MODEL|DATASEG|CODESEG|STACK|END)\b/i;
    const dirDotted = /^\.(?:model|code|data|stack|const|startup|exit|save|restore)\b/i;

    // after MODEL, sizes like "small" should look like a type
    const modelSizes = /^(?:tiny|small|medium|compact|large|huge|flat)\b/i;

    // proc/struct etc. as keywords
    const keywords = /^(?:db|dw|dd|dq|dt|assume|ptr|offset|type|size|proc|endp|macro|endm|struct|ends|include)\b/i;

    const instructions =
      /^(?:mov|add|sub|mul|div|imul|idiv|inc|dec|cmp|test|lea|and|or|xor|not|neg|shl|shr|sal|sar|rol|ror|rcl|rcr|push|pop|pusha|popa|pushf|popf|call|jmp|je|jne|jg|jge|jl|jle|ja|jae|jb|jbe|jc|jnc|jo|jno|js|jns|jp|jnp|jz|jnz|loop|int|iret|ret|retn|rep|repz|repnz|stos|lods|scas|movs|cmps)\b/i;

    function number(stream) {
      // 123, 4c00h, 100b, 377o, 42d
      return stream.match(/^[0-9][0-9A-Fa-f]*[hH]?|^[0-1]+[bB]|^[0-7]+[oO]|^[0-9]+[dD]/)
        ? "number" : null;
    }

    return {
      startState() { return { inString: false, expectModelSize: false }; },

      token(stream, state) {
        if (stream.eatSpace()) return null;

        // comment
        if (stream.match(/;.*/)) return "comment";

        // string '…'
        if (!state.inString && stream.peek() === "'") { stream.next(); state.inString = true; }
        if (state.inString) {
          if (stream.skipTo("'")) { stream.next(); state.inString = false; }
          else stream.skipToEnd();
          return "string";
        }

        // labels at sol: label:
        if (stream.sol() && stream.match(/^[A-Za-z_.$][\w.$]*:/)) return "tasm-label";

        // numbers
        const num = number(stream);
        if (num) return num;

        // registers
        if (stream.match(registers)) return "variable-2";

        // @data and similar
        if (stream.match(/^@[A-Za-z_.$][\w.$]*/)) return "atom";

        // dotted directives
        if (stream.match(dirDotted)) return "tasm-directive";

        // bare directives (IDEAL/MODEL/DATASEG/CODESEG/STACK/END)
        if (stream.match(dirBare)) {
          if (/^model$/i.test(stream.current())) state.expectModelSize = true;
          return "tasm-directive";
        }

        // a MODEL size right after MODEL
        if (state.expectModelSize && stream.match(modelSizes)) {
          state.expectModelSize = false;
          return "atom";
        } else {
          state.expectModelSize = false;
        }

        // keywords (PROC, ENDP, ASSUME, PTR, DB/DW…)
        if (stream.match(keywords)) return "keyword";

        // instructions (opcodes)
        if (stream.match(instructions)) return "builtin";

        // identifiers
        if (stream.match(/^[A-Za-z_.$][\w.$]*/)) return "variable";

        // fallthrough
        stream.next();
        return null;
      }
    };
  });

  CodeMirror.defineMIME("text/x-tasm", "tasm");
});
