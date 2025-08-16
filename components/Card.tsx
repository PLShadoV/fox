import { ReactNode } from 'react'
export default function Card({ title, action, children }:{ title:string, action?:ReactNode, children:ReactNode }){
  return (<section className="card mb-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>)
}
