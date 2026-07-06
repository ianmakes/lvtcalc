'use client'

import dynamic from 'next/dynamic'

const ScientificCalculator = dynamic(
  () => import('./ScientificCalculator'),
  { ssr: false, loading: () => <div className="calc-loading" /> }
)

export default function ClientPage() {
  return <ScientificCalculator />
}
