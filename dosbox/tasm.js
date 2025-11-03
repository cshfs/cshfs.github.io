// CodeMirror TASM Mode (Hybrid MASM/TASM + x86) — Standalone
// Place in: /dosbox/tasm.js
// Use: mode: "tasm"

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") 
    mod(require("codemirror"));
  else if (typeof define == "function" && define.amd) 
    define(["codemirror"], mod);
  else 
    mod(CodeMirror);
})(function(CodeMirror) {

  CodeMirror.defineMode("tasm", function() {

    const registers = /^(ax|bx|cx|dx|si|di|bp|sp|al|ah|bl|bh|cl|ch|dl|dh|cs|ds|ss|es|fs|gs|ip|eip|eax|ebx|ecx|edx|esi|edi|esp|ebp)$/i;
    const directives = /^\.(model|code|data|stack|const|startup|exit|save|restore)$/i;
    const keywords = /^(db|dw|dd|dq|dt|assume|ptr|offset|type|size|proc|endp|macro|endm|struct|ends|include|end)$/i;
    const instructions = /^(mov|add|sub|mul|div|imul|idiv|inc|dec|cmp|test|lea|and|or|xor|not|neg|shl|shr|sal|sar|rol|ror|rcl|rcr|push|pop|pusha|popa|pushf|popf|call|jmp|je|jne|jg|jge|jl|jle|ja|jae|jb|jbe|jc|jnc|jo|jno|js|jns|jp|jnp|jz|jnz|loop|int|iret|ret|retn|rep|repz|repnz|stos|lods|scas|movs|cmps)$/i;

    return {
      startState() {
        return { inString: false };
      },

      token(stream, state) {
        if (stream.eatSpace()) return null;

        // Comments
        if (stream.match(/;.*/)) {
          return "comment";
        }

        // Strings
        if (!state.inString && stream.peek() === "'") {
          stream.next(); 
          state.inString = true;
        }
        if (state.inString) {
          if (stream.skipTo("'")) {
            stream.next();
            state.inString = false;
          } else {
            stream.skipToEnd();
          }
          return "string";
        }

        // Labels (at start of line: label:)
        if (stream.sol() && stream.match(/^[A-Za-z_.$][\w.$]*:/)) {
          return "tasm-label";
        }

        // Numbers
        if (stream.match(/^[0-9]+(h|H|b|B|d|D|o|O)?/)) {
          return "number";
        }

        // Registers
        if (stream.match(registers)) {
          return "variable-2";
        }

        // Directives
        if (stream.match(directives)) {
          return "tasm-directive";
        }

        // Keywords (PROC, ENDP, ASSUME, PTR, DB, DW…)
        if (stream.match(keywords)) {
          return "keyword";
        }

        // Instructions
        if (stream.match(instructions)) {
          return "builtin";
        }

        // Identifiers / labels used as operands
        if (stream.match(/^[A-Za-z_.$][\w.$]*/)) {
          return "variable";
        }

        stream.next();
        return null;
      }
    };
  });

  CodeMirror.defineMIME("text/x-tasm", "tasm");
});
