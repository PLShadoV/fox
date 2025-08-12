// components/Nav.tsx
// Prosty komponent nawigacji z eksportem domyślnym.
// Zadbaj, by ścieżka i wielkość liter zgadzały się z importem w app/layout.tsx: "@/components/Nav"
export default function Nav() {
  return (
    <nav className="p-4 border-b">
      <div className="font-semibold">FoxESS</div>
    </nav>
  );
}
