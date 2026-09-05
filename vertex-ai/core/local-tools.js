"use strict";
(function () {
  function number(value) { const parsed = Number(value); if (!Number.isFinite(parsed)) throw new Error("That is not a valid number."); return parsed; }
  function calculator(input) {
    const source = String(input || "").replace(/[^0-9+\-*/().%\s]/g, "").trim();
    if (!source || !/[+\-*/%]/.test(source)) return null;
    let index = 0;
    function skip() { while (/\s/.test(source[index] || "")) index++; }
    function expression() { let value = term(); while (true) { skip(); const op = source[index]; if (op !== "+" && op !== "-") return value; index++; const right = term(); value = op === "+" ? value + right : value - right; } }
    function term() { let value = factor(); while (true) { skip(); const op = source[index]; if (op !== "*" && op !== "/" && op !== "%") return value; index++; const right = factor(); if ((op === "/" || op === "%") && right === 0) throw new Error("Division by zero is not allowed."); value = op === "*" ? value * right : op === "/" ? value / right : value % right; } }
    function factor() { skip(); if (source[index] === "-") { index++; return -factor(); } if (source[index] === "(") { index++; const value = expression(); skip(); if (source[index++] !== ")") throw new Error("Check the parentheses in that calculation."); return value; } const match = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/); if (!match) throw new Error("I could not parse that calculation."); index += match[0].length; return Number(match[0]); }
    const result = expression(); skip(); if (index !== source.length || !Number.isFinite(result)) throw new Error("I could not complete that calculation."); return { text: "The result is **" + String(Math.round(result * 1000000) / 1000000) + "**.", tool: "calculator" };
  }
  function run(input) {
    const text = String(input || "").trim();
    const percentage = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*%\s*of\s*[₦$€£]?\s*(\d+(?:\.\d+)?)/i);
    if (percentage) {
      const result = Number(percentage[1]) * Number(percentage[2]) / 100;
      return { text: "The result is **" + String(Math.round(result * 1000000) / 1000000) + "**.", tool: "calculator" };
    }
    if (/^\s*(what is|calculate|compute|solve)\b/i.test(text) || /^\s*[-+]?\d[\d\s().+*/%-]*\s*[+*/%-]\s*[-+]?\d/.test(text)) return calculator(text);
    if (/\b(time|date|today|now)\b/i.test(text) && !/what is .*\b(date|time)\b/i.test(text)) return { text: "Your local date and time is **" + new Date().toLocaleString() + "**.", tool: "date-time" };
    const jsonMatch = text.match(/(?:format|pretty[- ]?print)\s+(?:this\s+)?json\s*:?\s*([\[{].*[\]}])\s*$/i);
    if (jsonMatch) { try { return { text: "```json\n" + JSON.stringify(JSON.parse(jsonMatch[1]), null, 2) + "\n```", tool: "json-format" }; } catch (error) { return { text: "I could not parse that JSON.", tool: "json-format" }; } }
    return null;
  }
  window.VertexAILocalTools = Object.freeze({ run, calculator });
})();
