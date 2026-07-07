'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import MeasurementConverter from './MeasurementConverter'

const HISTORY_KEY = 'elevate_calc_history'

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)) } catch {}
}

const factorial = (n) => {
  if (n < 0 || !Number.isInteger(n)) return NaN
  if (n === 0 || n === 1) return 1
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

const unaryFns = {
  sin: { fn: (x) => Math.sin(x), label: 'sin' },
  cos: { fn: (x) => Math.cos(x), label: 'cos' },
  tan: { fn: (x) => Math.tan(x), label: 'tan' },
  log: { fn: (x) => Math.log10(x), label: 'log' },
  ln: { fn: (x) => Math.log(x), label: 'ln' },
  sqrt: { fn: (x) => Math.sqrt(x), label: '√' },
  abs: { fn: (x) => Math.abs(x), label: '|x|' },
  exp: { fn: (x) => Math.exp(x), label: 'eˣ' },
  tenPow: { fn: (x) => Math.pow(10, x), label: '10ˣ' },
  fact: { fn: (x) => factorial(x), label: 'x!' },
  recip: { fn: (x) => 1 / x, label: '1/x' },
}

const funcNames = new Set(Object.keys(unaryFns))

function tokenize(expr) {
  const tokens = []
  let i = 0
  while (i < expr.length) {
    if (expr[i] === ' ') { i++; continue }
    if ('+-×÷^()'.includes(expr[i])) {
      tokens.push({ type: 'OP', value: expr[i] })
      i++
    } else if ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.') {
      let num = ''
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        num += expr[i]; i++
      }
      tokens.push({ type: 'NUM', value: parseFloat(num) })
    } else if (expr[i] === 'π') {
      tokens.push({ type: 'NUM', value: Math.PI })
      i++
    } else if (expr[i] === 'e' && (i + 1 >= expr.length || !((expr[i + 1] >= 'a' && expr[i + 1] <= 'z') || expr[i + 1] === '('))) {
      tokens.push({ type: 'NUM', value: Math.E })
      i++
    } else {
      let name = ''
      while (i < expr.length && ((expr[i] >= 'a' && expr[i] <= 'z') || expr[i] === '²' || expr[i] === '³')) {
        name += expr[i]; i++
      }
      if (name === '²' || name === '³') {
        tokens.push({ type: 'POST', value: name })
      } else if (funcNames.has(name) || name === 'square' || name === 'cube') {
        tokens.push({ type: 'FN', value: name })
      } else {
        tokens.push({ type: 'UNKNOWN', value: name })
      }
    }
  }
  return tokens
}

class ExpressionParser {
  constructor(tokens, angleMode) {
    this.tokens = tokens
    this.pos = 0
    this.angleMode = angleMode
  }

  peek() { return this.tokens[this.pos] || null }
  consume() { return this.tokens[this.pos++] }

  applyFn(name, arg) {
    if (name === 'square') return arg * arg
    if (name === 'cube') return arg * arg * arg
    let input = arg
    if ((name === 'sin' || name === 'cos' || name === 'tan') && this.angleMode === 'DEG') {
      input = arg * (Math.PI / 180)
    }
    return unaryFns[name] ? unaryFns[name].fn(input) : NaN
  }

  parseExpr() {
    let left = this.parseTerm()
    while (this.peek() && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value
      const right = this.parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  parseTerm() {
    let left = this.parsePower()
    while (this.peek() && (this.peek().value === '×' || this.peek().value === '÷')) {
      const op = this.consume().value
      const right = this.parsePower()
      if (op === '÷' && right === 0) return NaN
      left = op === '×' ? left * right : left / right
    }
    return left
  }

  parsePower() {
    let left = this.parseFactor()
    if (this.peek() && this.peek().value === '^') {
      this.consume()
      const right = this.parseFactor()
      left = Math.pow(left, right)
    }
    if (this.peek() && this.peek().type === 'POST') {
      const op = this.consume().value
      if (op === '²') left = left * left
      if (op === '³') left = left * left * left
    }
    return left
  }

  parseFactor() {
    if (!this.peek()) return NaN
    if (this.peek().value === '-') {
      const next = this.tokens[this.pos + 1]
      if (next && (next.type === 'NUM' || next.value === '(' || next.type === 'FN')) {
        this.consume()
        const val = this.parseFactor()
        if (this.peek() && this.peek().type === 'POST') {
          const op = this.consume().value
          return op === '²' ? val * val : val * val * val
        }
        return -val
      }
    }
    if (this.peek().type === 'NUM') {
      let val = this.consume().value
      if (this.peek() && this.peek().type === 'POST') {
        const op = this.consume().value
        if (op === '²') val = val * val
        if (op === '³') val = val * val * val
      }
      return val
    }
    if (this.peek().type === 'FN') {
      const name = this.consume().value
      if (this.peek() && this.peek().value === '(') this.consume()
      const arg = this.parseExpr()
      if (this.peek() && this.peek().value === ')') this.consume()
      let val = this.applyFn(name, arg)
      if (this.peek() && this.peek().type === 'POST') {
        const op = this.consume().value
        if (op === '²') val = val * val
        if (op === '³') val = val * val * val
      }
      return val
    }
    if (this.peek().value === '(') {
      this.consume()
      const val = this.parseExpr()
      if (this.peek() && this.peek().value === ')') this.consume()
      if (this.peek() && this.peek().type === 'POST') {
        const op = this.consume().value
        return op === '²' ? val * val : val * val * val
      }
      return val
    }
    return NaN
  }
}

function formatWithCommas(s) {
  const parts = s.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

function evaluate(exprStr, angleMode) {
  const tokens = tokenize(exprStr)
  const parser = new ExpressionParser(tokens, angleMode)
  const result = parser.parseExpr()
  if (!isFinite(result)) return 'Error'
  if (Math.abs(result) > 10000000000) return result.toExponential(6)
  return String(Number(result.toFixed(10)))
}

const trigFns = ['sin', 'cos', 'tan']
const sciFns = ['log', 'ln', 'sqrt', 'abs', 'exp', 'tenPow', 'fact', 'recip']

export default function ScientificCalculator() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('0')
  const [angleMode, setAngleMode] = useState('DEG')
  const [justEvaluated, setJustEvaluated] = useState(false)
  const [history, setHistory] = useState([])
  const [mode, setMode] = useState('calculator')

  useEffect(() => { setHistory(loadHistory()) }, [])

  useEffect(() => { saveHistory(history) }, [history])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if (mode !== 'calculator') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); return }
      if (e.key === 'Backspace') { e.preventDefault(); backspace(); return }
      if (e.key === 'Escape' || e.key === 'Delete') { e.preventDefault(); clear(); return }
      if (e.key >= '0' && e.key <= '9') { inputDigit(e.key); return }
      if (e.key === '.') { inputDecimal(); return }
      if (e.key === '(') { addLeftParen(); return }
      if (e.key === ')') { addRightParen(); return }
      if (e.key === '+') { addOperator('+'); return }
      if (e.key === '-') { addOperator('-'); return }
      if (e.key === '*') { addOperator('×'); return }
      if (e.key === '/') { addOperator('÷'); return }
      if (e.key === '^') { addOperator('^'); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, equals, backspace, clear, inputDigit, inputDecimal, addLeftParen, addRightParen, addOperator])

  const isExprEmpty = expr.trim() === ''

  const append = useCallback((s) => {
    setExpr((prev) => prev + s)
    setJustEvaluated(false)
  }, [])

  const inputDigit = useCallback((d) => {
    if (justEvaluated) {
      setExpr(d)
      setResult('0')
      setJustEvaluated(false)
      return
    }
    const last = expr.split(/\s+/).pop() || ''
    if (/^[0-9.]*$/.test(last) && last !== '') {
      setExpr((prev) => prev + d)
    } else {
      setExpr((prev) => prev + d)
    }
  }, [justEvaluated, expr])

  const inputDecimal = useCallback(() => {
    if (justEvaluated) {
      setExpr('0.')
      setResult('0')
      setJustEvaluated(false)
      return
    }
    const lastToken = expr.split(/\s+/).pop() || ''
    if (!lastToken.includes('.')) {
      if (lastToken === '' || /[+\-×÷^(]/.test(lastToken)) {
        setExpr((prev) => prev + '0.')
      } else {
        setExpr((prev) => prev + '.')
      }
    }
  }, [justEvaluated, expr])

  const clear = useCallback(() => {
    setExpr('')
    setResult('0')
    setJustEvaluated(false)
  }, [])

  const backspace = useCallback(() => {
    if (justEvaluated) { clear(); return }
    if (expr.endsWith(' ')) {
      const trimmed = expr.trimEnd()
      const spaceIdx = trimmed.lastIndexOf(' ')
      setExpr(spaceIdx >= 0 ? trimmed.slice(0, spaceIdx + 1) : '')
    } else {
      setExpr((prev) => prev.slice(0, -1))
    }
  }, [justEvaluated, expr, clear])

  const addOperator = useCallback((op) => {
    if (justEvaluated) {
      setExpr(result + ' ' + op + ' ')
      setJustEvaluated(false)
      return
    }
    const trimmed = expr.trimEnd()
    if (trimmed.endsWith('(')) {
      return
    }
    if (/[\+\-×÷^]$/.test(trimmed)) {
      setExpr(trimmed.slice(0, -1).trimEnd() + ' ' + op + ' ')
    } else {
      setExpr((prev) => prev + ' ' + op + ' ')
    }
  }, [justEvaluated, expr, result])

  const addLeftParen = useCallback(() => {
    if (justEvaluated) {
      setExpr('( ')
      setResult('0')
      setJustEvaluated(false)
      return
    }
    const trimmed = expr.trimEnd()
    if (trimmed && !/[\+\-×÷^(]$/.test(trimmed) && trimmed !== '') {
      setExpr((prev) => prev + ' × ( ')
    } else {
      setExpr((prev) => prev + '( ')
    }
  }, [justEvaluated, expr])

  const addRightParen = useCallback(() => {
    const openCount = (expr.match(/\(/g) || []).length
    const closeCount = (expr.match(/\)/g) || []).length
    if (closeCount < openCount) {
      setExpr((prev) => prev + ' )')
    }
  }, [expr])

  const addFunction = useCallback((name) => {
    if (justEvaluated) {
      setExpr(name + '( ')
      setResult('0')
      setJustEvaluated(false)
      return
    }
    const trimmed = expr.trimEnd()
    if (trimmed && !/[\+\-×÷^(]$/.test(trimmed) && trimmed !== '') {
      setExpr((prev) => prev + ' × ' + name + '( ')
    } else {
      setExpr((prev) => prev + name + '( ')
    }
  }, [justEvaluated, expr])

  const addPostfix = useCallback((op) => {
    if (justEvaluated) {
      setExpr(result + op)
      setJustEvaluated(false)
      return
    }
    const trimmed = expr.trimEnd()
    const parts = trimmed.split(/\s+/)
    const last = parts[parts.length - 1] || ''
    if (last && !isNaN(parseFloat(last))) {
      setExpr((prev) => prev + op)
    }
  }, [justEvaluated, expr, result])

  const toggleSign = useCallback(() => {
    const trimmed = expr.trimEnd()
    const parts = trimmed.split(/\s+/)
    const last = parts[parts.length - 1] || ''
    if (justEvaluated) {
      if (result !== 'Error' && result !== '0') {
        setExpr(result.startsWith('-') ? result.slice(1) : '-' + result)
        setJustEvaluated(false)
      }
      return
    }
    if (last && !isNaN(parseFloat(last))) {
      const negated = last.startsWith('-') ? last.slice(1) : '-' + last
      parts[parts.length - 1] = negated
      setExpr(parts.join(' ') + ' ')
    }
  }, [justEvaluated, expr, result])

  const addConstant = useCallback((c) => {
    if (justEvaluated) {
      setExpr(c)
      setResult('0')
      setJustEvaluated(false)
      return
    }
    const trimmed = expr.trimEnd()
    if (trimmed && !/[\+\-×÷^(]$/.test(trimmed) && trimmed !== '') {
      setExpr((prev) => prev + ' × ' + c)
    } else {
      setExpr((prev) => prev + c)
    }
  }, [justEvaluated, expr])

  const addHistoryEntry = useCallback((entry) => {
    setHistory((prev) => [entry, ...prev])
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const equals = useCallback(() => {
    if (isExprEmpty) return
    const fullExpr = expr
    const evaluated = evaluate(fullExpr, angleMode)
    setResult(evaluated)
    setExpr(fullExpr + ' =')
    setJustEvaluated(true)
    addHistoryEntry({ type: 'calc', expression: fullExpr, result: evaluated })
  }, [expr, angleMode, isExprEmpty])

  const displayExpr = useMemo(() => {
    return expr || '\u00A0'
  }, [expr])

  return (
    <div className="calc-wrapper">
      <div className="calc-top-bar">
        <div className="calc-title">
          <div className="calc-logo-row">
            <img src="/favicon.png" alt="" className="calc-logo-img" />
            <div className="calc-brand">
              <span>ELEVATE</span>
              <span>Calculator</span>
            </div>
          </div>
        </div>
        <div className="calc-mode-switch">
          <button className={`calc-mode-btn ${mode === 'calculator' ? 'active' : ''}`} onClick={() => setMode('calculator')}>Calc</button>
          <button className={`calc-mode-btn ${mode === 'converter' ? 'active' : ''}`} onClick={() => setMode('converter')}>Convert</button>
        </div>
        <button className="calc-history-btn" onClick={() => setShowHistory((p) => !p)} title="History">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
      </div>
      <div className="calc-body">
        <div className="calc-mode-panel">
      {mode === 'calculator' ? (
      <div className="calculator">
      <div className="calc-display">
        <div className="calc-expression">{displayExpr}</div>
        <div className="calc-result">{result === 'Error' ? 'Error' : formatWithCommas(result)}</div>
      </div>

      <div className="calc-sci-row">
        <button className="calc-btn sci" onClick={() => addFunction('sin')}>sin</button>
        <button className="calc-btn sci" onClick={() => addFunction('cos')}>cos</button>
        <button className="calc-btn sci" onClick={() => addFunction('tan')}>tan</button>
        <button className="calc-btn sci" onClick={() => addFunction('log')}>log</button>
        <button className="calc-btn sci" onClick={() => addFunction('ln')}>ln</button>
        <button className="calc-btn sci" onClick={() => addFunction('sqrt')}>√</button>
      </div>

      <div className="calc-sci-row">
        <button className="calc-btn sci" onClick={() => addPostfix('²')}>x²</button>
        <button className="calc-btn sci" onClick={() => addPostfix('³')}>x³</button>
        <button className="calc-btn sci" onClick={() => addOperator('^')}>xⁿ</button>
        <button className="calc-btn sci" onClick={() => addFunction('recip')}>1/x</button>
        <button className="calc-btn sci" onClick={() => addFunction('abs')}>|x|</button>
        <button className="calc-btn sci" onClick={() => addFunction('exp')}>eˣ</button>
      </div>

      <div className="calc-sci-row">
        <button className="calc-btn sci" onClick={() => addFunction('tenPow')}>10ˣ</button>
        <button className="calc-btn sci" onClick={() => addFunction('fact')}>x!</button>
        <button className="calc-btn sci" onClick={() => addConstant('π')}>π</button>
        <button className="calc-btn sci" onClick={() => addConstant('e')}>e</button>
        <button className="calc-btn mode active" onClick={() => setAngleMode((p) => p === 'DEG' ? 'RAD' : 'DEG')}>{angleMode}</button>
        <button className="calc-btn sci" onClick={toggleSign}>±</button>
      </div>

      <div className="calc-main-grid">
        <div className="calc-numbers">
          <button className="calc-btn op" onClick={clear}>C</button>
          <button className="calc-btn op" onClick={backspace}>⌫</button>
          <button className="calc-btn op" onClick={() => addOperator('÷')}>÷</button>
          <button className="calc-btn op" onClick={() => addOperator('×')}>×</button>
          <button className="calc-btn num" onClick={() => inputDigit('7')}>7</button>
          <button className="calc-btn num" onClick={() => inputDigit('8')}>8</button>
          <button className="calc-btn num" onClick={() => inputDigit('9')}>9</button>
          <button className="calc-btn op" onClick={() => addOperator('-')}>−</button>
          <button className="calc-btn num" onClick={() => inputDigit('4')}>4</button>
          <button className="calc-btn num" onClick={() => inputDigit('5')}>5</button>
          <button className="calc-btn num" onClick={() => inputDigit('6')}>6</button>
          <button className="calc-btn op" onClick={() => addOperator('+')}>+</button>
          <button className="calc-btn num" onClick={() => inputDigit('1')}>1</button>
          <button className="calc-btn num" onClick={() => inputDigit('2')}>2</button>
          <button className="calc-btn num" onClick={() => inputDigit('3')}>3</button>
          <button className="calc-btn eq" onClick={equals}>=</button>
          <button className="calc-btn num" onClick={() => inputDigit('0')}>0</button>
          <button className="calc-btn num" onClick={inputDecimal}>.</button>
          <button className="calc-btn op" onClick={addLeftParen}>(</button>
          <button className="calc-btn op" onClick={addRightParen}>)</button>
          </div>
        </div>
      </div>
      ) : (
        <MeasurementConverter onConversion={addHistoryEntry} />
      )}
        </div>
      </div>

      <div className={`calc-drawer-overlay ${showHistory ? 'open' : ''}`} onClick={() => setShowHistory(false)} />
      <div className={`calc-drawer ${showHistory ? 'open' : ''}`}>
        <div className="calc-drawer-header">
          <span>History</span>
          <div>
            {history.length > 0 && (
              <button className="calc-history-clear" onClick={clearHistory}>Clear</button>
            )}
            <button className="calc-drawer-close" onClick={() => setShowHistory(false)}>✕</button>
          </div>
        </div>
        <div className="calc-drawer-list">
          {history.length === 0 && (
            <div className="calc-history-empty">No calculations yet</div>
          )}
          {history.map((entry, i) => (
            <div key={i} className="calc-history-item">
              <div className="calc-history-tag">{entry.type === 'calc' ? 'Calc' : 'Conv'}</div>
              <div className="calc-history-expr">{entry.expression}</div>
              <div className="calc-history-result">{formatWithCommas(entry.result)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="calc-footer">
        &copy; copyright. All rights reserved.{" "}
        <a href="https://lvttime.netlify.app/" target="_blank" rel="noopener noreferrer">Elevate Time inc.</a>
      </div>
    </div>
  )
}
