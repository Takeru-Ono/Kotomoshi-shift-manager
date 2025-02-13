import { useState } from "react";
import Login from "../components/Login";
import ShiftCalendar from "../components/ShiftCalendar";

export default function Home() {
  const [user, setUser] = useState(null);

  return (
    <div className="container mx-auto p-4">
<h1 className="text-3xl font-bold border border-gray-300 bg-gray-100 shadow-lg p-4 rounded-lg text-center">
  喫茶こともし <span className="text-sm font-normal">のシフト管理♡</span>
</h1>
      {user ? (
        <ShiftCalendar user={user} onLogout={() => setUser(null)} />
      ) : (
        <Login onLogin={setUser} />
      )}
    </div>
  );
}