import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="p-4 bg-gray-800 text-white flex justify-between">
      <Link href="/" className="px-4">シフト管理</Link>
      <Link href="/final-schedule" className="px-4">確定版シフト</Link>
    </nav>
  );
}