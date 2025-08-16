'use client'
import Image from 'next/image'

export default function Header() {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Image src="/logo.svg" alt="Logo" width={36} height={36} />
        <div>
          <h1 className="h1">FoxESS × RCE</h1>
          <p className="sub">Dashboard przychodów z net-billingu</p>
        </div>
      </div>
      <div />
    </header>
  )
}
