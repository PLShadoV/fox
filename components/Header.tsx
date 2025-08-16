'use client'
import Image from 'next/image'
import Link from 'next/link'

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
      <nav className="flex items-center gap-2">
        <Link className="btn" href="https://vercel.com/new">Deploy</Link>
        <a className="btn" href="https://github.com/new" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>
  )
}
