'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

const categories = [
  { id: 'currency', label: 'Currency' },
  { id: 'length', label: 'Length' },
  { id: 'weight', label: 'Weight' },
  { id: 'temperature', label: 'Temp' },
  { id: 'volume', label: 'Volume' },
  { id: 'speed', label: 'Speed' },
  { id: 'data', label: 'Data' },
]

const currencyCodes = [
  'USD', 'KES', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD',
  'INR', 'BRL', 'ZAR', 'SGD', 'CHF', 'NGN', 'EGP', 'GHS',
  'TZS', 'UGX', 'RWF', 'ETB', 'MAD', 'ZMW',
]

const units = {
  currency: {
    base: 'USD',
    units: currencyCodes.map((c) => ({ id: c, label: c, type: 'currency' })),
  },
  length: {
    base: 'm',
    units: [
      { id: 'mm', label: 'mm', factor: 0.001 },
      { id: 'cm', label: 'cm', factor: 0.01 },
      { id: 'm', label: 'm', factor: 1 },
      { id: 'km', label: 'km', factor: 1000 },
      { id: 'in', label: 'in', factor: 0.0254 },
      { id: 'ft', label: 'ft', factor: 0.3048 },
      { id: 'yd', label: 'yd', factor: 0.9144 },
      { id: 'mi', label: 'mi', factor: 1609.344 },
    ],
  },
  weight: {
    base: 'g',
    units: [
      { id: 'mg', label: 'mg', factor: 0.001 },
      { id: 'g', label: 'g', factor: 1 },
      { id: 'kg', label: 'kg', factor: 1000 },
      { id: 'oz', label: 'oz', factor: 28.3495 },
      { id: 'lb', label: 'lb', factor: 453.592 },
      { id: 'ton', label: 'ton', factor: 907184.74 },
    ],
  },
  temperature: {
    base: 'C',
    units: [
      { id: 'C', label: '°C', type: 'temp' },
      { id: 'F', label: '°F', type: 'temp' },
      { id: 'K', label: 'K', type: 'temp' },
    ],
  },
  volume: {
    base: 'L',
    units: [
      { id: 'mL', label: 'mL', factor: 0.001 },
      { id: 'L', label: 'L', factor: 1 },
      { id: 'gal', label: 'gal', factor: 3.78541 },
      { id: 'qt', label: 'qt', factor: 0.946353 },
      { id: 'cup', label: 'cup', factor: 0.236588 },
      { id: 'floz', label: 'fl oz', factor: 0.0295735 },
    ],
  },
  speed: {
    base: 'm/s',
    units: [
      { id: 'ms', label: 'm/s', factor: 1 },
      { id: 'kmh', label: 'km/h', factor: 0.277778 },
      { id: 'mph', label: 'mph', factor: 0.44704 },
      { id: 'knot', label: 'knot', factor: 0.514444 },
    ],
  },
  data: {
    base: 'B',
    units: [
      { id: 'B', label: 'B', factor: 1 },
      { id: 'KB', label: 'KB', factor: 1024 },
      { id: 'MB', label: 'MB', factor: 1048576 },
      { id: 'GB', label: 'GB', factor: 1073741824 },
      { id: 'TB', label: 'TB', factor: 1099511627776 },
    ],
  },
}

function convertTemp(value, from, to) {
  let celsius
  if (from === 'C') celsius = value
  else if (from === 'F') celsius = (value - 32) * 5 / 9
  else celsius = value - 273.15

  if (to === 'C') return celsius
  if (to === 'F') return celsius * 9 / 5 + 32
  return celsius + 273.15
}

function formatResult(n) {
  if (!isFinite(n)) return 'Error'
  if (Math.abs(n) > 10000000000) return n.toExponential(6)
  n = Math.round(n * 10000) / 10000
  const parts = String(n).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

export default function MeasurementConverter({ onConversion }) {
  const [category, setCategory] = useState('currency')
  const [fromUnit, setFromUnit] = useState('USD')
  const [toUnit, setToUnit] = useState('KES')
  const [input, setInput] = useState('1')
  const [result, setResult] = useState('')
  const [converting, setConverting] = useState(false)
  const lastHistoryKey = useRef('')

  const cat = units[category]
  const from = cat.units.find((u) => u.id === fromUnit)
  const to = cat.units.find((u) => u.id === toUnit)

  const doConvert = useCallback((val, fromId, toId, rateData) => {
    if (fromId === toId) return val
    const inUSD = fromId === 'USD' ? val : val / (rateData[fromId] || 1)
    return toId === 'USD' ? inUSD : inUSD * (rateData[toId] || 1)
  }, [])

  const fetchAndConvert = useCallback(() => {
    const val = parseFloat(input)
    if (isNaN(val)) { setResult(''); return }
    setConverting(true)
    setResult('Converting...')
    fetch('https://api.frankfurter.dev/v2/rates?base=USD')
      .then((r) => r.json())
      .then((data) => {
        const ratesMap = {}
        data.forEach((r) => { ratesMap[r.quote] = r.rate })
        const converted = doConvert(val, fromUnit, toUnit, ratesMap)
        const formatted = formatResult(converted)
        setResult(formatted)
        setConverting(false)
        if (onConversion) onConversion({ type: 'conv', expression: `${input} ${fromUnit} → ${toUnit}`, result: formatted })
      })
      .catch(() => {
        setResult('Error fetching rates')
        setConverting(false)
      })
  }, [input, fromUnit, toUnit, doConvert])

  useEffect(() => {
    if (category === 'currency') return
    const val = parseFloat(input)
    if (isNaN(val)) { setResult(''); return }
    if (!from || !to) { setResult('Error'); return }

    let converted
    if (from.type === 'temp') {
      converted = convertTemp(val, fromUnit, toUnit)
    } else {
      converted = (val * from.factor) / to.factor
    }
    setResult(formatResult(converted))
  }, [input, fromUnit, toUnit, category, from, to])

  const swap = useCallback(() => {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
    if (result && input) {
      setInput(result.replace(/,/g, ''))
    }
  }, [fromUnit, toUnit, result, input])

  return (
    <div className="converter">
      <div className="conv-categories">
        <label className="conv-label">Category</label>
        <select className="conv-cat-select" value={category} onChange={(e) => {
          const newCat = e.target.value
          const catUnits = units[newCat].units
          setCategory(newCat)
          if (newCat === 'currency') {
            setFromUnit('USD')
            setToUnit('KES')
          } else {
            setFromUnit(catUnits[0].id)
            setToUnit(catUnits[1]?.id || catUnits[0].id)
          }
          setInput('1')
          setResult('')
        }}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="conv-input-group">
        <label className="conv-label">From</label>
        <div className="conv-row">
          <input
            className="conv-input"
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && category === 'currency') fetchAndConvert() }}
            onBlur={() => {
              if (category !== 'currency' && result && input) {
                const key = `${input}|${fromUnit}|${toUnit}`
                if (key !== lastHistoryKey.current && onConversion) {
                  lastHistoryKey.current = key
                  onConversion({ type: 'conv', expression: `${input} ${fromUnit} → ${toUnit}`, result })
                }
              }
            }}
          />
          <select className="conv-select" value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
            {cat.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      </div>

      <button className="conv-swap" onClick={swap}>⇅</button>

      <div className="conv-input-group">
        <label className="conv-label">To</label>
        <div className="conv-row">
          <div className="conv-result">{result || '—'}</div>
          <select className="conv-select" value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
            {cat.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      </div>
      {category === 'currency' && (
        <button className="conv-submit" onClick={fetchAndConvert} disabled={converting}>
          {converting ? 'Converting...' : 'Convert'}
        </button>
      )}
    </div>
  )
}
