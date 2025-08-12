'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(()=>{ document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  return (
    <button onClick={()=>setDark(d=>!d)} className="btn" title="Przełącz motyw">
      {dark ? <Sun size={16}/> : <Moon size={16}/>}
      {dark ? 'Jasny' : 'Ciemny'}
    </button>
  );
}
