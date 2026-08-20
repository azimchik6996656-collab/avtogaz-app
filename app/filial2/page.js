import AvtogazApp from "../AvtogazApp";

// 2-filial — bosh filialdan (avtogaz-app.vercel.app) BUTUNLAY mustaqil: o'z
// skladi, kassasi, kartalari, xodimlari, PIN kodlari. Supabase'da alohida
// qatorga (id="filial2") yoziladi — bosh filialning ma'lumotiga hech qanday
// ta'sir qilmaydi.
export default function Filial2Page() {
  return <AvtogazApp branchId="filial2" />;
}
